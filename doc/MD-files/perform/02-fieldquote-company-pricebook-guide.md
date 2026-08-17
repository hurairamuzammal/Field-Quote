# FieldQuote — Company Settings & Price Book (read-only display)

Scope for this step: **admins can see** their company's settings and price book. Editing comes next; the seam is noted at the end so nothing here gets rewritten.

---

## Part 1 — Make company_id automatic for every user

You said every employee should inherit the same company. Right now `profiles` has no default, so an invited technician could land with a null or wrong `company_id` — and every policy below hangs off that column.

```sql
-- migration: profiles_company_default
select company_id from public.company_settings;   -- copy this value

alter table public.profiles
  alter column company_id set default 'PASTE_THAT_UUID'::uuid;

-- Backfill anyone created before the default existed
update public.profiles
set company_id = 'PASTE_THAT_UUID'::uuid
where company_id is null;
```

Also make sure your `handle_new_user()` trigger doesn't insert an explicit `null` — if it lists `company_id` in the INSERT column list with no value, the default never applies. Either omit the column entirely or read it from metadata:

```sql
insert into public.profiles (id, email, full_name, role)
values (new.id, new.email,
        coalesce(new.raw_user_meta_data->>'full_name',''),
        coalesce(new.raw_user_meta_data->>'role','technician'));
-- company_id omitted on purpose → column default fills it
```

---

## Part 2 — RLS: scope by company, not just role

Your existing policies check `auth_role() = 'admin'`. That's fine for one company but silently becomes a data leak the day a second one exists. Add a company helper now — it costs nothing and makes every future policy correct by default.

```sql
-- migration: company_scoped_policies

create or replace function public.auth_company_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() $$;

-- ---------- company_settings ----------
alter table public.company_settings enable row level security;

-- Admins: full access to their own company's row
create policy company_settings_admin_all on public.company_settings
for all to authenticated
using      (public.auth_role() = 'admin' and company_id = public.auth_company_id())
with check (public.auth_role() = 'admin' and company_id = public.auth_company_id());

-- Technicians: read-only, and only safe fields matter to them
-- (they need company name/logo for the job view; they must never see rates)
create policy company_settings_tech_read on public.company_settings
for select to authenticated
using (public.auth_role() = 'technician' and company_id = public.auth_company_id());

-- ---------- price_book_items ----------
alter table public.price_book_items enable row level security;

create policy price_book_admin_all on public.price_book_items
for all to authenticated
using      (public.auth_role() = 'admin' and company_id = public.auth_company_id())
with check (public.auth_role() = 'admin' and company_id = public.auth_company_id());

-- No technician policy at all → prices are invisible to them (scope §2)
```

> **On the technician read of `company_settings`:** RLS filters rows, not columns — a technician reading that row gets `labor_rate` and `deposit_pct` too. If you'd rather they see nothing, drop that policy; if they need the company name later, expose it through a view with only the safe columns. For now, dropping it is the safer default.

Also give `price_book_items.company_id` a default so inserts don't need to think about it:

```sql
alter table public.price_book_items
  alter column company_id set default 'PASTE_THAT_UUID'::uuid;
```

**Add to `tests/rls/`:**
```sql
-- as a technician
set local request.jwt.claims = '{"sub":"<technician-uuid>"}';
select count(*) from price_book_items;   -- must be 0
```

---

## Part 3 — API Connector calls

Both are **Data** calls (they feed elements, not workflows), with `Authorization: Bearer <access_token>`, Private unticked. `apikey` comes from your shared headers.

### 3.1 `DB - Get Company Settings`

| Setting | Value |
|---|---|
| Use as | **Data** |
| Method | GET |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/company_settings?select=company_id,name,logo_key,deposit_pct,tax_pct,quote_validity_days,labor_rate,working_hours` |
| Extra header | `Accept: application/vnd.pgrst.object+json` |

That `Accept` header returns a single object instead of a one-item array — so you bind fields directly with no `:first item`. It works because the table has exactly one row per company and RLS limits you to yours.

Initialize with an **admin** token. Set `deposit_pct`, `tax_pct`, `labor_rate` as **number**; `quote_validity_days` as number; `working_hours` will come through as text (JSON) — fine for display.

### 3.2 `DB - Get Price Book`

| Setting | Value |
|---|---|
| Use as | **Data** |
| Method | GET |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/price_book_items?select=id,name,category,unit,unit_price,keywords,active&order=category.asc,name.asc` |

