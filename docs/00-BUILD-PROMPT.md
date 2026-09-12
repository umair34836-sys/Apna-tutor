# ApnaTutor — Build Prompt

Ye file kisi AI coding agent (Claude Code, Cursor, ya koi bhi) ko dene ke liye
hai. Repo mein `docs/` folder, `firestore.rules` aur `index.html` mojood hone
chahiye, phir neeche wala hissa paste karo.

Ek hi baar sab build karwane ki koshish na karna. Neeche 6 phases hain — **ek
phase, ek session.** Har phase ke baad khud test karo, phir agla.

---

## Paste karne wala prompt

````
Tum ApnaTutor bana rahe ho — Pakistan ke liye ek tutor marketplace. Poori
specification is repo ke `docs/` folder mein hai. Koi bhi code likhne se pehle
ye char files padho:

  docs/01-ARCHITECTURE.md   — constraints, data model, indexes, quota math
  docs/02-PAGES-SPEC.md     — har route ka spec aur acceptance criteria
  docs/03-SEO-ANALYTICS.md  — GTM, GA4, Meta Pixel, JSON-LD, sitemap
  docs/04-DEPLOY.md         — Astro config, GitHub Actions, Firebase setup
  docs/05-RISKS.md          — jo limitations maujood hain
  firestore.rules           — ★ ye poora backend hai, dhyan se padho
  index.html                — approved homepage design + design tokens

## Stack (fix hai, change na karna)

- Astro 5, static output (`output: 'static'`)
- Vanilla TypeScript + Firebase JS SDK v10+ (modular). Koi React/Vue nahi
- Plain CSS with custom properties — tokens `index.html` se lo. Koi Tailwind nahi
- Firebase Spark (free) — Firestore + Auth + App Check
- Cloudinary unsigned upload — photos ke liye
- GitHub Pages, custom domain apnatutor.com

## Non-negotiable constraints

1. **Koi server-side code nahi.** Firebase Spark plan par Cloud Functions
   available nahi hain. Har authorization Firestore Security Rules mein hai. Agar
   kisi feature ke liye server chahiye, use na banao — pehle mujhse poocho.

