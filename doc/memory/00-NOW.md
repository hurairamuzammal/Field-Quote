# NOW — paste into a new chat

**Last updated:** 2026-08-17

## Where we are
**Security hardening** — `tasks/09-security-hardening.md`.  
Items **2–5 are in the repo** (not live until `db push` + deploys). **Item 1** is still the hosted Auth Dashboard (disable signups).

**Also this session:** Resend invite on the technicians table when `active` is no — `perform/10-resend-invite-technicians-table.md`. Deploy `resend-invite`, then Bubble connector + button.

**Next: item 6 leftovers** — rate-limit `request-password-reset`, `resolve-quote-token`, `create-checkout`, `draft-quote`, invite. Intake spam on `submit-request` + r2 PUT is wired (deploy those two).

Invitees stay `active = false` until **Set Password**. The Auth trigger often misses GoTrue’s placeholder hash — call **`complete-password-setup`** after Set Password (updates `profiles` → Realtime bumps admin `s_techs_ts`). Also push `20260817140000_…`.

**Paused:** Draft loading (`tasks/04`), assign tech (`tasks/08`), realtime polish (`tasks/02`).

**Do later (UX, after security A–C; alerts = item 21 in task 09):**
1. **`tasks/03-admin-snackbars.md`**
2. Quote popup Save polish
3. `tasks/02-realtime-hybrid.md`
4. `tasks/05-company-logo-r2.md`
5. `tasks/06-admin-sidebar-full-height.md`
6. `tasks/07-change-password-ui.md`
7. Go-live Bubble URLs — `shared/constants.md`
8. q-success version `53hv8` — backlog #18

## Locked (recent)
- Role only from `app_metadata.fieldquote_role`.
- Invite profile `active = false` until password is set.
- Deactivate = Auth ban + unassign **future** jobs only (`set-technician-active`).
- Rate limiter helper exists; **not applied** until item 6.

## Next concrete steps
1. Dashboard: disable public signups (item 1) if not already
2. `npx supabase db push`
3. Deploy `invite-technician`, `resend-invite`, `send-quote`, `set-technician-active`, **`complete-password-setup`**
4. Bubble `password_setup`: Verify → Set Password → **Complete Password Setup** → login
5. Then item 6 (apply rate limits)

## IDs
- Supabase: `chqljfdmgdtsmbbwbdyv`
- Company: `00000000-0000-0000-0000-000000000001`
- Bubble export audited: `fieldquote-26446 (2).bubble`

## Memory index
`doc/memory/00-INDEX.md`
