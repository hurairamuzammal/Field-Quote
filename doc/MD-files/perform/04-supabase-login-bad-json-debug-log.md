# Supabase Login — `bad_json` Debugging Log

## Intro

FieldQuote (Bubble app) authenticates against Supabase via the API Connector, following the "Auth Wiring Guide (Option A)." Every other call built from that guide (`Refresh Token`, `Get My Role`, etc.) works. The `Login` call — `Auth - Sign In`, `POST /auth/v1/token?grant_type=password` — fails every time it's triggered from a real workflow, even though "Reinitialize call" in the API Connector succeeds with hardcoded test values.

## What's been implemented so far

- Part 1–6 of the guide are built: RLS policy migration, Bubble User fields + privacy rules, login/admin/tech/reset pages, the `Finish Login` custom event, the `Button Log In` / `Button Log In is clicked` workflow (Sign In → set page states → Bubble account log-in → trigger `Finish Login`), SessionKeeper, and logout.
- The `Login` API Connector call is configured as:
  - `POST https://chqljfdmgdtsmbbwbdyv.supabase.co/auth/v1/token?grant_type=password`
  - Headers: `apikey` (shared, not private), `Content-Type: application/json`
  - Body (JSON), current state — **no quotes around placeholders**:
    ```json
    {
        "email": <email>,
        "password": <password>
    }
    ```
  - Body Parameters test values (used only for Reinitialize): `"admin@example.com"`, `"Admin2026"` — quoted, as the guide specifies for init-only values.
  - "Include errors in response and allow workflow actions to continue" — **unticked** (intentional, per guide).
- The workflow step (`Button Log In is clicked` → Step 1 `Supabase - Login`) passes:
  - `email = Input Email (Log in)'s value:formatted as JSON-safe`
  - `password = Input Password (Log in)'s value:formatted as JSON-safe`
- Response type from a successful initialize includes `access_token`, `refresh_token`, `expires_in`, `user.id`, etc. — confirmed via the raw JSON schema Bubble generated.

## The problem

Every live run of the `Login` call (via `Button A` / `Button Log In`) returns:

```
HTTP 400 — bad_json
"Could not parse request body as JSON: invalid character 'a' after object key:value pair"
```

Because "Include errors..." is correctly unticked, this halts the workflow immediately — no tokens are set, no custom states populate, and the workflow falls into `Unhandled error` → sign-up attempt (condition fails) → log the user out → dead end.

`Reinitialize call` in the API Connector, using the same credentials typed as quoted test values, returns `200` with a full valid session. Only the **live workflow-triggered** call fails.

## Solutions tried (chronological)

| # | Attempted fix | Result |
|---|---|---|
| 1 | Confirmed `:formatted as JSON-safe` is present on both `email`/`password` in the workflow step | No change — was already correct |
| 2 | Added quotes into the Body template (`"email": "<email>"`) and stripped quotes from Body Parameter test values | Error persisted, same message |
| 3 | Investigated whether test was hitting stale/cached **Live** version instead of edits | Ruled out — testing was already happening on `version-test`, which reflects Development edits immediately |
| 4 | Checked for a duplicate `Login` call under the same API group | Only one call named `Login` found |
| 5 | Reverted Body template back to **no quotes** (current state, confirmed via screenshot) | Error persisted, identical message |
| 6 | Confirmed via screenshot that the workflow step's `email`/`password` fields are wired to `Input ... 's value:formatted as JSON-safe` (not a hardcoded literal string) | Confirmed correct — rules out a stray literal quoted value in the workflow step itself |

Across all of these, the **exact same error text** — `invalid character 'a' after object key:value pair` — has recurred, regardless of whether the template had quotes or not.

## Root cause — current assessment

The specific wording `invalid character 'a' after object key:value pair` (not `looking for beginning of value`) is diagnostic: Go's JSON parser (which Supabase/PostgREST uses) only produces this exact message when it has successfully parsed a **complete value** for a key, then hits an unexpected character where it expects a comma or `}`. The only way to get precisely `'a'` there is if the parsed value was an **empty string `""`**, immediately followed by unquoted text starting with `a` (`admin@example.com`) — i.e., the actual bytes sent are something like:

```json
"email": ""admin@example.com""
```

This means **double-quoting is happening at the byte level**, on every single test — including the most recent one where the visible Body template has no quotes at all. That's the unresolved puzzle: the visible template text alone cannot explain a persistent double-quote result once the template itself is unquoted.

The leading working theory is that **the raw "Body (JSON object)" text box is not the literal source Bubble serializes from.** When a Body Parameter is explicitly added below the template (as `email` and `password` are here, via "Add parameter"), Bubble may be constructing the actual outgoing payload from the **Body Parameters table** — auto-quoting string-type parameter values — rather than doing a literal string substitution into the text shown in the preview box. If that's true:

- `:formatted as JSON-safe` returns an already-quoted, escaped string (this is disputed — Bubble's documented behavior is that it only escapes special characters, but the persistent double-quote symptom is the strongest evidence we have that it's behaving as if it *does* add quotes in this context), **and**
- Bubble's own parameter-substitution layer *also* wraps the string-type parameter in quotes independently of the template,

then the two quoting layers stack regardless of what's written in the visible template box — which would fully explain why editing the template in either direction (quoted or unquoted) made no measurable difference.

This has not yet been confirmed with certainty — it's the most consistent explanation across six rounds of otherwise-inexplicable identical failures, not a verified fact.

## Recommended next step (to get a definitive answer, not another guess)

Stop editing blind. Capture the **actual raw bytes** Bubble sends:

1. Go to a tool like `https://webhook.site` and copy the unique URL it gives you.
2. Temporarily change the `Login` call's endpoint URL to that webhook.site URL (keep headers/body exactly as-is).
3. Run the `Button Log In` workflow once.
4. Open webhook.site and look at the **raw request body** it captured — this is exactly what left Bubble's servers, with no Supabase error-message interpretation in between.
5. If you see `""admin@example.com""` (double-quoted) → confirms the double-quoting theory. Fix: remove `:formatted as JSON-safe` entirely and rely on Bubble's own parameter quoting (leave the workflow fields as plain `Input Email's value` / `Input Password's value`, no formatting operator), keeping the Body template unquoted.
6. If you instead see something unexpected and different (e.g. an extra field, wrong content-type, truncated body) → that's a different bug entirely, and the webhook capture will show it directly.
7. Once confirmed working via webhook.site, switch the URL back to the real Supabase endpoint and retest the full login workflow.