2. **Koi demo, mock, seed, sample ya placeholder data nahi.** Ye sabse ahem rule
   hai. Agar Firestore khali hai to UI empty state dikhaye ("Is area mein abhi
   koi tutor nahi — request post karein"). Kabhi jhoote tutors, jhooti reviews,
   ya jhoote counts ("148 tutors") na banao. Homepage ke saare numbers build time
   par asli Firestore data se aate hain. `index.html` mein jo sample tutor cards
   aur counts hain wo **design reference** hain — unhe copy na karna, wo
   `src/data/tutors.json` se render hone chahiye.

3. **Phone number kabhi public document ya static HTML mein nahi.** Tutor ka
   contact `tutors/{uid}/private/contact` mein hai. Build script usay padhti hi
   nahi. Agar kisi page ke source mein phone number nazar aaye, wo bug hai.

4. **Trust fields (`badges`, `ratingAvg`, `ratingCount`, `featuredUntil`,
   `photoUrl`, `status`) sirf admin likh sakta hai.** Rules enforce karti hain;
   UI mein bhi disable karo aur wajah likho.

5. **`AggregateRating` JSON-LD sirf jab `ratingCount > 0`.** Zero reviews par
   rating markup Google ki policy ki khilaaf-warzi hai.

6. **SEO combo page sirf jab 3+ approved tutors hon.** `scripts/validate-seo.mjs`
   ye check kare aur fail hone par build tor de. Doorway page penalty se bachna hai.

7. **Verification documents (CNIC, degree) ke liye upload feature banao hi na.**
   Sirf profile photo ka upload. Wajah `docs/05-RISKS.md` §2 mein.

8. **Koi emoji as icon.** Sirf inline SVG. `index.html` mein 60 icons pehle se hain.

9. **Koi internal chat/DM feature nahi.** Platform bachon se related hai —
   `docs/05-RISKS.md` §8 dekho.

10. **Har naya color contrast-check karo.** Minimum 4.5:1 normal text par. Tokens
    already tested hain, naya hex add karne se pehle calculate karo.

## Language

- Page titles, H1, meta descriptions, URL slugs → **English** (SEO ke liye)
- UI labels, buttons, body copy, error messages → **Roman Urdu**
- `<html lang="ur-Latn-PK">`

## Kaam karne ka tareeqa

- Har phase ke shuru mein pehle plan batao, phir likho
- Har page ke baad `docs/02-PAGES-SPEC.md` ke acceptance criteria ke khilaf khud
  check karo aur nateeja batao
- Firestore query likhte waqt `docs/01-ARCHITECTURE.md` §4 ki
  single-`array-contains` limitation yaad rakho
- Har async action ke teen states: loading, success, error. Firestore ka
  `resource-exhausted` error bhi handle karo (free quota khatam hone par aata hai)
- Agar spec mein kuch ambiguous ho ya kisi constraint se takra raha ho, **ruk kar
  poocho** — apna faisla khud na karo

## Phases

### Phase 1 — Foundation
Astro project setup, `astro.config.mjs`, `public/CNAME`, `public/.nojekyll`,
`public/robots.txt`, `src/styles/tokens.css` (`index.html` se), `src/layouts/
Base.astro` (head tags + GTM + Consent Mode + JSON-LD slot), `src/lib/firebase.ts`
(SDK init + App Check), `src/lib/analytics.ts` (dataLayer helper),
`scripts/fetch-data.mjs`, `scripts/validate-seo.mjs`, `.github/workflows/
deploy.yml`, `firestore.indexes.json`.
**Deliverable:** `npm run build` chal jaye aur khali data ke saath bhi deploy ho.

### Phase 2 — Rules tests
`@firebase/rules-unit-testing` ke saath `docs/04-DEPLOY.md` §1 ki poori test list.
**Saare ❗ wale tests pass hone chahiye.** Aage na barho jab tak ye na ho.

### Phase 3 — Public pages (SSG)
Homepage (`index.html` ko Astro components mein todo — design dobara na likho),
`/teacher/[slug]`, `/city/[city]`, `/subject/[subject]`, saare SEO combo patterns,
`/teachers`, `/how-it-works`, `/safety`, `/faq`, `/about`, `/contact`,
`/privacy`, `/terms`, `404.html`, sitemap, JSON-LD.

### Phase 4 — Auth + tutor flows
`/login`, `/signup`, `/forgot-password`, `/tutor/register` (7-step, localStorage
draft), `/tutor/dashboard`, `/tutor/leads`, `/tutor/profile`. Cloudinary photo
upload.

### Phase 5 — Parent flows
`/request-tutor`, `/find-tutor` (client-side search + filters + bottom sheet on
mobile), `/parent/dashboard`, `/parent/requests`, `/parent/requests/[id]`,
`/parent/saved-tutors`, contact unlock flow, review submission.

### Phase 6 — Admin panel
`/admin`, `/admin/tutors`, `/admin/tutors/[id]/verify`, `/admin/reviews` (ratings
recompute ke saath), `/admin/reports`, `/admin/featured`, `/admin/content`,
`/admin/rebuild` (GitHub Actions workflow_dispatch), `/admin/recompute-ratings`.

Phase 1 se shuru karo. Pehle plan batao.
````

---

## Har phase ke baad khud ye check karo

Ye AI par na chhoro — apni aankh se dekho:

1. **View Source** kholo kisi tutor profile par — `Ctrl+F` karke phone number
   dhoondo. Milna nahi chahiye.
2. Ek test tutor account banao, `badges.idChecked` ko browser console se `true`
   karne ki koshish karo. **Permission denied** aana chahiye.
3. Firestore khali karke build karo. UI empty states dikhaye, khali grid ya
   jhoote numbers nahi.
4. Ek page par 2 tutors rakho — build **toot jani chahiye** (SEO gate).
5. Lighthouse chalao: Performance 90+, SEO 100, Accessibility 95+.
6. GTM Preview mode mein saare events verify karo.
7. Mobile par 375px width — koi horizontal scroll nahi.
8. Keyboard se poori site navigate karo — focus hamesha nazar aaye.

Koi bhi check fail ho to agle phase par na jao.

---

## Ek choti si nasihat

Is documentation mein jo constraints likhe hain wo kisi ne mehnat se nahi, balke
Firebase aur Google ki asli limitations se nikle hain. Jab AI (ya tum) kabhi
sochein ke "ye rule thoda dheela kar dein taake kaam jaldi ho jaye" — sabse zyada
khatarnaak teen yahi hain:

- Demo data daal dena ("baad mein hata denge") — phir hatana bhool jate ho aur
  asli users ko jhoote tutors dikhte hain
- Phone number public doc mein rakh dena ("asaan ho jayega") — ek scrape mein sab
  leak
- Trust badge ka check hata dena ("admin panel baad mein banayenge") — tutors khud
  ko verified mark kar lenge

Baqi sab cheezein baad mein theek ho sakti hain. Ye teen nahi.
