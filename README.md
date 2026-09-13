# ApnaTutor

Pakistan ke liye tutor marketplace. **Astro (SSG) → GitHub Pages · Firebase Spark (free).**

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
Photo    →  Firestore mein base64 (600px/96px)   →  koi aur service nahi
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
| 2 | Firestore rules tests — 79 tests, sab pass | ✅ |
| 3 | Public pages (SSG) + SEO combo pages | ✅ |
| 4 | Auth + tutor flows | ✅ |
| 5 | Parent flows + search + contact unlock | ✅ |
| 6 | Admin panel | ✅ |

Saare 6 phases mukammal. Launch gate [`docs/README.md`](docs/README.md) mein hai —
us ke bagair live na karo.

## Launch se pehle jo abhi baqi hai

Ye code ka kaam nahi — setup aur content ka hai:

1. Firebase project banayein (`docs/04-DEPLOY.md` §1), rules aur indexes deploy karein
2. Admin doc Firebase Console se haath se banayein — client se ban hi nahi sakta
3. GitHub secret sirf ek: `FIREBASE_SERVICE_ACCOUNT`. Firebase web config
   `src/lib/firebase.ts` mein pehle se committed hai (wo public hoti hai — asli
   protection rules aur App Check hain)
4. Cities aur subjects Firestore mein daalein, phir `/admin/content` se intro text likhein
   (har intro 120+ words aur har page ka apna — warna wo page banta hi nahi)
5. Apna asli tutor profile khud banayein aur khud approve karein — end-to-end test
6. GTM + GA4 + Meta Pixel lagayein, Preview mode mein events verify karein
7. Custom domain + HTTPS, phir Search Console aur Bing par sitemap submit
8. App Check 7 din Monitor mode mein, phir Enforce
9. Kam az kam **10 asli approved tutors** — phir launch