This single step replaces the last several rounds of trial-and-error with a direct look at the actual request — it's the fastest way to stop guessing and get a fix that's verified rather than theorized.

---

## Update — `bad_json` resolved, new symptom appeared

### Status: original problem fixed

Pointing the `Login` call at `httpbin.org/post`, then switching back to the real Supabase URL and reinitializing, produced a **clean, successful run**: `Finished running action`, no error, and the response headers included `sb-auth-user-id` / `sb-auth-session-id` — both only present on a genuine successful Supabase auth response. The `bad_json` error has not reoccurred since. Whatever combination of edits finally cleared the double-quoting is holding.

### What's confirmed working now

- `Supabase - Login` completes successfully and returns real tokens when the workflow actually runs end to end.
- The button on the page believed to be a separate "Button A" was confirmed to be **the same button** as `Button Log In` — not a duplicate/stale workflow as suspected. That theory is ruled out.
- The detailed 6-step `Button Log In is clicked` → `Finish Login` → `Unhandled error` (sign-up fallback) architecture, as spelled out in the full workflow spec provided, matches the intended design from the original guide (Parts 4.1–4.3).

### New problem: inconsistent / missing log entries

Symptom, in the person's own words: clicking the login button **sometimes produces no server log entry at all** — not an error, not a success, nothing — even immediately after a page refresh. Other times the workflow runs and exits after Step 1 in a way that doesn't match a consistent pattern.

### Ruled out so far

- **Duplicate button/workflow** — confirmed there's only one button, one workflow attached to it.
- **Wrong log environment (Live vs. Development)** — was an issue earlier (caught and corrected once), but has been checked since.
- **The underlying API call being broken** — confirmed working when it does run.

### Current working hypotheses (unconfirmed)

1. **The click isn't reaching Bubble's server at all in some attempts.** Possible causes: an overlapping/transparent element intercepting the click (e.g. a loading group, an invisible group that hasn't fully hidden), a leftover "Add a breakpoint in debug mode" toggle left on from earlier debugging (this pauses execution and can look like "nothing happened" if not noticed), or the button's click handler being disabled by a stray `Only when` condition on the workflow's trigger event itself (not the individual steps — the top-level event condition).
2. **A timing/race issue**, possibly related to the debug `Set state` step added earlier during the httpbin investigation — if that step (or its target element/state) still exists but references something now invalid, it could silently abort the workflow before it logs anything, depending on Bubble's error-handling for a broken reference at that point.
3. **Bubble's log search UI itself lagging or filtering unpredictably** — worth ruling out by widening the search time window generously (several minutes before and after the click) rather than a tight window, since narrow windows have already caused false "0 logs" readings once in this session.
4. **Browser-level issue** — a JS error on the page (from the earlier Toolbox/debug additions) silently breaking Bubble's own click-event dispatch before the workflow trigger fires. This would show in the browser console (F12 → Console tab), not in Bubble's server logs, since a broken click never reaches the server.

### Recommended next diagnostic steps

1. **Open the browser console (F12) before clicking the button.** If clicking produces console errors, that's likely why some clicks never reach the server — fix the JS error first (often from a leftover debug element).
2. **Remove the temporary debug `Set state` step and `debug_raw` custom state** added during the httpbin investigation — it's no longer needed now that the raw body issue is resolved, and it's a plausible source of the new intermittent behav8ior.
3. **Check the workflow's top-level trigger** (`Button Log In is clicked` — click the event itself, not a step inside it) for any `Only when` condition that might be silently blocking some clicks.
4. **Confirm "Add a breakpoint in debug mode" is switched off** on every step in this workflow — a stray breakpoint left on from earlier debugging pauses execution silently in preview/live and can look exactly like "nothing happened."
5. **Widen the log search window** to several minutes before/after each test click, rather than a tight 5-minute window, to rule out the log UI itself as the cause of "0 entries."
6. Once the above are checked, do **one clean, isolated test**: hard-refresh the page, open the console, click once, and capture both the console output and a wide-window server log in the same pass — this avoids the back-and-forth of separate inconsistent attempts.
