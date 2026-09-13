# ApnaTutor — SEO, Analytics aur Ads

---

## 1. Google Tag Manager — sab kuch iske through

Seedha `gtag.js` na lagao. **GTM container lagao**, aur GA4, Google Ads aur Meta
Pixel sab uske andar se chalao. Wajah: kal jab naya pixel ya conversion tag chahiye
hoga, tumhe site rebuild + redeploy nahi karni paregi — GTM dashboard se ho jayega.

`src/layouts/Base.astro` ke `<head>` mein, **sabse upar**:

```html
<!-- Consent Mode v2 — GTM se PEHLE chalna chahiye -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  // EEA/UK traffic ke liye default denied. Pakistan GDPR mein nahi aata,
  // lekin Google Ads aur Meta dono EEA traffic par Consent Mode expect karte
  // hain — aur agar kabhi overseas Pakistani parents ko target karo to lazmi hoga.
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'region': ['EU','EEA','GB','CH','NO','IS','LI']
  });

  // Baqi duniya
  gtag('consent', 'default', {
    'ad_storage': 'granted',
    'ad_user_data': 'granted',
    'ad_personalization': 'granted',
    'analytics_storage': 'granted'
  });
</script>

<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
```

`<body>` ke foran baad:
```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

IDs `.env` mein rakho, code mein hard-code na karo:
```
PUBLIC_GTM_ID=GTM-XXXXXXX
PUBLIC_GA4_ID=G-XXXXXXXXXX
PUBLIC_META_PIXEL_ID=000000000000000
```

---

## 2. Event schema — inhi par ads ka poora system chalega

Ye exact events push karo. Naam badalna nahi — conversions, audiences aur
optimization sab inke naam par bandhe hain.

```js
// src/lib/analytics.ts
export function track(event: string, params: Record<string, any> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}
```

| Event | Kab | Params | Conversion? |
|---|---|---|---|
| `search_tutors` | search submit | `city, subject, class_level, results_count` | — |
| `view_tutor_profile` | profile page load | `tutor_slug, city, subject, is_featured` | — |
| `unlock_contact` | contact reveal | `tutor_slug, city, source` | ✅ **primary** |
| `whatsapp_click` | WhatsApp button | `tutor_slug, city` | ✅ |
| `call_click` | Call button | `tutor_slug, city` | ✅ |
| `request_start` | request form open | `entry_point` | — |
| `request_submit` | request created | `city, subject, class_level, budget_max, mode` | ✅ **primary** |
| `tutor_register_start` | step 1 | — | — |
| `tutor_register_complete` | profile submit | `city, subjects_count` | ✅ **primary** |
| `tutor_lead_interested` | "I'm Interested" | `city, subject` | — |
| `filter_applied` | filter change | `filter_name, filter_value` | — |
| `zero_results` | koi result nahi | `city, subject, class_level` | — |

> **`zero_results` sabse qeemti event hai.** Ye tumhe batata hai ke log kya
> dhoond rahe hain jo tumhare paas **nahi** hai. Yahi tumhari tutor recruitment ki
> priority list hai — har hafte ye report dekho.

Aur is data ko is tarah use karo: agar Islamabad mein "female chemistry tutor" 40
baar search hui aur har baar zero results, to Islamabad mein female chemistry
tutors onboard karna tumhara agla kaam hai. Ye guesswork se bohat behtar hai.

### GA4 mein setup
1. Admin → Events → in events ko **Mark as conversion** karo: `unlock_contact`,
   `request_submit`, `tutor_register_complete`, `whatsapp_click`, `call_click`
2. Custom dimensions banao: `city`, `subject`, `class_level`, `tutor_slug`
3. Audiences: "Searched but zero results", "Started request, didn't submit",
   "Tutor registration abandoned" — ye teeno retargeting ke liye sona hain

### GTM mein tags
- GA4 Configuration tag — All Pages
- GA4 Event tag — Custom Event trigger, event name `{{Event}}`
- Google Ads Conversion — `request_submit` aur `unlock_contact` par
- Meta Pixel Base — All Pages
- Meta Pixel Events: `Lead` ← `request_submit`, `Contact` ← `whatsapp_click`,
  `CompleteRegistration` ← `tutor_register_complete`

### Ek honest limitation

Server nahi hai, isliye **Meta Conversions API (server-side) aur GA4 Measurement
Protocol use nahi ho sakte**. Sirf browser-side pixel chalega. Matlab:
- iOS/Safari aur ad blockers par kuch conversions miss hongi (typically 15–30%)
- Attribution browser-side pixel par hi rahegi

Ye MVP ke liye qabool-e-qabool hai. Jab ad spend maani-khez ho jaye (say $200+/month),
tab Cloudflare Workers ke free tier par ek chhota CAPI endpoint bana sakte ho — tab
tak iski zarurat nahi.

---

## 3. JSON-LD structured data

### Har page par — `Base.astro` mein

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "ApnaTutor",
  "url": "https://apnatutor.com",
  "inLanguage": "ur-Latn-PK",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://apnatutor.com/find-tutor?subject={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

Plus `Organization` — logo, `areaServed: Pakistan`, `sameAs` (Facebook page).

### Tutor profile — `Person`

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Muhammad Ali",
  "jobTitle": "Mathematics Tutor",
  "url": "https://apnatutor.com/teacher/muhammad-ali-risalpur",
  "image": "https://res.cloudinary.com/...",
  "knowsAbout": ["Mathematics", "Physics"],
  "workLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Risalpur",
      "addressRegion": "Khyber Pakhtunkhwa",
      "addressCountry": "PK"
    }
  }
}
```

