# ApnaTutor — Build aur Deploy

---

## 1. Firebase project setup

1. Firebase Console → naya project `apnatutor-prod`
   **Spark plan par rehna — upgrade prompt skip karo**
2. Build → Firestore Database → Create → **production mode**
   Region: **`asia-south1` (Mumbai)** — Pakistan se sabse kam latency
   > Region ek baar set hota hai, phir badalta nahi. Ehtiyat se chuno.
3. Build → Authentication → Enable **Email/Password** aur **Google**
   - Settings → Authorized domains mein `apnatutor.com` aur `www.apnatutor.com` add karo
   - **Phone provider enable na karo** — Spark par kaam nahi karega, sirf
     confusion paida karega
4. Project Settings → General → Your apps → Web app add karo → config copy karo
5. Project Settings → App Check → Register web app → **reCAPTCHA v3** provider
   - Pehle **Monitor mode** mein chalao (7 din), phir Enforce
   - Ye scraping ke khilaf tumhara sabse asar-daar free tool hai

### Admin user banao

Tum khud sign up karo, phir Firestore mein haath se:

```
Collection: admins
Document ID: <tumhara Firebase Auth UID>
Fields:  email = "tum@apnatutor.com" (string)
         addedAt = <timestamp>
```

Ye document client se likha nahi ja sakta (rules mein `allow write: if false`).
Isay sirf Console se banate hain — yahi iska maqsad hai.

### Rules aur indexes deploy karo

```bash
npm i -g firebase-tools
firebase login
firebase init firestore     # rules + indexes files select karo
firebase deploy --only firestore:rules,firestore:indexes
```

### Rules test karo — ye optional nahi hai

Rules hi tumhara poora backend hain. Bina test deploy karna = darwaza khula
chhor dena.

```bash
firebase emulators:exec --only firestore "npm test"
```

Kam az kam ye cases likho (`@firebase/rules-unit-testing`):

- Logged-out banda `pending` tutor read nahi kar sakta
- Logged-out banda `tutors/{id}/private/contact` read nahi kar sakta
- Parent bina `connections` doc ke contact read nahi kar sakta
- Tutor apna `badges.idChecked` `true` nahi kar sakta ❗
- Tutor apna `status` `approved` nahi kar sakta ❗
- Tutor apna `featuredUntil` set nahi kar sakta ❗
- Tutor apna `ratingAvg` nahi badal sakta ❗
- Parent bina `connections` doc ke review create nahi kar sakta ❗
- Parent doosre parent ki request ka lead fan-out nahi kar sakta
- `parentPhone` wala lead create nahi ho sakta ❗
- Tutor lead ka `subject` field nahi badal sakta (sirf `status`)
- Ek parent ek tutor ko do reviews nahi de sakta
- 100-doc limit wali query reject ho (cap 30 hai)
- Non-admin `reports` read nahi kar sakta

❗ wale cases **lazmi pass** hone chahiye — inmein se ek bhi fail ho to trust
system bekaar hai.

---

## 2. Photos — koi setup nahi

Photos Firestore mein hi rehti hain, base64 ke taur par. **Na Cloud Storage, na
Cloudinary, na koi aur service** — is step mein kuch karna hi nahi hai.

Kaise kaam karta hai:

1. Tutor photo chunta hai → browser canvas par usay **600×600 (profile) aur
   96×96 (cards)** tak simat kar base64 JPEG bana leta hai
2. Wo `tutors/{uid}/private/photoSubmission` mein jati hai — private
3. Admin dekh kar approve karta hai → `photos/{uid}` mein aati hai, ab public
4. Build script build ke waqt usay tutor ke saath jor deta hai

Hisab: ek photo ~100 KB (thumb + full), Firestore free tier 1 GiB → ~10,000
profiles. Aur 1 MiB ka document cap? Rules 300,000 characters par rok deti hain,
yani cap ka taqreeban ek tihai.

