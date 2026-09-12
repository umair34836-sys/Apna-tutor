// =============================================================================
// src/lib/types.ts — Firestore data model (docs/01-ARCHITECTURE.md §3)
//
// ★ Note: `Tutor` mein phone/whatsapp/email KABHI nahi hai — wo alag document
//   `tutors/{uid}/private/contact` mein hai. Agar kabhi is interface mein
//   phone add karne ka mann kare, ruk jao: build script usay static HTML mein
//   likh degi aur ek hi scrape mein saare numbers leak ho jayenge.
// =============================================================================

export type TutorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Gender = 'male' | 'female';
export type Mode = 'home' | 'online';

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
  photoUrl: string | null;
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
  areas: string[];
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
  parentUid: string;
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
