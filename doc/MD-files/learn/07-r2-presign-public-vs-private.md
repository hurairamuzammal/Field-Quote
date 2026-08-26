# FieldQuote — Cloudflare R2 for beginners

**Audience:** new to Cloudflare / R2  
**Pairs with:** `perform/11-dynamic-company-branding-guide.md`, edge function `r2-presign`  
**Goal:** understand the bucket, `r2-presign`, public vs private access, and why email logos are awkward.

---

## 1. What is R2?

**R2** = Cloudflare’s file storage (like Amazon S3).

Think of it as a **hard drive on the internet**:

| Concept | Everyday analogy |
|--------|------------------|
| **Bucket** | One locked cupboard (ours is named `fieldquote`) |
| **Object** | One file inside (a photo, a logo, an audio clip) |
| **Object key** | The path/name of that file, e.g. `companies/…/logo/abc.png` |

The database never stores the image bytes. It stores only the **key** (path string). That is §13 Rule 9: *files live in R2; DB stores keys only*.

---

## 2. Why does FieldQuote have this bucket?

We need somewhere to put:

- intake request photos / audio  
- job completion photos  
- company logos  

Bubble must **not** become the file store. Supabase Storage is unused for this. Everything goes to the **`fieldquote`** R2 bucket.

Important: the URL you see under **S3 API** in Cloudflare:

```text
https://<accountid>.r2.cloudflarestorage.com/fieldquote
```

is for **API / signing tools** (our edge function). It is **not** a friendly public website for Gmail to load images from.

---

## 3. What is `r2-presign`?

`r2-presign` is a **Supabase Edge Function**. Bubble never holds R2 secret keys.

### The problem it solves

If the bucket is **private** (our default):

- You cannot open `https://…/some-photo.jpg` in a browser just by knowing the key.
- Upload and download need a special **temporary signed URL**.

### What “presign” means

**Presign** = “create a short-lived permission slip (URL) for one file action.”

| Mode | What Bubble does | What the signed URL allows |
|------|------------------|----------------------------|
| **PUT** | Upload | Browser `PUT`s the file bytes to R2 for a few minutes |
| **GET** | Display / download | Browser `GET`s the file for a few minutes |

Flow:

```text
Bubble (logged-in staff)
  → calls r2-presign with JWT + kind/key
  → edge function checks who you are (admin / technician)
  → edge function signs a temporary URL with R2 secrets
  → Bubble uses that URL once (upload or show image)
```

So:

- **Secrets stay on the server** (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, …).  
- **RLS-style thinking still applies:** the function decides *who* may get a URL for *which* key (e.g. only staff; job photos only if assigned).  
- After the URL expires, that link stops working. Good for the app UI. Bad for email that sits in Gmail for a week.

---

## 4. How R2 security works (big picture)

Two layers people mix up:

### Layer A — Bucket access mode (Cloudflare switch)

| Mode | Meaning |
|------|--------|
| **Private** (default) | No random person can fetch objects by URL. Need signed URLs or Cloudflare credentials. |
| **Public** (Public Dev URL or Custom Domain) | Anyone who knows (or guesses) the object key can `GET` that object over HTTPS. |

### Layer B — App authorization (`r2-presign`)

Even when the bucket is private, **not every logged-in user** should see every file. The edge function enforces:

- valid staff JWT  
- role rules (admin vs technician)  
- key prefix rules (e.g. job photo path must match a job they can access)

**Private bucket + `r2-presign`** = normal FieldQuote pattern for photos.

```text
Private bucket
    ↓
Only signed URLs work
    ↓
Only r2-presign creates those URLs
    ↓
Only after auth + rules pass
```

That is the secure story for **job photos**.

---

## 5. Public Development URL vs Custom Domain

Both are ways to put a **public HTTPS front door** on the bucket.

### Public Development URL

- Cloudflare checkbox: “expose this bucket on a `pub-….r2.dev` URL”.
- Fast for demos / learning.
- Example base: `https://pub-xxxxxxxxxxxx.r2.dev`
- Then a file is: `https://pub-xxxxxxxxxxxx.r2.dev/<object-key>`

### Custom Domain

- Same idea, but under **your** hostname, e.g. `https://assets.yourdomain.com`.
- Needs a domain on the same Cloudflare account + DNS.
- Better for production branding / trust.

### What they both do

They answer: “Can the open internet fetch objects from this bucket **without** a signed URL?”

If either is enabled for the bucket, a stable URL works forever (until you delete the object or turn public access off). That is what **email** wants.

### What they do **not** do

They do **not** replace login for the Bubble app.  
They do **not** mean “only logos are public.”  
At the simple Cloudflare level, public access is basically **bucket-wide**: if the front door is open, **any object key** under that bucket can be fetched if someone has the URL.

---

## 6. Why emails need a public base URL

| Surface | Needs | Works with |
|---------|--------|------------|
| Admin / tech UI | Temporary view of logo | `r2-presign` **GET** (private bucket OK) |
| Email (Gmail, etc.) | Image URL that still works days later | Stable public HTTPS URL |

