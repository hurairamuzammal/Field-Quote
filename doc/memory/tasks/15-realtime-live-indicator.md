# Realtime “live” indicator (§8.3)

**Status:** NOT STARTED  
**Scope:** `doc/FieldQuote.docx` §8.3  
**Guide:** `doc/MD-files/perform/07-realtime-cachebust-to-supabase-guide.md` (§4 live / `bubble_fn_live`)  
**Last updated:** 2026-08-23

---

## Paste for new chat (5–10 lines)
- Scope AC: bridge reconnects after network loss; a subtle **“live”** indicator reflects connection state.
- SessionKeeper JS already can call `bubble_fn_live(...)` on subscribe status — wire Bubble state + UI.
- Page state `s_realtime_live` (yes/no) ← Javascript to Bubble suffix `live`.
- Admin (and optionally tech) header: green/gray “Live” when subscribed / not.

---

## Goal
Admin sees at a glance whether Realtime is connected, without refreshing. Done when: connect → Live on; drop network / revoke → Live off or reconnect; lists still bust on events when live.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Source | `subscribe` callback → `bubble_fn_live` | Already in P07 pattern |
| UI | Subtle text/dot, not a modal | Scope: “subtle” |
| Pages | `admin_dashboard` first; tech optional | §8.3 is ops board |

## Done
- [ ] (none)

## Next
1. Confirm SessionKeeper HTML calls `bubble_fn_live` on `SUBSCRIBED` / others.
2. Toolbox element suffix `live` + Trigger event ON.
3. Workflow → Set Current page `s_realtime_live`.
4. Bind small “Live” / “Offline” indicator to that state.
5. Test: login → Live; DevTools offline → not live; online → recovers.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| `bubble_fn_live` undefined | Add Javascript to Bubble element before HTML runs |
| Always offline | JWT not passed to `realtime.setAuth` |
| Flickers | Only set state on actual status change |
