# ApnaTutor — Documentation

Production build ke liye complete specification. **Firebase Spark (free) +
GitHub Pages + Astro SSG.**

## Padhne ki tarteeb

| # | File | Kis ke liye |
|---|---|---|
| **00** | [BUILD-PROMPT](00-BUILD-PROMPT.md) | AI ko dene wala prompt — **yahan se shuru karo** |
| **01** | [ARCHITECTURE](01-ARCHITECTURE.md) | Constraints, data model, indexes, quota math |
| **02** | [PAGES-SPEC](02-PAGES-SPEC.md) | Har route ka spec + acceptance criteria |
| **03** | [SEO-ANALYTICS](03-SEO-ANALYTICS.md) | GTM, GA4, Google Ads, Meta Pixel, JSON-LD |
| **04** | [DEPLOY](04-DEPLOY.md) | Firebase, Actions, custom domain |
| **05** | [RISKS](05-RISKS.md) | Jo limitations maujood hain aur rahengi |
| ★ | [`../firestore.rules`](../firestore.rules) | **Poora backend** — sabse ahem file |
| — | [`../index.html`](../index.html) | Approved homepage design + tokens |
| — | [`../DESIGN-NOTES.md`](../DESIGN-NOTES.md) | Design decisions kahan se aaye |

## Ek nazar mein

```
Visitor  →  static HTML (GitHub Pages)        →  0 Firestore reads
Login    →  Firebase Auth                     →  free, 50k MAU
Action   →  Firestore, Security Rules ke peeche →  50k reads/day
Photo    →  Firestore mein base64             →  koi aur service nahi
Build    →  GitHub Actions, cron har 6 ghante →  Firestore → static HTML
```

**Kyun ye chalta hai:** browsing par ek bhi Firestore read nahi hota, kyunki sab
kuch build time par static HTML ban jata hai. Free tier sirf logged-in actions
par kharch hota hai — aur 300 tutors, 2,000 visitors/day par wo quota ka 11% bhi
nahi.

## Teen constraints jo poora design banate hain

1. **Cloud Functions nahi** (Spark) → Security Rules hi backend hain
2. **Cloud Storage nahi** (3 Feb 2026 se Blaze zaroori) → photos Firestore mein base64
3. **SMS OTP nahi** (Sep 2024 se Blaze zaroori) → manual phone verification

## Launch gate — in sab ke bagair live na karo

- [ ] Rules ke saare ❗ tests pass ([04-DEPLOY §1](04-DEPLOY.md))
- [ ] `/privacy` aur `/terms` live
- [ ] Kam az kam **10 asli approved tutors**
- [ ] GTM events verify
- [ ] Search Console + sitemap
- [ ] Tutor profile ke source mein phone number nahi
- [ ] Firestore khali karke test — empty states, jhoote numbers nahi
