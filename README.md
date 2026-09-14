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

## Firestore setup — ek baar ka kaam

`firestore.rules` aur `firestore.indexes.json` repo mein hone se **kuch nahi
hota**. Inhe Firestore par deploy karna parta hai. Ye na kiya ho to site
chalne mein aisi lagti hai jaise poori tooti hui ho:

| Kya nahi hua | Site par kya dikhta hai |
|---|---|
| Indexes deploy nahi huye | "Database ka setup abhi mukammal nahi hua (index nahi bana)" — search, leads, dashboards aur admin ki har list par |
| Rules deploy nahi huin | "Aapko is kaam ki ijazat nahi hai" — login theek hone par bhi |

Wajah ye hai ke jo bhi query `where` aur `orderBy` dono istemal karti hai usay
Firestore ka composite index chahiye, aur is site ki taqreeban har list wahi
karti hai. Ek page nahi — sab ek saath ruk jate hain.

### Deploy karne ka tareeqa

**Bina kuch install kiye (aasan raasta — phone se bhi ho jata hai):**

GitHub → **Actions** → **"Firestore rules aur indexes deploy"** → **Run workflow**

Iske liye `FIREBASE_SERVICE_ACCOUNT` secret hona zaroori hai — wahi secret
build bhi istemal karti hai (uske bagair site khali data ke saath banti hai,
yani koi tutor nazar nahi aata). Ek baar set karna parta hai:

1. **Firebase Console** → ⚙ Project settings → **Service accounts** →
   **Generate new private key**. Ek `.json` file download hogi.
2. Us file ka **poora text** copy karein — `{` se `}` tak, kuch chhora nahi.
   Phone par file ko `.txt` par rename kar lein, phir wo text app mein khul
   jati hai aur select-all kaam karta hai.
3. **GitHub** → repo → Settings → Secrets and variables → **Actions** →
   **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: wahi poora JSON
4. Ab Actions se workflow chala dein.

★ Ye file ek **private key** hai. Kisi ko bhejni nahi, kisi chat mein paste
nahi karni, aur repo mein commit to bilkul nahi (`.gitignore` ismein madad
nahi karega agar naam alag ho). Sirf GitHub Secrets mein.

Agar deploy "permission" ki wajah se ruke to service account ko **teen**
roles dene parte hain (Google Cloud Console → IAM → firebase-adminsdk-… wali
row → Edit → Add another role):

| Role | Kis liye |
|---|---|
| **Service Usage Consumer** | CLI deploy se pehle dekhta hai ke Firestore API on hai ya nahi |
| **Firebase Rules Admin** | rules likhne ke liye |
| **Cloud Datastore Index Admin** | indexes banane ke liye |

Default `firebase-adminsdk` service account ke paas teeno nahi hote — wo
Admin SDK ke liye bana hota hai, deploy ke liye nahi. Workflow fail hone par
ye list, service account ka email aur IAM ka seedha link khud print kar deta
hai, aur jo kami us run mein saaf nazar aayi wo alag se nishan-zada karta
hai.