Initialize with an admin token. `unit_price` must be typed **number**, `active` **yes/no**.

**Optional filter parameters** (add them now, they cost nothing):
- `&active=eq.<active>` — for an "active only" toggle
- `&category=eq.<category>` — for a category filter
- `&name=ilike.<search>` — for search; pass `*term*` as the value

If you add these, make each a parameter and tick **Optional** so Bubble can omit them.

---

## Part 4 — Admin UI

### 4.1 Company Settings panel

A group on the admin page (`Group Settings`), data source = *Get data from an external API* → `DB - Get Company Settings` → `access_token = Current User's sb_access_token`.

Inside, text elements bound to `Parent group's ... 's <field>`:

| Label | Value |
|---|---|
| Company | `name` |
| Deposit | `deposit_pct` + "%" |
| Tax | `tax_pct` + "%" |
| Quote validity | `quote_validity_days` + " days" |
| Labour rate | `labor_rate` (format as currency) |

Logo: `logo_key` is an R2 object key, not a URL — it needs a presigned GET to display. Skip the logo for now, or reuse the presign function in download mode.

### 4.2 Price Book list

`RG PriceBook` — Type of content: `DB - Get Price Book` (the external type), data source as above.

Columns per cell: `Current cell's ... 's name`, `category`, `unit`, `unit_price`, and a badge when `active is "no"`.

**Two display details worth doing now:**
- Show inactive items greyed with an "Inactive" tag rather than hiding them — an admin needs to see what exists before wondering why a price vanished (§4.2: deactivated items stay on old quotes).
- Format `unit_price` with `:formatted as` → currency, and show the unit after it ("£65.00 / hour"), since `unit` is one of `job` / `hour` / `unit`.

**Empty state:** a text element visible when `RG PriceBook's list of ...:count is 0` — "No price book items yet." You'll see this a lot until you seed the 25+ items §4.2 asks for.

### 4.3 Refresh after changes

For now (read-only) nothing changes it. When you add editing, each save re-runs the data source rather than mutating a Bubble list — the API is the source of truth.

---

## Part 5 — Test checklist

- [ ] `select id, role, company_id from profiles` → every row has the same non-null `company_id`
- [ ] Invite a new technician → their profile row gets that `company_id` automatically
- [ ] Admin logs in → settings panel shows real values from `company_settings`
- [ ] Admin logs in → price book RG lists seeded items, grouped by category
- [ ] `unit_price` displays as currency, not a raw number
- [ ] An inactive item appears greyed with a tag
- [ ] Technician logs in → `DB - Get Price Book` returns `[]` (test by temporarily putting the RG on the tech page, then remove it)
- [ ] `tests/rls/` technician assertions pass
- [ ] Empty state shows when the table has no rows
- [ ] Initialize each call with a technician token → confirm you get nothing back (proves RLS, not UI, is filtering)

---

## Part 6 — The seam for editing (next step, no rework)

When you add CRUD, nothing above changes — you add:

| Action | Call | Notes |
|---|---|---|
| Update settings | `PATCH /rest/v1/company_settings?company_id=eq.<id>` | Your check constraints already enforce 0–100 for percentages and validity > 0 — mirror them in the UI for friendlier errors |
| Add item | `POST /rest/v1/price_book_items` | `company_id` comes from the column default; `unique (company_id, name)` means duplicate names return `23505` — catch it and show "An item with that name already exists" |
| Edit item | `PATCH /rest/v1/price_book_items?id=eq.<id>` | |
| Deactivate | `PATCH` with `{"active": false}` | **Never DELETE** — old quote lines reference these rows (§4.2) |

All four use `Authorization: Bearer <access_token>` and are permitted only for admins by the policies in Part 2 — a technician's token gets `42501` from Postgres, which is the correct outcome.
