# Admin dashboard — full-height responsive sidebar

**Status:** NOT STARTED  
**Guide:** Bubble only (no server deploy)  
**Last updated:** 2026-08-12

---

## Paste for new chat (5–10 lines)
- **admin_dashboard** sidebar should fill device height; **Company Settings** + **Admin** pinned to bottom; main nav stays top.
- Structure is already correct: **G: Sidebar Margin** (column, **Space between**) → **G: Sidebar Nav** + **G: Sidebar Bottom**.
- **Do NOT** set **Fill** on **G: Content** or **G: Main** — collapses to 0 height (parent has no defined height).
- **100%** min height also fails (G: Content parent height ≈ 0). **800px** min on G: Main works; target **`100vh`** on G: Main instead.
- Bubble export: `fieldquote-26446.bubble` (also `(7).bubble` in repo).

---

## Goal
Sidebar background and nav column span full viewport height on desktop (≥1100px) and mobile drawer (**FG: Sidebar devices**). **G: Sidebar Bottom** (Company + Admin) stays at the bottom via **Space between** on **G: Sidebar Margin**.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Pin bottom buttons | **Space between** on **G: Sidebar Margin** | Already in export; only works when margin group is tall enough |
| Page shell height | **G: Main** min height **`100vh`** (Fit height) | Fill/100% on Content/Main collapses; 800px proved parent height is the blocker |
| Nav / bottom groups | **Fit** height | Only wrap content; don’t grow |
| Sidebar column | **Fill** on **G: View**, **G: Sidebar Left**, **G: Sidebar Margin** | After Main has real min height |

## Done
- [x] Mapped element tree and current settings in export
- [x] Confirmed **Space between** already on **G: Sidebar Margin**

## In progress / next
1. **G: Main** → Height **Fit**, Min height **`100vh`** (if field rejects `vh`: Page min **`100vh`** → G: Content min **100%** → G: Main min **100%**)
2. **G: View** → Height **Fill**
3. **G: Sidebar Left** → Height **Fill**, Width Fixed **280px**
4. **G: Sidebar Margin** → Height **Fill**, Container alignment **Space between**
5. **G: Sidebar Nav** → Height **Fit** | **G: Sidebar Bottom** → Height **Fit** (remove any Fixed **280px** on Bottom)
6. Mirror steps 3–5 on inner sidebar inside **FG: Sidebar devices**; FG min height **100vh** or **Fill**, float Top + Left
7. Test Responsive tab: ≥1100px desktop + ≤1100px mobile drawer

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Fill on G: Content / G: Main → no space | Revert to **Fit**; never Fill these two |
| Min height **100%** → no space | Parent height is 0; use **`100vh`** on G: Main or page first |
| Min **800px** works but not responsive | Swap **800** → **`100vh`** |
| Space between doesn’t pin buttons | **G: Sidebar Bottom** still has Fixed 280px — set **Fit** |

## Bubble checklist
- [ ] G: Main min **100vh**
- [ ] G: View + sidebar chain **Fill** / **Fit** as above
- [ ] G: Sidebar Bottom not Fixed 280
- [ ] Mobile **FG: Sidebar devices** matched
- [ ] Preview ≥1100px and ≤1100px

## Test plan
- [ ] Desktop: green sidebar full screen height; Company + Admin at bottom
- [ ] Desktop: main content area scrolls independently if content is long
- [ ] Mobile: drawer same full-height + bottom buttons pinned
- [ ] Resize browser: sidebar tracks viewport (vh), not fixed 800px