**Ya apne computer se:**

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project apna-tutor-33bf3
```

Indexes ban'ne mein chand minute lag sakte hain (Console → Firestore → Indexes
par "Building" dikhega). Jab tak "Enabled" na ho jayein, wahi error aata
rahega.

### Ek index foran banana ho to

Firebase har nakaam query ke error mein us index ko banane ka seedha link deta
hai. Browser ka console kholein (F12 → Console) — `[firestore] Index nahi
bana` wali line mein wo link mojood hota hai. Us par click karne se Console
mein index pehle se bhara hua khul jata hai.

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

## "Ye page nahi mila" — kab aata hai aur kyun

Is site ke chaar raaste **data se** bante hain, file system se nahi:

| Raasta | Kab banta hai |
|---|---|
| `/teacher/{slug}` | tutor approved ho, aur uske baad ek build chali ho |
| `/city/{slug}` | 3+ tutors aur 120+ words ka intro |
| `/subject/{slug}` | wahi gate |
| `/{combo}` (SEO pages) | wahi gate |

Is liye ek waqfa hamesha rahega: tutor approve hote hi search results — jo
Firestore se **live** aate hain — uske profile par link karte hain, magar wo
page **agli build tak banta nahi**. Pehle wahan seedha 404 aata tha.

Ab `src/pages/404.astro` un raaston ko pehchanta hai (GitHub Pages har
un-mile path par wahi file deta hai):

- `/city/…`, `/subject/…`, aur SEO combo slugs → wahi filters laga kar
  `/find-tutor` par bhej deta hai
- `/teacher/…` → Firestore se dekhta hai ke tutor waqai mojood hai; ho to
  "profile abhi ban rahi hai" dikhata hai, warna aam 404

★ Combo slug torte waqt **urlSlug aur slug dono** chahiye (`class-9` → `9`),
warna redirect to ho jata hai magar filter kuch match nahi karta — aur wo
404 se bhi zyada uljhan wali baat hoti hai.

Tutor approve karne ke baad **/admin/rebuild** se build chala dein — us se
profile page ban jata hai aur ye waqfa khatam.

### Ye dobara na ho, is ke liye

`scripts/validate-links.mjs` ab teen check karta hai:

1. har HTML link base path ke andar ho
2. har HTML link kisi asli file par jaye
3. **source ka har `url('/kuch')` literal kisi bane hue page par jaye** —
   data wale raaste (`/teacher/`, `/city/`, `/subject/`) mustasna hain

Teesra check khaas taur par un links ke liye hai jo JS banata hai (search
results, dashboards, admin) — wo build ke waqt HTML mein hote hi nahi, is
liye pehle do check unhe kabhi nahi pakarte thay.

## App (PWA) — phone par install ho jati hai

Site ab **installable app** hai. Chrome/Edge par menu ka **"App install
karein"** dabane se ye phone par app ki tarah lag jati hai: apna icon, apni
window, browser ka address bar aur tabs ghayab. iPhone par Safari → Share →
**Add to Home Screen**.

| File | Kaam |
|---|---|
| `src/pages/manifest.webmanifest.ts` | naam, icons, rang, start URL |
| `src/pages/sw.js.ts` | service worker — offline aur tez loading |
| `src/pages/offline.astro` | signal na ho to yahi page dikhta hai |
| `public/icons/` | `scripts/make-icons.mjs` se bante hain |

### Service worker kya karta hai (aur kya nahi)

| Cheez | Tareeqa | Kyun |
|---|---|---|
| `/_astro/*` | cache-first | naam mein hash hai — badle to naam badal jata hai |
| HTML pages | **network-first** | cache-first hota to banda kal ka page dekhta, bina jane |
| icons waghaira | stale-while-revalidate | foran dikhe, peeche se taza ho jaye |
| Firebase, fonts | **bilkul haath nahi** | auth aur data ke beech mein khara hona kabhi acha khatma nahi hota |

Har build ka apna cache hai (`apnatutor-<timestamp>`), aur purana `activate`
par khud mit jata hai — naya deploy purani files le kar nahi baithta.

★ Icon ka `id` aur `start_url` kabhi na badlein. Phone isi se pehchanta hai ke
ye wahi app hai; badalne par install shuda app ka rishta toot jata hai.

### Icons dobara banane hon

```bash
node scripts/make-icons.mjs     # public/logo-mark.svg se
```

Bane hue PNG repo mein commit hote hain — CI ke paas Chromium nahi hai, aur
icon sirf tab badalta hai jab logo badle.

## Play Store par app — jab domain aa jaye

PWA ko Play Store ki asli app (`.aab`) banane ka tareeqa **TWA** hai —
Android app jo andar se yahi site chalati hai. Uske liye teen cheezein
chahiye:

1. **Apna domain** (misal `apnatutor.com`). Ye lazmi hai: TWA ko
   `https://DOMAIN/.well-known/assetlinks.json` chahiye — domain ki **jar**
   par, `/Apna-tutor/` ke neeche nahi. Us file se Android ko yaqeen hota hai
   ke app aur site ek hi malik ke hain; na ho to app ke andar browser ka URL
   bar dikhta rehta hai.
2. **Play Console account** — ek baar ki $25 fees.
3. **Bubblewrap** — Google ka apna tool:

```bash
npx @bubblewrap/cli init --manifest https://apnatutor.com/manifest.webmanifest
npx @bubblewrap/cli build
```

Domain se pehle ye qadam uthane ka faida nahi — assetlinks ke bagair app
adhoora lagta hai. Tab tak PWA install hi behtar raasta hai: koi fees nahi,
koi review nahi, aur update deploy karte hi pohanch jati hai.

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
