# ApnaTutor — Risks aur Limitations

Ye file un cheezon ke liye hai jo is architecture mein **maujood hain** aur khatam
nahi ho sakti. Inhe chhupana nahi — samajh kar plan karna hai.

---

## 1. GitHub Pages ka ToS — tumne accept kiya, lekin record ke liye

GitHub ki apni terms: Pages ko online business, e-commerce, ya kisi aisi website
ke liye free hosting ke taur par use karna allowed nahi hai jo primarily
commercial transactions facilitate karti ho. Sirf donation buttons aur
crowdfunding links jaisi monetization allowed hai. GitHub ye bhi kehta hai ke
Pages sites ko passwords jaisi sensitive transactions ke liye use nahi karna
chahiye.

Tumhare case mein:
- ✅ Parents ke liye site free hai, koi payment site par nahi hota
- ✅ Login Firebase Auth ke through hota hai — password GitHub ke servers se nahi
  guzarta, seedha Google ko jata hai over HTTPS
- ❌ Featured listings aur lead fees = commercial revenue
- ❌ Enforcement GitHub ki marzi par hai, aur agar hui to **bina warning** site
  band ho sakti hai

**Contingency plan (isay likh kar rakho):** agar GitHub site band kar de, ye
poora setup **Cloudflare Pages par ek deploy step badal kar** shift ho jata hai.
Astro build same, Firestore same, domain same. Down time ~30 minute. Cloudflare
Pages free hai, unlimited bandwidth, aur commercial use allowed hai.

Mera mashwara: jis din pehla paid featured listing bikay, usi hafte Cloudflare
par shift kar do. Tab tak risk chhota hai.

---

## 2. Verification documents — kabhi store na karo

Ye is poore document ka sabse ahem section hai.

**Kya na karo:** CNIC, B-Form, degree, ya kisi bhi shanakhti dastavez ki image
Cloudinary, Firestore, ya kahin bhi upload karna.

**Kyun:**
- Cloudinary ke URLs **public** hote hain. Ek URL leak = ek shanakhti dastavez
  leak
- Firestore mein base64 rakhna bhi bekaar hai — jis ke paas read access hai wo
  padh lega, aur 1 MB document limit bhi hai
- Pakistan mein CNIC copies identity fraud ka sabse aam zariya hain — SIM
  registration, bank accounts, loans
- Server nahi hai, isliye signed/expiring URLs bana bhi nahi sakte
- Tum abhi ek banda ho. Ek data breach ApnaTutor ko usi din khatam kar degi

**Kya karo:** WhatsApp par document maango → apni aankh se dekho → admin panel
mein boolean set karo → WhatsApp se message delete karo. Firestore mein sirf:

```
badges.idChecked : true
verifiedBy       : "admin-uid"
verifiedAt       : timestamp
verifyNote       : "CNIC dekha, naam match kiya — copy nahi rakhi"
```

Jo data tum store nahi karte, wo leak nahi ho sakta.

---

## 3. Scraping — mehdood kar sakte ho, rok nahi sakte

Server nahi hai, isliye asli rate limiting mumkin nahi.

**Jo bachav lagaya hai:**
- Phone number alag document mein, `connections/` ke peeche
- `connections/` banane ke liye login lazmi — matlab scraper ko har number ke
  liye account banana paregi
- Rules mein query limit 30 par capped — ek query mein 10,000 docs nahi nikal sakte
- App Check (reCAPTCHA v3) — scripted clients block karta hai
- Firebase Auth: naye account 100/hour per IP par capped

**Jo phir bhi mumkin hai:** ek determined banda accounts bana kar dhire dhire
numbers jama kar sakta hai.

**Monitoring:** hafte mein ek baar `connections` collection dekho. Agar ek uid ke
50+ connections hain aur koi request nahi, wo scraper hai — us account ko
`suspended` karo. Ye manual hai, lekin tumhare scale par kaafi hai.

---

## 4. Lead fan-out parent ke browser se hota hai

Server nahi hai, isliye jab parent request post karta hai to **uska browser hi**
matching tutors ke liye lead documents likhta hai.

**Masla:** ek parent theoretically bohat saari fake requests bana sakta hai.
Rules ye rok sakti hain ke wo doosre ki request ka fan-out kare, aur ye ke lead
mein parent ka phone na ho — lekin volume nahi rok sakti.

**Bachav:** client-side max 5 leads per request, App Check, aur admin panel mein
"aaj ki requests" ka count. Ghair-maamooli activity nazar aaye to account
suspend karo.

**Kab ye asli masla banega:** jab din ke 100+ requests hon. Us waqt tak tumhare
paas revenue hogi aur Blaze + ek Cloud Function affordable hoga.

---

## 5. Naye tutors 6 ghante tak static pages par nahi aate

