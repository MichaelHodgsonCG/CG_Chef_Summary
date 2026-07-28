# Charcoal Group brand assets

The official logo artwork lives here and is imported as a module by
`src/components/Logo.tsx` (Vite bundles it through its asset pipeline).

| File | Used for |
|------|----------|
| `cg-mark.png` | The boxed **CG** monogram — sidebar rail, app bar, login |
| `cg-wordmark.png` | The full **Charcoal Group Restaurants** wordmark — login screen |

Notes:

- **Imported, not referenced by URL.** This project sets `publicDir: false` in
  `vite.config.ts`, so files under `public/` are **not** served. Assets must be
  imported (`import markUrl from '../assets/cg-mark.png'`), which is exactly what
  `Logo.tsx` does.
- **To swap the artwork**, replace these files (keep the same filenames) — no
  code change needed. If you change extensions, update the imports in `Logo.tsx`.
- **Transparent background** (PNG with alpha or SVG). Black artwork is fine: on
  the dark sidebar the mark is rendered white via a CSS `invert` filter, and
  shown as-is on light surfaces.
- If an image fails to load, the components fall back to a built-in SVG
  rendition so the UI never shows a broken image.
