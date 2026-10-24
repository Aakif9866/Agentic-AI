# Course website

A Next.js + Tailwind front end for this repo. It has no content of its own: at build time it reads `../topics.md` (topics + prerequisites) and each `../Module N - */NOTES.md` (falls back to `README.md`), so editing the notes updates the site.

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in web/out — deploy to any static host
```

- Videos, courses, docs and papers per module: [`lib/resources.ts`](lib/resources.ts). Every link was checked on 2026-10-24: YouTube ids through oEmbed (title and channel), articles by HTTP status.
- Track grouping, taglines and status also live in `lib/resources.ts`.
- "Mark as complete" progress is stored in the browser's localStorage only.

## Deploy

- **Vercel (live: https://agentic-ai-course-flame.vercel.app):** `npx vercel build --prod && npx vercel deploy --prebuilt --prod` from `web/`. Prebuilt keeps the module `.env` files off Vercel, because only `web/.vercel/output` is uploaded.
- **Render Blueprint:** [`../render.yaml`](../render.yaml) defines this site plus Module 9's API. Render → New → Blueprint → this repo.
- `npm run build` crashing with a Turbopack panic means a stale cache: stop `npm run dev`, then `rm -rf .next out`.
