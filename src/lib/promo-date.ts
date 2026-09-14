// =============================================================================
// src/lib/promo-date.ts — ishtihaar ki tareekh ka hisaab
//
// ★ Yahan Date ka moqabla KABHI Date se nahi hota — sirf "YYYY-MM-DD" shakal
//   ki lakeeron ka. Ye us bug ki wajah se hai jo asal mein pesh aaya:
//
//     Admin ne "14 September se" likha. Form ne usay 2026-09-14T00:00:00Z
//     bana kar rakha (UTC ki aadhi raat). Page par hisaab local aadhi raat
//     se lagta tha, jo Pakistan (UTC+5) mein 13 September 19:00Z banti hai.
//     13 Sept 19:00 < 14 Sept 00:00 — yani ad apni HI shuru ki tareekh par
//     "abhi waqt nahi aaya" keh kar chhup jata tha. Pakistan mein har aisa
//     ad apne pehle din ghayab rehta tha, aur UTC mein test karne par ye
//     kabhi nazar nahi aata.
//
//   Lakeeron ka moqabla is se mehfooz hai: "2026-09-14" >= "2026-09-14"
//   har jagah, har timezone mein sach hai. Aur tareekh waqai ek DIN hai,
//   ek lamha nahi — 14 tareekh Karachi mein bhi 14 tareekh hai.
//
// ★ PromoSlot.astro ka chhota inline script bilkul yahi do moqable haath se
//   karta hai (wo import nahi kar sakta — usay paint se pehle chalna hota
//   hai). Is liye wahan mantiq jaan boojh kar itna saada rakha gaya hai ke
//   ghalat hona mushkil ho, aur uske upar isi file ka hawala likha hai.
// =============================================================================

/** Aaj ki tareekh, BANDAY KE APNE din ke hisaab se: "YYYY-MM-DD". */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Kya ye ad is din chalna chahiye.
 *
 * Dono taraf ka din POORA ginta hai: "14 se 20 tak" ka matlab 14 ki subah se
 * 20 ki raat tak. Admin ne "20 tareekh tak" likha ho to 20 ko band kar dena
 * us se wada khilafi hoti.
 *
 * `startsAt`/`endsAt` poori ISO shakal mein bhi ho sakti hain (purana data)
 * aur sirf "YYYY-MM-DD" bhi — pehle das harf dono soorton mein wahi hain.
 */
export function isLiveOn(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  today: string = todayLocal()
): boolean {
  if (startsAt && today < startsAt.slice(0, 10)) return false;
  if (endsAt && today > endsAt.slice(0, 10)) return false;
  return true;
}