> ### Kyun koi bahar ki service nahi
>
> Cloud Storage Spark plan par available nahi (3 Feb 2026 se Blaze zaroori), aur
> koi teesri service laane ka matlab ek aur account, ek aur dashboard, ek aur
> bill aur ek aur jagah jahan se data leak ho sakta hai. Poora backend Firebase
> hai — photos bhi wahin rehni chahiyein.

> ### 🚫 Verification documents kahin bhi nahi
>
> Ye pehle jaisa hi hai aur badla nahi: CNIC ya degree ki image **kahin** store
> nahi hoti — na Firestore mein, na kisi aur jagah. App mein aisa upload feature
> hai hi nahi.
>
> Process: tum WhatsApp par document maangte ho → apni aankh se dekhte ho →
> admin panel mein boolean set karte ho → **WhatsApp se message delete kar dete
> ho**. Firestore mein sirf `idChecked: true`, `verifiedBy`, `verifiedAt`.
>
> Jo data tum store nahi karte, wo leak nahi ho sakta.

## 3. Astro config

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://apnatutor.com',
  base: '/',                    // custom domain hai, isliye '/'
  output: 'static',
  trailingSlash: 'never',       // GitHub Pages par consistency ke liye ahem
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/tutor/dashboard') &&
        !page.includes('/tutor/leads') &&
        !page.includes('/parent/'),
    }),
  ],
  build: { format: 'file' },    // /about.html — GitHub Pages ke liye behtar
});
```

`public/CNAME`:
```
apnatutor.com
```

`public/.nojekyll` — khali file. Iske bagair GitHub Jekyll chalata hai aur
underscore se shuru hone wali files (`_astro/`) ignore kar deta hai. **Ye bhoolne
par site bina CSS load hoti hai** — aur ye sabse aam GitHub Pages bug hai.

---

## 4. Build-time data fetch

```js
// scripts/fetch-data.mjs
// GitHub Actions mein chalta hai, Admin SDK se Firestore padhta hai.
// Admin SDK reads Spark plan par bilkul kaam karti hain — sirf Functions
// deploy karne ke liye Blaze chahiye hota hai.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFile, mkdir } from 'node:fs/promises';

const app = initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = getFirestore(app);

const snap = await db.collection('tutors')
  .where('status', '==', 'approved')
  .get();

const tutors = snap.docs.map(d => {
  const t = { id: d.id, ...d.data() };
  // ★ Contact subcollection yahan kabhi na padho. Static HTML mein phone
  //   number chala jayega aur ek hi scrape mein sab leak ho jayega.
  delete t.photoPending;
  return t;
});

const cities   = (await db.collection('cities').get()).docs.map(d => ({ slug: d.id, ...d.data() }));
const subjects = (await db.collection('subjects').get()).docs.map(d => ({ slug: d.id, ...d.data() }));

await mkdir('src/data', { recursive: true });
await writeFile('src/data/tutors.json',   JSON.stringify(tutors));
await writeFile('src/data/cities.json',   JSON.stringify(cities));
await writeFile('src/data/subjects.json', JSON.stringify(subjects));

// Homepage ke ASLI counts — koi placeholder number nahi
await writeFile('src/data/stats.json', JSON.stringify({
  tutorCount: tutors.length,
  cityCount: new Set(tutors.map(t => t.city)).size,
  subjectCounts: subjects.map(s => ({
    slug: s.slug,
    count: tutors.filter(t => t.subjects.includes(s.slug)).length,
  })),
  generatedAt: new Date().toISOString(),
}));