Gmail will not call your edge function when the customer opens the mail.  
So at **send time** we build:

```text
R2_PUBLIC_BASE_URL + "/" + logo_key
→ https://pub-….r2.dev/companies/…/logo/….png
```

If that public base (or `logo_key`) is missing, we fall back to the static landing logo (`EMAIL_ASSET_BASE_URL` + `/logos/logo-email.png`).

---

## 7. “Can I expose only logos and keep photos private?”

### Short answer

**Not with one simple “make this folder public” switch on a single R2 bucket.**  
R2’s Public Development URL / Custom Domain is “this bucket has a public HTTP endpoint,” not “only keys under `companies/…/logo/` are public.”

### Why that feels unfair but is how it works

People want:

```text
companies/*/logo/*     → public (email)
jobs/*/photos/*        → private (presign only)
requests/*             → private
```

Cloudflare’s basic public bucket / custom domain does **not** give you that folder ACL for free. Public front door = objects are fetchable by key.

Workarounds exist (Workers in front, signed cookies, separate buckets, etc.), but they are extra infrastructure. FieldQuote stays on free-tier-friendly patterns.

### So what are the real options?

| Option | Logos in email | Photos stay private | Complexity |
|--------|----------------|---------------------|------------|
| **A. Keep bucket private** | Use fallback static logo only | Yes (presign) | Simplest / safest |
| **B. Enable public URL on `fieldquote`** | Dynamic company logo works | **No** — any known key is fetchable | Easy, weaker |
| **C. Second public bucket (or public prefix strategy via separate bucket)** only for logos | Dynamic logo works | Yes — photos stay on private bucket | Recommended |

Keys with UUIDs are hard to guess, so B is “obscurity,” not real access control. Do not treat B as secure for customer job photos.

---

## 8. Why a separate bucket is recommended

Imagine two cupboards:

| Bucket | Access | Contents |
|--------|--------|----------|
| `fieldquote` (current) | **Private** | Job photos, request media — only via `r2-presign` |
| `fieldquote-public` (example name) | **Public** + custom domain / pub URL | Company logos only |

Then:

- Email: `https://assets…/companies/…/logo/….png` from the **public** bucket  
- App photos: still private + presign on the **private** bucket  
- `company_settings.logo_key` still stores only the path; `R2_PUBLIC_BASE_URL` points at the public cupboard’s base  

You do **not** need the separate bucket on day one as a trainee. You need the **concept** so you don’t accidentally “make everything public” without understanding the tradeoff.

---

## 9. Mental model (one diagram)

```text
┌─────────────────────────────────────────────────────────┐
│  R2 bucket "fieldquote"                                 │
│                                                         │
│  objects:                                               │
│    requests/.../photo.jpg                               │
│    jobs/.../photos/...                                  │
│    companies/.../logo/...                               │
└─────────────────────────────────────────────────────────┘
           │                              │
           │ private (default)            │ if you enable
           │                              │ Public Dev URL
           │                              │ or Custom Domain
           ▼                              ▼
   only temporary                    stable public URLs
   signed URLs                       for ANY object key
           │                              │
           ▼                              ▼
   r2-presign (auth)               good for email logos
   good for Bubble UI              bad if photos share
                                   the same public door
```

---

## 10. What you should do as a trainee (practical)

1. **Learn first** — this file. Don’t flip public switches until you know the tradeoff.  
2. **UI logos** — work with `r2-presign` GET + Bubble cache states (private bucket is fine).  
3. **Email logos** — either:  
   - leave `R2_PUBLIC_BASE_URL` unset → static fallback logo, or  
   - ask senior: enable public access (accept tradeoff) **or** provision a separate public logo bucket + custom domain.  
4. **Never** put R2 secret keys in Bubble or git. Only `supabase secrets`.  
5. **Never** use the S3 API hostname as `R2_PUBLIC_BASE_URL`.

---

## 11. Glossary

| Term | Meaning |
|------|--------|
| **Bucket** | Named container of files |
| **Object key** | Path of a file inside the bucket |
| **Private bucket** | No anonymous HTTP fetch; need signed URL or credentials |
| **Presigned URL** | Temporary allow-upload or allow-download link |
| **`r2-presign`** | Our edge function that issues those links after auth |
| **Public Development URL** | Cloudflare `pub-….r2.dev` front door for demos |
| **Custom Domain** | Your hostname as the public front door |
| **`R2_PUBLIC_BASE_URL`** | Env secret = that public front door base (no trailing slash) |
| **`logo_key`** | DB field = object key only, not a full URL |

---

## 12. Related docs

| Doc | Use when |
|-----|----------|
| `perform/11-dynamic-company-branding-guide.md` | Building company name + logo end-to-end |
| `plan/P2-backend.md` §5.2 | R2 CORS for browser uploads |
| `CLAUDE.md` / `AGENTS.md` §13 R9 | Files in R2, keys in DB |

**Updated:** 2026-08-21