> ### ⚠️ `AggregateRating` sirf tab jab reviews ASLI hon
>
> `ratingCount > 0` ho tabhi `aggregateRating` emit karo. Zero reviews par fake
> rating markup **Google ki structured data policy ki khilaaf-warzi** hai, aur
> iska nateeja manual action hota hai — jismein tumhare saare rich results gayab
> ho jate hain. Build script mein ye condition hard-code karo, developer ki yaad
> par na chhoro.
>
> Aur kabhi apne aap reviews na likhna. Google isay pakadta hai, aur Pakistan ke
> chhote market mein parents bhi pakad lete hain.

### Baqi
- `BreadcrumbList` — har nested page par
- `FAQPage` — sirf `/faq` par, aur sirf un sawalon par jo page par waqai dikhte hain
- **`LocalBusiness` use na karna** — tutors registered businesses nahi hain, ye
  markup ghalat hoga

---

## 4. Head tags — har page

```html
<title>Home Tutors in Risalpur — Verified Math, Physics & English | ApnaTutor</title>
<meta name="description" content="Risalpur mein 12 verified home tutors. Class, subject aur budget ke hisaab se filter karein. Parents ke liye free.">
<link rel="canonical" href="https://apnatutor.com/home-tutor-risalpur">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://apnatutor.com/og/home-tutor-risalpur.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="ur_PK">
<meta name="twitter:card" content="summary_large_image">
```

Rules:
- Title 50–60 chars, **har page ka unique**, sheher/subject aage
- Description 140–160 chars, ismein **asli tutor count** likho — "12 verified
  tutors" "kaafi tutors" se zyada click laata hai
- Canonical hamesha absolute URL
- Filtered `/find-tutor?...` URLs par `noindex`
- OG images: build time par generate karo (`satori` ya `@vercel/og`), ya ek
  branded fallback image

---

## 5. robots.txt aur sitemap

`public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /tutor/dashboard
Disallow: /tutor/leads
Disallow: /parent/
Disallow: /find-tutor?

Sitemap: https://apnatutor.com/sitemap-index.xml
```

`@astrojs/sitemap` use karo. Filter: sirf indexable pages. Jab 50,000 URLs se
zyada ho jayein to plugin khud split kar deta hai — abhi ki fikar nahi.

### Search Console
1. Property add karo — **Domain property** (DNS TXT) behtar hai, `www` aur non-`www`
   dono cover karti hai
2. `sitemap-index.xml` submit karo
3. Bing Webmaster Tools par bhi karo — Search Console se import ho jata hai, 2
   minute ka kaam, aur Pakistan mein Bing/Edge traffic bekaar nahi hai
4. Launch ke pehle mahine **har hafte** Coverage report dekho — GitHub Pages par
   trailing-slash aur 404 ke masle aam hain

---

## 6. Core Web Vitals

Static HTML ki wajah se tum already aage ho. Jo bacha:

- **LCP** — hero mein koi bari image na ho. Font `display=swap` + preconnect
  (already hai). Target < 2.0s
- **CLS** — har image par `width`/`height`. Tutor cards ki photos par lazy
  loading, magar hero par nahi. Target < 0.1
- **INP** — Firebase SDK ko defer karo aur sirf un pages par load karo jahan
  chahiye. Homepage ko Firebase ki zarurat **nahi** hai (sab static hai) — usay
  wahan load hi na karo. Ye sabse bara performance win hai
- Photos base64 JPEG hain aur HTML mein hi baked — koi alag request nahi hoti.
  Size browser mein hi cap hoti hai: cards par 96px (~6 KB), profile par 600px

### GitHub Pages ki do limitations
1. **Custom HTTP headers set nahi kar sakte** — matlab asli CSP header nahi.
   `<meta http-equiv="Content-Security-Policy">` se kaam chalao (kamzor hai lekin
   kuch to hai)
2. **Cache-Control control nahi** — GitHub ke defaults hi chalenge

Dono bardasht ke qabil hain. Agar CSP header zaroori ho jaye to Cloudflare Pages
par shift karna ek deploy step badalne ka kaam hai.

---

## 7. Facebook / Meta Ads — do policy baatein

1. **Meta minors ko targeting par sakht hai.** Ads parents ko target karo (25–55,
   parent interests), students ko nahi. Creative mein bachon ki tasveerein use
   karte waqt ehtiyat — permission ke bagair kabhi nahi.
2. **Privacy Policy aur Terms live hone chahiye** ad review se pehle. Meta aur
   Google Ads dono inke bagair reject karte hain. Ye `/privacy` aur `/terms`
   optional nahi hain.

Landing pages: har campaign ko seedha us combo ke pre-rendered page par bhejo
(`/female-tutor-islamabad`), homepage par nahi. Landing page ka message ad ke
message se match karega → sasta CPC, behtar conversion.

---

## 8. Launch se pehle SEO checklist

- [ ] GTM container live, Preview mode mein saare events verify
- [ ] GA4 mein 5 conversions marked
- [ ] Google Ads + GA4 linked
- [ ] Meta Pixel Test Events se verify
- [ ] Search Console + Bing verified, sitemap submitted
- [ ] `/privacy` aur `/terms` live
- [ ] Consent banner kaam kar raha, Consent Mode signals ja rahe
- [ ] Har page ka unique title + description
- [ ] JSON-LD Rich Results Test se pass
- [ ] **Zero `AggregateRating` markup jahan asli review nahi**
- [ ] Koi `noindex` galti se production page par nahi
- [ ] Lighthouse: Performance 90+, SEO 100, Accessibility 95+
- [ ] `robots.txt` mein admin/dashboard blocked
- [ ] Thin-page gate chal raha (`validate-seo.mjs` build tor deta hai)
