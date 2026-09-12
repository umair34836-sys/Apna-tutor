# ApnaTutor — Pages Spec

Har route ka rendering mode, data source, aur acceptance criteria. **SSG** = build
time par static HTML. **CSR** = browser mein Firestore se load hota hai. **Hybrid**
= static shell + client-side live data.

Language rule (poore site par):
- **Page titles, H1, meta description, URL slugs → English.** Log Google par
  "home tutor in Islamabad" likh kar search karte hain, "ghar par ustaad" nahi.
- **UI microcopy, buttons, labels, body text → Roman Urdu.** Yahi tumhare users
  ki zabaan hai.
- `<html lang="ur-Latn-PK">`

---

## Public routes

### `/` — Homepage · **SSG**

Base `index.html` already bana hua hai — usay Astro components mein todo, design
dobara na likho.

| Section | Data | Note |
|---|---|---|
| Hero + search form | static | Class/subject/area dropdowns `cities` + `subjects` se build time par |
| Trust strip | build-time counts | **Asli numbers.** `tutors` where status==approved ka count. 20 hain to "20 tutors" likho |
| Popular subjects | build time | Sirf wo subjects jinke 1+ approved tutor hain |
| Featured tutors | build time | `featuredUntil > now`, max 6. Koi featured nahi to newest approved dikhao |
| How it works, Trust, Tutor CTA | static | — |

Search form ka behaviour:
1. Agar select kiye combo ka pre-rendered page mojood hai (build time par ek JSON
   manifest banao) → seedha us static page par bhejo. Tez, free, SEO'd.
2. Warna → `/find-tutor?class=…&subject=…&area=…` par client-side query.

**Acceptance:** zero tutors wali city select karne par "Is area mein abhi koi
tutor nahi — request post karein" dikhe, khali grid nahi.

---

### `/find-tutor` — Search results · **Hybrid**

Static shell + filter sidebar; results client-side.

Query (Architecture §4 ki limitation ke mutabiq):
```js
query(collection(db, 'tutors'),
  where('status', '==', 'approved'),
  where('city', '==', city),
  where('subjects', 'array-contains', subject),
  orderBy('featuredUntil', 'desc'),
  limit(30))
```
Class, area, fee, gender, board, mode ka filter **client-side**.

Filters: City, Area, Class, Subject, Board, Gender, Mode, Fee range, Experience.
Mobile par filters ek bottom sheet mein — inline nahi.

**Acceptance:**
- URL mein saare filters (shareable + back button kaam kare)
- Loading skeleton, `limit` par pagination
- Zero results par: filters hatane ke suggestions + "request post karein" CTA
- `<meta name="robots" content="noindex">` — filtered URLs index nahi hone chahiye,
  warna duplicate/thin content ban jayega. Index sirf pre-rendered pages hon.

---

### `/teacher/[slug]` — Tutor profile · **Hybrid**

Har approved tutor ka apna static page. **Ye site ke sabse ahem SEO pages hain.**

Static content: naam, subjects, classes, area, qualification, experience, fee
range, availability, bio, badges, approved reviews, photo.

Client-side: "Contact dekhein" button.

Contact unlock flow:
1. Logged out → login prompt ("Number dekhne ke liye login karein")
2. Logged in → `connections/{uid}_{tutorId}` create karo
3. Phir `tutors/{tutorId}/private/contact` read karo → phone + WhatsApp dikhao
4. GA4 event `unlock_contact` fire karo

**Acceptance:**
- Phone number **kabhi** static HTML mein nahi — page source mein search karke check karo
- `ratingCount == 0` → "Abhi koi review nahi" + koi AggregateRating JSON-LD **nahi**
- Report button har profile par
- `Person` JSON-LD (SEO doc dekho)
- Tutor `suspended`/`rejected` ho jaye to next build par page delete ho aur
  sitemap se nikal jaye

---

### Pre-rendered SEO pages · **SSG**

