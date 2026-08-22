# NOW — paste into a new chat

**Last updated:** 2026-08-23  
**Current:** deploy waitlist (`tasks/16`) then pick next  
**Waitlist:** code done — `submit-waitlist` + landing `/api/waitlist` + Contact form

## Where we are
Core money path + tech Complete + final invoice + Make/Form + q-success + **landing waitlist (repo)**. Deploy: `npx supabase functions deploy submit-waitlist --no-verify-jwt` + Vercel `NEXT_PUBLIC_SUPABASE_*`.

## Scope progress (rough)
~**72%** · left: pg_cron, assistant, polish, UX leftovers.

## Do next (pick one)
1. **Deploy + test waitlist** (`tasks/16`)  
2. **`tasks/15`** Realtime “live” indicator (§8.3)  
3. Assign/Cancel conditions (**7b**)  
4. Company branding (**8** / `perform/11`)  
5. **pg_cron** quote-followups + daily-reminders (Day 18–19)  

## Auth
Bearer access token on PostgREST. Final invoice: staff JWT.

## Do not
- Write payments from Bubble
- Bind tech UI to admin List Jobs / Get Quote embeds

## IDs
- Supabase: `chqljfdmgdtsmbbwbdyv`
- Company: `00000000-0000-0000-0000-000000000001`

## Memory index
`doc/memory/00-INDEX.md`
