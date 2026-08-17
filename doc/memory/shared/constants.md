# Shared — constants & deploy

**Supabase ref:** `chqljfdmgdtsmbbwbdyv`  
**Company UUID:** `00000000-0000-0000-0000-000000000001`  
**Bubble app:** fieldquote (exports like `fieldquote-26446 (N).bubble`)  
**Public quote page (code fallback):** `https://fieldquote-26446.bubbleapps.io/version-test/q`  
**Live (no `/version-test/`):** `https://fieldquote-26446.bubbleapps.io/q` and `…/password_setup`

### Go-live: Bubble URLs in edge secrets
Code already reads env; **if the secret is unset, emails still use `version-test`.** Before deploying Live, set:

| Secret | Test (now) | Live (no version) |
|--------|------------|-------------------|
| `BUBBLE_PASSWORD_SETUP_URL` | `https://fieldquote-26446.bubbleapps.io/version-test/password_setup` | `https://fieldquote-26446.bubbleapps.io/password_setup` |
| `PUBLIC_QUOTE_PAGE_URL` | `https://fieldquote-26446.bubbleapps.io/version-test/q` | `https://fieldquote-26446.bubbleapps.io/q` |
| `PUBLIC_QUOTE_SUCCESS_URL` | `https://fieldquote-26446.bubbleapps.io/version-test/q-success` | `https://fieldquote-26446.bubbleapps.io/q-success` |

Used by: `invite-technician`, `resend-invite`, `request-password-reset`, `send-quote`, `create-checkout`.  
Not user-facing: `draft-quote` OpenRouter `HTTP-Referer` (`https://fieldquote-26446.bubbleapps.io`) — leave it.

## Deploy
```bash
npx supabase db push
npx supabase functions deploy <name> --no-verify-jwt
```

## Edge (common)
| Function | Notes |
|----------|--------|
| `submit-request` | Accepts `media` + `honeypot` (Bubble) |
| `draft-quote` | Z.AI primary → OpenRouter fallback; `zai_error` on fallback |
| `send-quote` / `resolve-quote-token` | Token delivery |
| `create-checkout` | Accept → Stripe; decline → status |
| `stripe-webhook` | Signature → payments + accepted + job (`--no-verify-jwt`) |
| `r2-presign` | Upload + GET |
| `set-technician-active` | Admin deactivate/reactivate; bans Auth user; unassigns future jobs |
| `complete-password-setup` | After invite/recovery Set Password; sets `profiles.active = true` (not if banned) |

## Secrets (names only)
`ZAI_API_KEY`, `ZAI_MODEL`, `ZAI_TEXT_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, R2, Resend, service role, `BUBBLE_PASSWORD_SETUP_URL`, `PUBLIC_QUOTE_PAGE_URL`, `PUBLIC_QUOTE_SUCCESS_URL` — see `P2-backend.md` §7
