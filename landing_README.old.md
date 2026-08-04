FieldQuote landing

- Vercel: set the Project "Root Directory" to `landing` to deploy this static landing page.
- The page expects the project logo to be available at `/logo-full.png` in the deployed static root.
- If you prefer, copy the repo's root `public/logo-full.png` into `landing/` or `landing/public/` before deploying.

Quick local test:

```sh
# serve the landing folder (e.g. with Python)
python3 -m http.server --directory landing 3000
# then open http://localhost:3000
```
