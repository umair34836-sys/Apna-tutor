# ApnaTutor

**Gunderi Payan (Nowshera)** ke liye tutor marketplace. **Astro (SSG) → GitHub Pages · Firebase Spark (free).**

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
| `npm run validate-links` | Har internal link base path ke andar hai? |

## Site kahan chalti hai

Custom domain abhi nahi hai, isliye site GitHub ke project page par hai:
**https://umair34836-sys.github.io/Apna-tutor/**

Iska matlab site `/Apna-tutor/` ke neeche chalti hai, root par nahi. Isliye har
internal link `url()` se guzarta hai (`src/lib/site.ts`) — seedha `href="/x"`
likhne par wo domain ki jar par chala jata hai aur 404 deta hai.
`npm run validate-links` build ke baad ye pakad leta hai.

**Domain lene ke baad:** repo → Settings → Secrets and variables → Actions →
Variables mein do cheezein set karein, aur bas —

```
PUBLIC_SITE_URL  = https://apnatutor.com
PUBLIC_BASE_PATH = /
```

CNAME file build khud bana leti hai jab domain github.io ka na ho.

## Areas — site kahan chalti hai

Site filhaal **sirf Gunderi Payan (Nowshera)** mein chalti hai. Poore Pakistan
ka daawa karna asaan tha, magar us se hota ye hai ke parent search karta hai
aur khali page milta hai. Ek gaon theek se cover karna behtar hai.

Ye daira ek hi jagah define hota hai — [`src/lib/site.ts`](src/lib/site.ts) ki
`SERVICE_AREAS` list:

```ts
export const SERVICE_AREAS: ServiceArea[] = [
  { slug: 'gunderi-payan', name: 'Gunderi Payan', district: 'Nowshera', … },
];
```

`src/lib/data.ts` is list ke bahar ka **sab kuch filter kar deti hai** — tutors
bhi, cities bhi. Isliye Firestore mein purana ya doosre sheher ka data mojood
ho to bhi site par nahi aata, aur "site ka daira" aur "data ka daira" kabhi
alag nahi ho sakte.

### Naya gaon add karna ho to

1. `SERVICE_AREAS` mein entry barhayein.
2. Firestore mein `cities/{slug}` ka `intro` likhein — 120+ words, unique.
   **Iske bagair us area ka SEO page nahi banega** (thin-page gate,
   `src/lib/seo.ts`). Ye jaan boojh kar hai.
3. Mohallay CSV se import kar lein.

### Mohallay

```bash
node scripts/import-areas.mjs data/areas-gunderi-payan.csv           # preview
FIREBASE_SERVICE_ACCOUNT='…' node scripts/import-areas.mjs data/areas-gunderi-payan.csv --write
```

**CSV ka `source` column khali ho to wo row import nahi hoti.** Ye jaan boojh
kar hai: dropdown mein ghalat gaon ka naam aana us gaon ke parents ka bharosa
toranay ke barabar hai. Gaon ke apne logon ki maloomat ke liye
`source=local-knowledge` bilkul kaafi hai.

### Aage ke areas (backlog)

[`data/areas-nowshera.csv`](data/areas-nowshera.csv) mein Nowshera aur Risalpur
ke 37 tasdeeq-shuda village naam pade hain. **Wo abhi live nahi hain** — jab
Gunderi Payan theek se cover ho jayega, agla area wahan se aayega. Poori mouza
list in mein se kisi ek source se milegi:

| Source | Kya milega |
|---|---|
| [FBR valuation table (Nowshera)](https://download1.fbr.gov.pk/SROs/20241029Nowshera1709.pdf) | **Sabse behtar** — Tehsil / Qanungoi / har Village-Mouza ka naam |
| [ETEA school list (Nowshera)](https://etea.edu.pk/esed_pst/Revised_Nowshera_Male.pdf) | Tehsil + Union Council + school ke naam (school aksar gaon ke naam par hote hain) |
| [LGKP notification](https://lgkp.gov.pk/wp-content/uploads/2015/04/DROs-ROs-AROS-notificationsGeneral-Seats.pdf) | District/Tehsil council wards |
| Patwari ya Tehsil office | Mouza record — sabse mustanad, aur local |

## Teaching modes — teen, do nahi

Gaon ki asli soorat-e-haal ye hai ke bachay **teacher ke ghar** parhne jate
hain. Isliye modes teen hain (`src/lib/taxonomy.ts`):

| slug | Matlab | SEO page |
|---|---|---|
| `home` | Teacher student ke ghar aata hai | `/home-tutor-{area}` |
| `tutorhome` | Student teacher ke ghar jata hai | `/tuition-at-tutor-home-{area}` |
| `online` | Video par | `/online-tutor-{area}` |

`tutorhome` ko `home` ke saath mila dena parent ko ghalat tutor tak le jata —
do bilkul alag cheezein hain. `firestore.rules` bhi teeno qabool karti hai.

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
