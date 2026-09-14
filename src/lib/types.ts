// =============================================================================
// src/lib/types.ts — Firestore data model (docs/01-ARCHITECTURE.md §3)
//
// ★ Note: `Tutor` mein phone/whatsapp/email KABHI nahi hai — wo alag document
//   `tutors/{uid}/private/contact` mein hai. Agar kabhi is interface mein
//   phone add karne ka mann kare, ruk jao: build script usay static HTML mein
//   likh degi aur ek hi scrape mein saare numbers leak ho jayenge.
// =============================================================================

/**
 * Account ka role.
 *
 * `parent` aur `student` system mein ek hi tarah chalte hain — dono tutor
 * dhoondte hain, ek hi dashboard, ek hi rules ka raasta. Farq sirf ye hai ke
 * tuition kis ke liye hai.
 */
export type Role = 'parent' | 'student' | 'tutor';

export type TutorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Gender = 'male' | 'female';
/**
 * Teen tareeqe — gaon mein teeno chalte hain:
 *   home      teacher student ke ghar aata hai
 *   tutorhome student teacher ke ghar jata hai  ← gaon mein ye sabse aam hai
 *   online    video par
 */
export type Mode = 'home' | 'tutorhome' | 'online';

export interface TutorBadges {
  phoneChecked: boolean;
  idChecked: boolean;
  qualChecked: boolean;
}

export interface Tutor {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  city: string;
  areas: string[];
  subjects: string[];
  classes: string[];
  boards: string[];
  modes: Mode[];
  feeMin: number;
  feeMax: number;
  qualification: string;
  experienceYears: number;
  availability: string;
  bio: string;
  /** Card thumbnail (96px base64). Build time par `photos/{uid}` se aata hai. */
  photoUrl: string | null;
  /** Profile page ki poori photo (600px base64). Sirf profile page par. */
  photoFull?: string | null;
  status: TutorStatus;
  badges: TutorBadges;
  ratingAvg: number;
  ratingCount: number;
  featuredUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
}

export interface City {
  slug: string;
  name: string;
  nameUrdu?: string;
  district?: string;
  province?: string;
  /** Flat list — dropdowns aur filters yahi parhte hain. */
  areas: string[];
  /**
   * Wahi areas, union council ke hisaab se grouped — taake 200+ villages wala
   * dropdown qabil-e-istemal rahe. `scripts/import-areas.mjs` dono likhta hai.
   */
  areaGroups?: { unionCouncil: string; villages: string[] }[];
  /** 2–3 unique paragraphs. SEO page banane ke liye LAZMI — thin page gate isay check karta hai. */
  intro: string;
  /**
   * Har SEO combo page ka apna unique intro, page slug se keyed:
   *   { "home-tutor-risalpur": "…", "female-tutor-risalpur": "…" }
   *
   * Iske bagair wo variant page banta hi nahi (404 rehta hai). Wajah: agar
   * /home-tutor-risalpur aur /city/risalpur par wahi text ho to Google ke liye
   * wo doorway pages hain. Admin panel (/admin/content) se bharte hain.
   */
  pageIntros?: Record<string, string>;
}

export interface Subject {
  slug: string;
  name: string;
  nameUrdu?: string;
  intro: string;
}

export interface Review {
  id: string;
  tutorUid: string;
  /** parentUid build output mein nahi jata — fetch-data.mjs usay strip karti hai. */
  parentName: string;
  rating: number;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string | null;
}

export interface SubjectCount {
  slug: string;
  count: number;
}

export interface Stats {
  tutorCount: number;
  cityCount: number;
  subjectCounts: SubjectCount[];
  generatedAt: string;
  /** true = build ke waqt Firestore credentials nahi thay (khali data). */
  offline?: boolean;
}

/**
 * "ApnaTutor Verified" ek alag field nahi hai — teeno checks se DERIVE hota
 * hai. Alag field rakhne se wo teeno se out-of-sync ho sakti thi aur
 * "jo verify nahi hua us par badge nahi" wala core rule toot jata.
 * docs/01-ARCHITECTURE.md §3
 */
export function isFullyVerified(t: Pick<Tutor, 'badges'>): boolean {
  return Boolean(t.badges?.phoneChecked && t.badges?.idChecked && t.badges?.qualChecked);
}

/** Featured sirf tab jab `featuredUntil` abhi guzra na ho. */
export function isFeatured(t: Pick<Tutor, 'featuredUntil'>, now: Date = new Date()): boolean {
  if (!t.featuredUntil) return false;
  const until = new Date(t.featuredUntil);
  return !Number.isNaN(until.getTime()) && until > now;
}

// ---------------------------------------------------------------------------
// Promotions (ishtihaar)
// ---------------------------------------------------------------------------

/**
 * Ek ishtihaar.
 *
 * ★ Do shaklein hoti hain aur farq bara hai:
 *   - `banner`: brand ki apni tayar chauri tasveer.
 *   - `card`: site ke design jaisa box — logo, naam, ek line, ek button.
 *     Gaon ke chhote karobar ke paas designer nahi hota; unhein card hi
 *     bech sakte hain.
 *
 * ★ `image` build ke waqt banti hai. Firestore mein tasveer base64 mein
 *   `imageData` ke andar rehti hai (Spark par Storage nahi hai), aur
 *   fetch-data.mjs usay asli file bana kar /promos/ mein rakh deti hai.
 *   Is liye `imageData` KABHI build output mein nahi jata — warna har page
 *   ke HTML mein tasveer dobara chipak jati.
 */
export interface Promo {
  id: string;
  shape: 'banner' | 'card';

  /** Kaun sa brand. Public taur par card par dikhta hai. */
  brand: string;
  /** Card ka heading. Banner par sirf screen-reader ke liye. */
  title: string;
  /** Card ki ek line. Banner par istemal nahi hoti. */
  body?: string;
  /** Button ka matn, jaise "Dekhein" ya "WhatsApp karein". */
  ctaLabel?: string;
  /** Kahan le jaye — https:, tel:, ya wa.me ka link. */
  href: string;

  /** Build ke baad ka asli raasta, jaise "/promos/abc.jpg". */
  image?: string | null;
  /** Nabina logon ke liye tasveer ka bayan. */
  imageAlt?: string;
  /**
   * Tasveer ki asli chorai aur oonchai (upload ke waqt browser ne naapi).
   * Ye is liye rakhi jati hain ke page par tasveer ki jagah PEHLE se roki ja
   * sake — warna tasveer utarte hi neeche ka saara matn niche khisak jata hai.
   */
  imageW?: number;
  imageH?: number;

  /** Kin jagahon par chale. promo-slots.ts ki id's. */
  slots: string[];
  /** 1 se 10. Zyada wazan = bari zyada baar aati hai. */
  weight: number;

  active: boolean;
  /** ISO tareekh. null = aaj hi se. */
  startsAt: string | null;
  /** ISO tareekh. null = koi aakhri tareekh nahi. */
  endsAt: string | null;

  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Paison ka hisaab. Ye SIRF admin ke liye hai aur build output mein kabhi
 * nahi jata — warna brand ne kitne paise diye ye site ke HTML mein khula
 * parha ja sakta.
 */
export interface PromoBilling {
  contact?: string;
  amount?: number;
  paid?: boolean;
  notes?: string;
}

/** Ek din ke gine hue numbers. Admin panel mein dikhte hain. */
export interface PromoStat {
  /** "{promoId}__{YYYY-MM-DD}" */
  id: string;
  promoId: string;
  day: string;
  views: number;
  clicks: number;
}