| Pattern | Misal |
|---|---|
| `/city/[city]` | `/city/risalpur` |
| `/subject/[subject]` | `/subject/mathematics` |
| `/[subject]-tutor-[city]` | `/math-tutor-islamabad` |
| `/home-tutor-[city]` | `/home-tutor-risalpur` |
| `/female-tutor-[city]` | `/female-tutor-islamabad` |
| `/class-[n]-tutor-[city]` | `/class-9-tutor-peshawar` |
| `/[board]-tutor-[city]` | `/o-level-tutor-islamabad` |

> ### ⚠️ Doorway pages ka khatra — ye sabse ahem SEO rule hai
>
> Hazaron auto-generated patli pages banana Google ki nazar mein **doorway pages**
> hai, aur uski penalty poori site ko le doobti hai. Build script mein ye gate
> **lazmi** hai:
>
> - Page sirf tab bane jab us combo ke **3+ approved tutors** hon
> - Har page par kam az kam **120 words unique text** ho (`cities/{slug}.intro`
>   aur `subjects/{slug}.intro` se) — sirf naam badal kar wahi template nahi
> - 3 se kam tutors → page banao hi na; us URL ko 404 rehne do
>
> `scripts/validate-seo.mjs` ye check karta hai aur fail hone par **build tor deta
> hai**. Isay bypass na karna.

Phase 1 mein 2 cities × 6 subjects hain — matlab 30–50 asli pages, hazaron nahi.
Ye theek hai. Pages tutors ke saath saath barhenge.

---

### Baqi public pages · **SSG**

| Route | Content |
|---|---|
| `/request-tutor` | Request form (client-side submit) |
| `/teachers` | Saare approved tutors, paginated |
| `/how-it-works` | Parents + tutors ke liye alag sections |
| `/safety` | Badge definitions, safety policy, report kaise karein |
| `/faq` | FAQPage JSON-LD ke saath |
| `/about`, `/contact` | — |
| `/privacy`, `/terms` | **Launch se pehle lazmi.** Google Ads aur Meta Ads dono review par reject karte hain agar ye nahi hon |
| `/404` | GitHub Pages ke liye `404.html` |

---

## Auth routes · **CSR**

| Route | Kaam |
|---|---|
| `/login` | Email/password + Google. Error messages Roman Urdu mein |
| `/signup` | Role chuno: parent ya tutor. `users/{uid}` create karo |
| `/forgot-password` | Firebase password reset (Spark: 150 emails/day — kaafi) |

**Acceptance:** `sendEmailVerification()` signup par. Email verify na hone tak
tutor profile submit na kar sake — ye sabse sasta spam filter hai.

---

## Tutor routes · **CSR** (login required)

### `/tutor/register` — profile banao
Multi-step, ek waqt ek step:
1. Basic — naam, gender, city, areas
2. Teaching — subjects, classes, boards, modes
3. Experience — qualification, experience, bio
4. Fee + availability
5. Contact — phone (`tutors/{uid}/private/contact` mein jata hai)
6. Photo — optional, Cloudinary upload → `private/photoSubmission`
7. Review & submit → `status: 'pending'`

**Acceptance:**
- Submit ke baad saaf message: "Profile review ke liye bhej di gayi hai. Hum 24–48
  ghante mein check karke aapko WhatsApp par batayenge."
- Pending profile public search mein **na** aaye
- Draft localStorage mein save ho — 7-step form mein data khona sabse bari
  drop-off ki wajah hai

### `/tutor/dashboard`
Profile status, leads summary, views (GA4 se, na ke Firestore counter se — writes bachao).

### `/tutor/leads` — leads inbox
`where('tutorUid','==',uid).where('status','==','new').orderBy('createdAt','desc')`

Har lead card: class, subject, area, mode, budget, timing. **Parent ka number nahi.**
Buttons: `I'm Interested` / `Not available`.