console.log(`✓ ${tutors.length} tutors, ${cities.length} cities`);
```

---

## 5. GitHub Actions workflow

```yaml
# .github/workflows/deploy.yml
name: Build and deploy

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'      # har 6 ghante — naye approved tutors live
  workflow_dispatch:            # admin panel se manual trigger

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Firestore se data lao
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: node scripts/fetch-data.mjs

      - name: Build
        env:
          PUBLIC_FIREBASE_CONFIG:    ${{ secrets.PUBLIC_FIREBASE_CONFIG }}
          PUBLIC_GTM_ID:             ${{ secrets.PUBLIC_GTM_ID }}
          PUBLIC_GA4_ID:             ${{ secrets.PUBLIC_GA4_ID }}
          PUBLIC_META_PIXEL_ID:      ${{ secrets.PUBLIC_META_PIXEL_ID }}
          PUBLIC_CLOUDINARY_CLOUD:   ${{ secrets.PUBLIC_CLOUDINARY_CLOUD }}
          PUBLIC_CLOUDINARY_PRESET:  ${{ secrets.PUBLIC_CLOUDINARY_PRESET }}
          PUBLIC_RECAPTCHA_SITE_KEY: ${{ secrets.PUBLIC_RECAPTCHA_SITE_KEY }}
        run: npm run build

      - name: SEO gate — thin pages block karo
        run: node scripts/validate-seo.mjs
        # 3 se kam tutors wala page mila to yahan build TOOT jayegi.
        # Ye jaan boojh kar hai — doorway page penalty se bachne ke liye.

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### GitHub secrets chahiye

Repo → Settings → Secrets and variables → Actions:

| Secret | Kahan se |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service accounts → Generate key → **poori JSON** |
| ~~`PUBLIC_FIREBASE_*`~~ | **Ab zaroori nahi** — web config `src/lib/firebase.ts` mein committed hai (wo public hoti hai) |
| `PUBLIC_GTM_ID`, `PUBLIC_GA4_ID`, `PUBLIC_META_PIXEL_ID` | GTM / GA4 / Meta |
| `PUBLIC_RECAPTCHA_SITE_KEY` | App Check |

> Service account key ki poori access hoti hai. Repo **private** rakho. Agar
> public karna ho to ek read-only custom role wala alag service account banao.
>
> **Note:** GitHub Actions private repos par 2,000 minutes/month free deta hai.
> Har build ~2 minute, 4 builds/day = ~240 min/month. Aaram se andar hai.

---

## 6. Custom domain

1. Repo → Settings → Pages → Source: **GitHub Actions**
2. Custom domain: `apnatutor.com` → Save
3. Namecheap DNS:

```
A     @      185.199.108.153
A     @      185.199.109.153
A     @      185.199.110.153
A     @      185.199.111.153
CNAME www    <username>.github.io.
```

4. DNS propagate hone ke baad **Enforce HTTPS** tick karo (1–24 ghante)
5. `ApnaTutor.online` ko `.com` par 301 redirect kar do — Namecheap ke redirect
   feature se. Dono par same content **na** rakho, warna duplicate content issue
   banega

---

## 7. Pehli deploy ka order

Is tarteeb se karo, warna khud ko confuse karoge:

1. Firebase project + Firestore + Auth
2. `firestore.rules` + indexes deploy
3. **Rules ke tests likho aur pass karao** — aage na barho jab tak ye na ho
4. Admin doc Console se banao
5. Cities + subjects content Firestore mein daalo (intro text ke saath)
6. Astro project + pages banao
7. **Apna asli tutor profile khud banao, khud approve karo** — end-to-end flow
   test karne ke liye. Ye demo data nahi, ye asli pehla tutor hai
8. GTM + GA4 + Pixel lagao, Preview mode mein verify
9. GitHub secrets add karo
10. Deploy, custom domain, HTTPS
11. Search Console + Bing verify, sitemap submit
12. App Check Monitor mode → 7 din baad Enforce
13. Ab tutors onboard karna shuru karo

**Launch sirf tab jab:** `/privacy` aur `/terms` live hon, rules ke saare ❗ tests
pass hon, aur kam az kam **10 asli approved tutors** ho. 2 tutors ke saath launch
karna matlab pehla visitor "no tutor found" dekh kar wapas na aaye — aur
tumhara plan khud kehta hai ke yahi sabse bara khatra hai.
