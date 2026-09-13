# ApnaTutor — Design Notes

Ye file record karti hai ke homepage ke design decisions kahan se aaye, taake baaki pages
(search results, tutor profile, dashboards) same tokens par banein.

## Tokens

| Cheez | Value | Source |
|---|---|---|
| Primary | `#0F766E` (teal-700) | `colors.csv` → "LMS" palette |
| Primary bright | `#0D9488` (teal-600) | fills/icons only — white text ke saath 3.74:1, normal text ke liye fail |
| Accent | `#D97706` amber, text `#92400E` | ratings, Featured badge |
| WhatsApp | `#0E7A6D` | WhatsApp brand green (`#25D366`) white text ke saath sirf 1.4:1 tha — darken kiya |
| Heading font | Lexend | `typography.csv` → "Corporate Trust" |
| Body font | Source Sans 3 | same pairing |
| Page pattern | Hero (search) → Categories → Listings → Trust → Tutor CTA | `landing.csv` → `marketplace-directory` |

**Purple se teal kyun?** Skill ka broad `--design-system` run purple + Playfair Display body
return kar raha tha — mood "luxury, editorial, poster". Ye ek trust-focused local
marketplace ke liye mismatch hai, aur Playfair italic body copy mixed Roman Urdu/English
mein parhne mein mushkil hoti. Targeted `--domain color` aur `--domain typography` searches
ne behtar match diye. Lexend specifically reading proficiency ke liye design kiya gaya hai —
education product ke liye sahi choice.

Raw skill output (purple version) `design-system/apnatutor/MASTER.md` mein padi hai agar
compare karna ho.

## Logo aur brand colors

Logo (`public/logo-mark.svg`, `src/components/Logo.astro`) ke apne teen rang hain:

| Cheez | Hex | Token |
|---|---|---|
| Navy | `#1F3A63` | `--brand-navy` |
| Green | `#2E9E5B` | `--brand-green` |
| Gold | `#C9A961` | `--brand-gold` |

**Ye UI ke rang nahi hain.** UI ka primary abhi bhi teal `#0F766E` hai. Wajah: teal
ke saare text/background pairs contrast-tested hain, aur brand ke teen rang laga kar
poora palette badalna matlab har pair dobara check karna. Logo apna rang rakhta hai,
UI apna — ye aam practice hai aur dono saath achay lagte hain (navy + teal ek hi
family ke hain, gold + amber bhi).

Agar kabhi poora palette brand ke mutabiq karna ho to `--primary` ko navy par shift
karna parega aur har pair ka contrast dobara calculate karna hoga (buttons, badges,
links, footer) — wo ek alag kaam hai, chalte chalte nahi hota.

**Do assets hain, jaan boojh kar:**
- `favicon.svg` — navy ground par bold mark. Chhoti size (16–32px) par patli detail
  gayab ho jati hai, isliye ye simplified hai aur solid background par hai.
- `logo-mark.svg` / `Logo.astro` — poora detailed mark (swoosh, kitab, pin, cap),
  header/footer ke liye jahan jagah hai.

Wordmark asli **text** hai, image nahi — select ho sakta hai, screen readers parh lete
hain, aur har screen par crisp rehta hai.

## Accessibility — jo verify ho chuka hai

- Saare text/background pairs **4.5:1 ya zyada** (computationally check kiye gaye)
- Har button/select **min 48px** height — 44px requirement se upar
- Tabs poora keyboard support: arrows, Home, End, `aria-selected`, `tabindex` management
- Form errors **field ke neeche**, top par nahi; `aria-invalid` + `aria-describedby`;
  submit par pehle galat field focus hota hai
- Focus rings kahin remove nahi kiye
- `prefers-reduced-motion` respect hota hai — animations skip, final state turant render
- 375 / 768 / 1440 par koi horizontal scroll nahi
- **Zero emoji as icons** — sab 60 icons inline SVG hain (business plan mein emoji the,
  wo production UI mein platform ke hisaab se badal jate hain aur screen readers unhe
  ajeeb parhte hain)

## Trust badges — implementation rule

Plan ki sabse important line yahi thi: *"jis cheez ko verify nahi kiya gaya, us par
Verified badge nahi lagayenge."* Isliye:

- 4 alag badges, har ek ka matlab Trust section mein **likha hua** hai
- Card 2 (Ayesha) par sirf 2 badges — qualification check nahi hua to badge nahi
- Card 3 (Bilal) naya tutor — "abhi koi review nahi" saaf likha hai, fake stars nahi
- Sirf teeno checks complete hone par "ApnaTutor Verified"
- Trust section mein legal callout: ApnaTutor tutors ko employ nahi karta, badges teaching
  quality ki guarantee nahi

## Safety (plan ke section 13 se)

- Parent ka number aur ghar ka address kahin public nahi
- Tutor ka phone number plain text mein display nahi — `/teacher/[slug]/contact` route se
  jata hai, taake tum rate-limit aur log kar sako
- WhatsApp `wa.me` deep link seedha card par nahi — warna scrapers saare numbers utha lenge

## Backend wiring

Do forms `console.log` karte hain, submit nahi. Wire karne ke liye:

- `form-find` → `GET /find-tutor?class=…&subject=…&area=…&budget=…`
  (JS mein commented line hai — uncomment kar do)
- `form-request` → `POST /request-tutor`

PHP/Laravel ke liye is file ko split karo: `header.php`, `hero.php`, `footer.php`.
`<style>` block ko `assets/css/app.css` mein nikaal do — tokens `:root` mein hain, isliye
baaki pages usi file ko include karke consistent rahenge. Koi build step nahi chahiye,
Namecheap shared hosting par as-is chalega.

## Jo abhi nahi bana

Homepage sirf pehla page hai. Plan ke section 19 ke mutabiq inka design abhi baqi hai:

- `/find-tutor` — search results + sidebar filters (board, gender, experience, availability)
- `/teacher/[slug]` — full profile + reviews
- `/tutor/dashboard` — leads inbox ("New Tuition Opportunity" card)
- `/admin` — tutor approval aur verification queue

Inme se jo chahiye batao, isi token system par bana dunga.
