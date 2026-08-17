# Multi-Image Upload Flow — Simplified, Step-by-Step Sequence

No batching, no extra states beyond the two you need. This is the complete, final version — replaces everything from the earlier draft.

---

## The two things you need to build, in order

1. **A custom event** called `Upload Next Photo` — this does the actual work, one photo at a time, and calls itself again until every photo is done.
2. **One trigger** — `MultiFileUploader's value is changed` — this only *starts* the process. It does not upload anything itself.

Everything else in this document is just the detail of what goes inside those two things.

---

## Setup — two custom states on the page

| Name | Type | Purpose |
|---|---|---|
| `s_photo_keys` | list of texts | Fills up with one entry per successfully uploaded photo |
| `s_upload_index` | number | Tracks which photo (0, 1, 2, 3, 4) we're currently uploading |

That's all the state you need. No other custom states for this feature.

---

## Setup — two API Connector calls (both plain, single-file, no arrays)

**`Get R2 Upload URL`** — Action, POST, body:
```json
{"fileName": <fileName>, "contentType": <contentType>, "fileSize": <fileSize>, "kind": <kind>}
```

**`Upload File to R2`** — Action, PUT, Body type = File, URL = a placeholder for now (you'll override it dynamically every time you use it).

---

## The actual sequence of events, in plain order

Here is exactly what happens, in order, when a person selects 3 photos:

**Moment 1 — they select 3 files.**
→ This fires `MultiFileUploader's value is changed`.
→ That workflow does nothing except reset everything and kick off the loop:

| Step | What it does |
|---|---|
| 1 | Set `s_upload_index` to `0` |
| 2 | Set `s_photo_keys` to an empty list |
| 3 | Trigger the custom event `Upload Next Photo` |

That's the *entire* job of this trigger — three steps, no uploading happens here.

**Moment 2 — `Upload Next Photo` runs for the first time (index = 0).**

| Step | What it does |
|---|---|
| 1 | Call `Get R2 Upload URL`, describing photo #0 (the first file in the list) |
| 2 | Call `Upload File to R2`, sending photo #0's actual bytes to the URL Step 1 just returned |
| 3 | Add the object key from Step 1 into `s_photo_keys` |
| 4 | Change `s_upload_index` from `0` to `1` |
| 5 | Check: is `1` less than `3` (the total number of files)? Yes → trigger `Upload Next Photo` again |

**Moment 3 — `Upload Next Photo` runs again (index = 1).**
Same 5 steps, but now working on photo #1. Ends with `s_upload_index` = `2`, and triggers itself again.

**Moment 4 — `Upload Next Photo` runs a third time (index = 2).**
Same 5 steps, working on photo #2 (the last one). Ends with `s_upload_index` = `3`.
Step 5's check: is `3` less than `3`? **No** — so it does *not* trigger itself again. The loop stops here, naturally, on its own.

**Result:** `s_photo_keys` now has 3 entries, one per uploaded photo, and the loop is finished.

---

## Building `Upload Next Photo` — exact fields for each step

Create this as a **Custom Event** (Workflow tab → Custom Events → New custom event → name it `Upload Next Photo`). Add 5 steps inside it:

**Step 1 — `Get R2 Upload URL`**
- `fileName` → `MultiFileUploader's list of files:item #Page's s_upload_index's name`
- `contentType` → `MultiFileUploader's list of files:item #Page's s_upload_index's MIME type`
- `fileSize` → `MultiFileUploader's list of files:item #Page's s_upload_index's size`
- `kind` → type the plain text `image`

**Step 2 — `Upload File to R2`**
- URL → `Result of step 1's url`
- Body → `MultiFileUploader's list of files:item #Page's s_upload_index`

**Step 3 — Set state**
- Element → the page
- State → `s_photo_keys`
- Action → **add an item to the list**
- Value → `Result of step 1's objectKey`
- Condition: **Only when** `Result of step 2` has no error

**Step 4 — Set state**
- Element → the page
- State → `s_upload_index`
- Value → `Page's s_upload_index + 1`

**Step 5 — Trigger custom event**
- Event → `Upload Next Photo` (itself)
- Condition: **Only when** `Page's s_upload_index < MultiFileUploader's list of files:count`

That last condition is the whole "stop when done" logic — nothing else controls when the loop ends.

---

## Building the starting trigger — exact fields

Workflow tab → new workflow → Trigger: `MultiFileUploader's value is changed`. Add 3 steps:

1. Set state: page's `s_upload_index` = `0`
2. Set state: page's `s_photo_keys` = empty list *(if Bubble asks for a value, use "Reset this input" style — set it to an empty list expression, or simply skip this step the first time and only include it if you find old photo keys lingering after re-selecting files)*
3. Trigger custom event: `Upload Next Photo`

---

## What "Send" does — separate, later, does no uploading itself

By the time someone clicks Send, every photo is already uploaded and its key is sitting in `s_photo_keys`. Send just reads that finished list and hands it to `submit-request` along with the text description — it does not touch the Multi-file Uploader or these upload steps at all.
