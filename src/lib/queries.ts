// =============================================================================
// src/lib/queries.ts — saari Firestore queries ek jagah
//
// Do wajah se sab yahan hai:
//   1. Rules har list query par `limit` cap lagati hain (tutors 30, baqi 50).
//      Bina limit ki query poori reject ho jati hai. Ek jagah likhne se ye
//      galti mumkin nahi rehti.
//   2. Quota 50,000 reads/day hai. Kaun kitna padh raha hai, ye ek file mein
//      dekh kar samajh aata hai.
// =============================================================================

import { getFirebase } from './firebase';
import type { Tutor, TutorStatus } from './types';

export const LIST_CAP = 50;      // rules: leads, requests, connections, users
export const TUTOR_CAP = 30;     // rules: tutors, reviews

// ---------------------------------------------------------------------------
// Tutor profile
// ---------------------------------------------------------------------------

export interface TutorDraft {
  slug: string;
  name: string;
  gender: 'male' | 'female';
  city: string;
  areas: string[];
  subjects: string[];
  classes: string[];
  boards: string[];
  modes: ('home' | 'online')[];
  feeMin: number;
  feeMax: number;
  qualification: string;
  experienceYears: number;
  availability: string;
  bio: string;
}

export async function getMyTutorProfile(uid: string): Promise<Tutor | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tutor) : null;
}

/**
 * Nayi tutor profile. Trust fields yahan hard-coded khali jate hain — rules
 * bhi yahi check karti hain, aur dono jagah hona jaan boojh kar hai: UI galti
 * kare to rules rok degi, rules kabhi badlein to UI galat data na bheje.
 */
export async function createTutorProfile(uid: string, draft: TutorDraft): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  await setDoc(doc(db, 'tutors', uid), {
    ...draft,
    status: 'pending',
    badges: { phoneChecked: false, idChecked: false, qualChecked: false },
    ratingAvg: 0,
    ratingCount: 0,
    photoUrl: null,
    featuredUntil: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedAt: null,
  });
}

/**
 * Profile edit. `status`, `badges`, `ratingAvg`, `ratingCount`, `featuredUntil`,
 * `photoUrl`, `slug` aur `createdAt` yahan se bhejna hi nahi — rules unhe
 * reject kar dengi aur poora update fail ho jayega.
 */
export async function updateTutorProfile(
  uid: string,
  patch: Partial<Omit<TutorDraft, 'slug'>>
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'tutors', uid), { ...patch, updatedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Contact — alag document, kyunki rules field-level nahi hotin
// ---------------------------------------------------------------------------

export interface Contact { phone: string; whatsapp: string; email: string }

export async function getMyContact(uid: string): Promise<Contact | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', uid, 'private', 'contact'));
  return snap.exists() ? (snap.data() as Contact) : null;
}

export async function setMyContact(uid: string, contact: Contact): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc } = await import('firebase/firestore');
  // Rules: sirf ye teen keys, aur phone ^\+92[0-9]{10}$
  await setDoc(doc(db, 'tutors', uid, 'private', 'contact'), {
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    email: contact.email,
  });
}

// ---------------------------------------------------------------------------
// Photo — tutor submit karta hai, admin approve karke photoUrl set karta hai
// ---------------------------------------------------------------------------

export interface PhotoSubmission { url: string; publicId: string }

export async function getMyPhotoSubmission(uid: string): Promise<PhotoSubmission | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', uid, 'private', 'photoSubmission'));
  return snap.exists() ? (snap.data() as PhotoSubmission) : null;
}

export async function setMyPhotoSubmission(uid: string, photo: PhotoSubmission): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  // Rules: sirf url/publicId/submittedAt, aur url Cloudinary ka hona chahiye.
  await setDoc(doc(db, 'tutors', uid, 'private', 'photoSubmission'), {
    url: photo.url,
    publicId: photo.publicId,
    submittedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Leads — tutor ka inbox
// ---------------------------------------------------------------------------

export interface Lead {
  id: string;
  requestId: string;
  parentUid: string;
  tutorUid: string;
  classLevel: string;
  subject: string;
  area: string;
  mode: string;
  budgetMax: number;
  timing: string;
  status: 'new' | 'interested' | 'declined';
  createdAt: { toDate(): Date } | null;
  respondedAt: { toDate(): Date } | null;
}

export async function listMyLeads(
  tutorUid: string,
  status?: Lead['status']
): Promise<Lead[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const clauses = [where('tutorUid', '==', tutorUid)];
  if (status) clauses.push(where('status', '==', status));

  const snap = await getDocs(
    query(collection(db, 'leads'), ...clauses, orderBy('createdAt', 'desc'), limit(LIST_CAP))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
}

/**
 * Tutor lead par jawab deta hai. Rules sirf `status` aur `respondedAt` badalne
 * deti hain — lead ka content (subject, budget) tutor badal nahi sakta.
 */
export async function respondToLead(
  leadId: string,
  status: 'interested' | 'declined'
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'leads', leadId), { status, respondedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Slug — URL ke liye
// ---------------------------------------------------------------------------

/**
 * "Muhammad Ali" + "risalpur" → "muhammad-ali-risalpur"
 *
 * ★ Slug create ke baad badalta nahi (rules `unchanged('slug')` enforce karti
 *   hain) — warna SEO links toot jate. Uniqueness rules enforce nahi kar sakti
 *   (uske liye server chahiye), isliye build script duplicate slug par build
 *   tor deti hai aur admin approve karte waqt dekh leta hai.
 */
export function makeSlug(name: string, city: string): string {
  const clean = (s: string) =>
    s.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  return [clean(name), clean(city)].filter(Boolean).join('-');
}

export const statusLabel: Record<TutorStatus, string> = {
  pending: 'Review ka intezaar',
  approved: 'Live hai',
  rejected: 'Reject hui',
  suspended: 'Suspend hai',
};