Build-time pre-rendering ka seedha trade-off.

**Halka karne ka tareeqa:** admin panel mein "Rebuild now" button (GitHub Actions
`workflow_dispatch` API call). Tutor approve karo → button dabao → 2 minute mein
live. Tutor ko batao "24 ghante mein live" — phir jaldi live karke khush kar do,
ulta nahi.

---

## 6. Notifications nahi hain

Cloud Functions ke bagair email ya SMS nahi bhej sakte.

- Tutor ko lead ka pata tab chalega jab wo dashboard kholega
- Parent ko "tutor interested hai" ka pata tab chalega jab wo dashboard kholega

**Phase 1 ka jugaar:** tum khud WhatsApp karo. 40 requests/day tak ye ho sakta hai
aur asal mein **behtar** hai — personal touch tumhara differentiation hai, aur
tumhara plan bhi yahi kehta hai ke shuru mein manually match karo.

**Phase 2:** FCM web push (Spark par **free hai**). Tutor browser notification
allow kare to lead aane par push ja sakta hai — bina Functions ke, client se
client trigger nahi hota, lekin admin panel se bhej sakte ho.

---

## 7. Ratings ka average admin panel recompute karta hai

Functions nahi hain, isliye review approve karte waqt admin panel khud
`ratingAvg` aur `ratingCount` calculate karke tutor doc mein likhta hai.

**Khatra:** agar admin panel ka code buggy ho to ratings ghalat ho jayengi.

**Bachav:** ek `/admin/recompute-ratings` page banao jo saare tutors ke ratings
scratch se dobara calculate kare. Mahine mein ek baar chala dena.

---

## 8. Child safety — ye normal marketplace nahi hai

Platform bachon se related hai. Ye rules code mein enforce karo, policy mein nahi:

- **Student accounts nahi.** Sirf parent/guardian accounts. Signup par saaf likho
  ke 18 saal se kam umr wale account na banayein
- **Tutor aur student ke darmiyan koi direct messaging nahi.** Site par internal
  chat feature **na banao**. Rabta parent ke through, phone/WhatsApp par
- **Parent ka exact address kahin public nahi** — sirf area/sector
- **Tutor ki umr** profile mein maango (18+ verify karo onboarding par)
- **Report button** har profile aur review par
- Har profile par wo callout jo already `index.html` mein hai: ApnaTutor tutors
  ko employ nahi karta, badges teaching quality ki guarantee nahi, pehli class se
  pehle demo lein, chhote bachon ki tuition ke waqt ghar par kisi baray ki
  mojoodgi behtar hai

Ek bhi safety incident chhote market mein tumhara brand khatam kar sakta hai.
Isliye ye features "baad mein" wali list mein nahi hain.

---

## 9. Legal — jo karwana paregi

Main lawyer nahi hoon, ye legal advice nahi hai. Lekin ye cheezein launch se
pehle chahiye hongi:

- **Privacy Policy** — kya data jama karte ho, kyun, kitni der rakhte ho, kis ke
  saath share karte ho (Firebase/Google, Cloudinary, GA4, Meta). Ads platforms
  iske bagair approve nahi karte
- **Terms of Service** — saaf likho ke ApnaTutor ek introduction platform hai,
  tutors employees ya agents nahi hain, aur tuition ka arrangement parent aur
  tutor ke darmiyan hai
- **Cookie/consent banner** — GA4 + Meta Pixel chal rahe hain
- Pakistan mein data protection ka framework badal raha hai. Ek local lawyer se
  ek baar review karwana behtar hai — zyada mehnga nahi hota aur bachon wale
  platform par ye paisa theek kharch hai

---

## 10. Jab free tier chhota par jaye — asli signals

Ye dekho, guess na karo:

| Signal | Kya karna hai |
|---|---|
| Firestore reads > 35k/day (70%) | Firebase Console mein usage dekho, rules ke `get()` calls kam karo |
| `resource-exhausted` errors dikhein | **Blaze par jao, $10/month budget alert set karo.** Blaze par bhi free quota shamil hai — agar usage andar rahe to bill zero hi rahega |
| Cloudinary credits > 20/25 | Transformation `w_400` karo, purane pending photos delete karo |
| Ek city mein 500+ tutors | Algolia ya Typesense free tier par search shift karo |
| SMS OTP ki asli zarurat | Blaze lazmi. Pakistan SMS ~$0.02–0.05 per message — budget bana lo |
| Paid featured listings bikna shuru | Cloudflare Pages par shift karo (§1) |

Sabse ahem baat: **paisa quota par kharch karne se pehle tutor onboarding par
kharch hoga.** Jo cheez pehle tootegi wo Firebase nahi — tumhara waqt hai. 300
tutors manually verify karna is plan ka sabse mushkil hissa hai, aur uska koi
technical hal nahi.