**Acceptance:** "Interested" ke baad saaf likha ho: "Parent ko bata diya gaya hai.
Agar unhe aapki profile pasand aayi to wo aapse rabta karenge." — jhoota wada nahi
ke parent zaroor call karega.

### `/tutor/profile` — edit
Trust fields read-only, saaf batao kyun: "Verification badges ApnaTutor team set
karti hai." Rules bhi enforce karti hain, lekin UI mein bhi disable karo.

---

## Parent routes · **CSR** (login required)

| Route | Kaam |
|---|---|
| `/parent/dashboard` | Requests + unlocked tutors |
| `/parent/requests` | Har request ke saath interested tutors ki list |
| `/parent/requests/[id]` | Interested tutors; parent decide kare kisko number de |
| `/parent/saved-tutors` | `connections` se |

---

## Admin routes · **CSR** (admin only)

Wahi static site, `/admin/*` par. Rules hi asli protection hain — UI hide karna
kaafi nahi. Add `<meta name="robots" content="noindex">`.

| Route | Kaam |
|---|---|
| `/admin` | Queue counts: pending tutors, pending reviews, open reports |
| `/admin/tutors` | Approval queue. Profile dekho → Approve / Reject (wajah ke saath) / Suspend |
| `/admin/tutors/[id]/verify` | Teen badge toggles: phone, identity, qualification |
| `/admin/reviews` | Approve/reject. **Approve par `ratingAvg` + `ratingCount` recompute karo** (Functions nahi hain, admin panel hi ye karega) |
| `/admin/reports` | Reports queue |
| `/admin/featured` | `featuredUntil` set karo (manual payment ke baad) |
| `/admin/content` | Cities/subjects ka intro text — SEO pages ke liye |
| `/admin/rebuild` | GitHub Actions `workflow_dispatch` trigger — approval ke foran baad live |

### Verification workflow (manual, aur jaan boojh kar manual)

1. Tutor profile submit karta hai → `pending`
2. Tum uske number par WhatsApp/call karte ho → number chala? → `phoneChecked: true`
3. Tum WhatsApp par CNIC ki photo mangte ho, **dekh kar delete kar dete ho** →
   `idChecked: true`
4. Degree/certificate isi tarah → `qualChecked: true`
5. Teeno true → UI khud "ApnaTutor Verified" derive kar leta hai
6. Approve → next build (ya manual rebuild) par live

> **Documents kahin save nahi hote.** Sirf boolean, date, aur kisne check kiya.
> Wajah `05-RISKS.md` §2 mein — ye legal masla hai, technical nahi.

**Acceptance:** badge toggle par ek audit line likho (`verifiedBy`, `verifiedAt`)
taake baad mein pata rahe kis ne kab kya approve kiya.

---

## Cross-cutting requirements

Har page par lagoo:

1. **Design tokens `src/styles/tokens.css` se.** Koi naya hex code component mein
   nahi. `index.html` ke tokens already contrast-tested hain.
2. **Contrast 4.5:1 minimum.** Naya color add karo to check karo.
3. **Touch targets 44×44px minimum.**
4. **Har input par asli `<label>`.** Placeholder label nahi hota.
5. **Errors field ke neeche**, page ke top par nahi. `aria-invalid` +
   `aria-describedby`.
6. **Focus rings kabhi remove nahi.**
7. **`prefers-reduced-motion` respect.**
8. **Koi emoji as icon.** Inline SVG only.
9. **Har async action ke 3 states:** loading, success, error. Firestore fail ho
   sakta hai — "Kuch masla hua, dobara koshish karein" dikhao, khali screen nahi.
10. **Quota-exceeded handling.** Firestore free limit khatam hone par
    `resource-exhausted` error aata hai. Usay pakdo aur saaf message do, na ke
    tooti hui screen.
11. **Koi demo data nahi.** Count zero ho to empty state, jhoota number nahi.
