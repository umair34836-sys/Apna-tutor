# ApnaTutor

Pakistan ke liye tutor marketplace. **Astro (SSG) → GitHub Pages · Firebase Spark (free) · Cloudinary.**

Poori specification [`docs/`](docs/) mein hai — koi bhi kaam shuru karne se pehle
[`docs/README.md`](docs/README.md) padho.

## Quick start

```bash
npm install
cp .env.example .env        # apni values daalo
npm run dev                 # http://localhost:4321
```

`.env` ke bagair bhi chalta hai — us surat mein Firestore se data nahi aata aur
site empty states dikhati hai. Ye jaan boojh kar hai: jhoota demo data kabhi nahi.

## Scripts

| Command | Kaam |
|---|---|
| `npm run dev` | Data fetch + dev server |
| `npm run fetch-data` | Firestore → `src/data/*.json` (Admin SDK, build time) |
| `npm run build` | Astro static build → `dist/` |
| `npm run validate-seo` | SEO gate — fail hone par build tor deta hai |
| `npm run build:full` | Teeno ek saath (jo CI karta hai) |
| `npm run test:rules` | Firestore rules tests (emulator par — Java chahiye) |
| `npm run check` | Astro + TypeScript type checking |

## Architecture ek nazar mein

```
Visitor  →  static HTML (GitHub Pages)          →  0 Firestore reads
Login    →  Firebase Auth                       →  free, 50k MAU
Action   →  Firestore, Security Rules ke peeche →  50k reads/day
Photo    →  Cloudinary unsigned preset          →  free tier
Build    →  GitHub Actions, cron har 6 ghante   →  Firestore → static HTML
```

Cloud Functions Spark plan par available nahi hain, isliye
[`firestore.rules`](firestore.rules) hi backend hai. Us file ko code se zyada
dhyan se parho.

## Teen rules jo kabhi nahi tootne chahiye

1. **Koi demo / mock / seed data nahi.** Count zero ho to empty state, jhoota number nahi.
2. **Phone number kabhi public document ya static HTML mein nahi.** `scripts/validate-seo.mjs` ise build time par pakadta hai.
3. **Trust badges sirf admin likh sakta hai.** Rules enforce karti hain; UI mein bhi disable.

## Build status

| Phase | Kaam | Status |
|---|---|---|
| 1 | Foundation — config, tokens, layout, lib, scripts, CI | ✅ |
| 2 | Firestore rules tests — 75 tests, sab pass | ✅ |
| 3 | Public pages (SSG) + SEO combo pages | ✅ |
| 4 | Auth + tutor flows | ⬜ |
| 5 | Parent flows + search + contact unlock | ⬜ |
| 6 | Admin panel | ⬜ |

Launch gate [`docs/README.md`](docs/README.md) mein hai — us ke bagair live na karo.
