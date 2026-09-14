// =============================================================================
// src/lib/promo-slots.ts — ishtihaar ki jagahon ki poori fehrist
//
// ★ Ye file WAAHID jagah hai jahan slot ka wajood hai. Component yahan se
//   padhta hai, aur admin panel ka dropdown bhi yahin se banta hai. Is ka
//   matlab: admin kabhi aisi jagah nahi chun sakta jo site par mojood hi
//   nahi — aur na hi koi page aisa slot maang sakta hai jo fehrist mein
//   nahi. Do alag list rakhte to ek din wo chupke se alag ho jatin.
//
// ★ SAFETY, PRIVACY, TERMS aur LOGIN par koi slot jaan boojh kar NAHI hai.
//   Jahan banda bharosay ki baat parh raha ho ya password daal raha ho,
//   wahan brand ka ad usi bharosay ko kha jata hai.
//
// ★ Tutor profile par slot verification badge ke ANDAR nahi, neeche alag
//   hai — warna log samajhte hain ke ApnaTutor us brand ki zimmedari le
//   raha hai.
// =============================================================================

/** Ad ki shakal. `banner` chauri tasveer, `card` site ke design jaisa box. */
export type PromoShape = 'banner' | 'card';

export interface PromoSlot {
  /** Firestore aur code — dono mein yahi id chalti hai. Kabhi na badlein. */
  id: string;
  /** Admin panel mein jo naam dikhega. */
  label: string;
  /** Admin ko batata hai ye jagah hai kahan. */
  where: string;
  /** Is jagah kaunsi shakal theek baithti hai. */
  shapes: PromoShape[];
  /**
   * Is jagah ek waqt mein zyada se zyada kitne ad dikh sakte hain.
   * Is se zyada active hon to bari bari aate hain.
   */
  max: number;
  /** Admin panel mein tarteeb — pehle wo jagahein jo zyada qeemti hain. */
  order: number;
}

export const PROMO_SLOTS: PromoSlot[] = [
  {
    id: 'request-thanks',
    label: 'Request ke baad (sab se qeemti)',
    where: 'Jab parent request post kar deta hai, "ho gaya" wale page par. Yahan banda kaam mukammal kar chuka hota hai, is liye tawajjo sab se zyada hoti hai.',
    shapes: ['card', 'banner'],
    max: 1,
    order: 1,
  },
  {
    id: 'home-hero',
    label: 'Homepage — upar, hero ke neeche',
    where: 'Homepage khulte hi pehli cheezon mein. Sab se zyada log yahi dekhte hain.',
    shapes: ['banner', 'card'],
    max: 1,
    order: 2,
  },
  {
    id: 'home-mid',
    label: 'Homepage — beech mein',
    where: 'Homepage par subjects aur tutors ke darmiyan.',
    shapes: ['banner', 'card'],
    max: 2,
    order: 3,
  },
  {
    id: 'search-inline',
    label: 'Search ke natayij mein',
    where: '/find-tutor par tutors ki list ke darmiyan. Yahan ad tutor card jaisa lagta hai, is liye "Ishtihaar" ka label lazmi hai.',
    shapes: ['card'],
    max: 1,
    order: 4,
  },
  {
    id: 'listing-top',
    label: 'Tutors ki list ke upar',
    where: '/teachers, aur har city aur subject ke page par, list shuru hone se pehle.',
    shapes: ['banner', 'card'],
    max: 1,
    order: 5,
  },
  {
    id: 'profile-side',
    label: 'Tutor ki profile par',
    where: 'Tutor ke page par, contact wale hissay ke neeche — verification badge se alag.',
    shapes: ['card'],
    max: 1,
    order: 6,
  },
  {
    id: 'dashboard-side',
    label: 'Dashboard par (parent aur tutor)',
    where: 'Login kiye hue logon ke dashboard par. Ye wo log hain jo bar bar aate hain.',
    shapes: ['card'],
    max: 1,
    order: 7,
  },
  {
    id: 'article-inline',
    label: 'Maloomat wale pages par',
    where: 'FAQ, "kaise kaam karta hai", "hamare baare mein" — matn ke beech mein.',
    shapes: ['card', 'banner'],
    max: 1,
    order: 8,
  },
  {
    id: 'footer-strip',
    label: 'Har page ke neeche patli patti',
    where: 'Poori site par footer se thora upar. Kam tawajjo, magar har page par.',
    shapes: ['card'],
    max: 1,
    order: 9,
  },
];

const BY_ID = new Map(PROMO_SLOTS.map((s) => [s.id, s]));

export function getSlot(id: string): PromoSlot | undefined {
  return BY_ID.get(id);
}

export function isSlotId(id: string): boolean {
  return BY_ID.has(id);
}

/** Admin panel ke dropdown ke liye — qeemti jagah pehle. */
export const SLOTS_IN_ORDER: PromoSlot[] = [...PROMO_SLOTS].sort((a, b) => a.order - b.order);
