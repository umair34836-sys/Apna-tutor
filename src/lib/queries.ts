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

export interface PhotoSubmission { dataUrl: string; thumbUrl: string }

export async function getMyPhotoSubmission(uid: string): Promise<PhotoSubmission | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', uid, 'private', 'photoSubmission'));
  return snap.exists() ? (snap.data() as PhotoSubmission) : null;
}

export async function setMyPhotoSubmission(uid: string, photo: PhotoSubmission): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  // Rules: sirf dataUrl + submittedAt, aur dataUrl ek JPEG data URI jo
  // 300,000 characters se bara na ho.
  await setDoc(doc(db, 'tutors', uid, 'private', 'photoSubmission'), {
    dataUrl: photo.dataUrl,
    thumbUrl: photo.thumbUrl,
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

// ---------------------------------------------------------------------------
// Search — parent ki taraf se
//
// ★ Firestore ek query mein SIRF EK `array-contains` allow karta hai. Isliye
//   subject server-side filter hota hai, aur class/area/gender/mode/fee ka
//   filter client par. Ek city mein 30–300 tutors par ye tez aur sasta hai.
//   500+ ho jayein to Algolia/Typesense ka free tier (docs/01-ARCHITECTURE §4).
// ---------------------------------------------------------------------------

export interface SearchFilters {
  city: string;
  subject: string;
  classLevel?: string;
  area?: string;
  gender?: string;
  mode?: string;
  board?: string;
  budgetMax?: number;
  minExperience?: number;
}

/** Server-side query — rules ke cap ke andar. */
export async function searchTutors(city: string, subject: string): Promise<Tutor[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'tutors'),
      where('status', '==', 'approved'),
      where('city', '==', city),
      where('subjects', 'array-contains', subject),
      orderBy('featuredUntil', 'desc'),
      limit(TUTOR_CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tutor);
}

/** Baqi filters client par. */
export function applyFilters(tutors: Tutor[], f: SearchFilters): Tutor[] {
  return tutors.filter((t) => {
    if (f.classLevel && !t.classes.includes(f.classLevel)) return false;
    if (f.board && !t.boards.includes(f.board)) return false;
    if (f.mode && !t.modes.includes(f.mode as 'home' | 'online')) return false;
    if (f.gender && t.gender !== f.gender) return false;
    if (f.area && !t.areas.includes(f.area)) return false;
    // Budget: tutor ki kam az kam fee parent ke budget se zyada na ho.
    if (f.budgetMax && t.feeMin > f.budgetMax) return false;
    if (f.minExperience && t.experienceYears < f.minExperience) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Requests aur lead fan-out
//
// ★ Server nahi hai, isliye fan-out PARENT KA BROWSER karta hai: request
//   banane ke baad matching approved tutors query hote hain aur max 5 lead
//   documents likhe jate hain. Rules do cheezein enforce karti hain — parent
//   sirf apni request ka fan-out kar sake, aur lead mein parent ka contact
//   bilkul na ho (docs/05-RISKS.md §4).
// ---------------------------------------------------------------------------

export const MAX_LEADS_PER_REQUEST = 5;

export interface RequestInput {
  parentPhone: string;
  classLevel: string;
  subject: string;
  city: string;
  area: string;
  mode: 'home' | 'online' | 'any';
  genderPref: 'male' | 'female' | 'any';
  budgetMax: number;
  timing: string;
  notes: string;
}

export interface TuitionRequest extends RequestInput {
  id: string;
  parentUid: string;
  status: 'open' | 'matched' | 'closed';
  createdAt: { toDate(): Date } | null;
}

export async function createRequest(parentUid: string, input: RequestInput): Promise<string> {
  const { db } = await getFirebase();
  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');

  const ref = await addDoc(collection(db, 'requests'), {
    ...input,
    parentUid,
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Matching tutors dhoond kar unke liye lead documents banata hai.
 *
 * ★ Lead mein parentPhone / parentAddress / parentEmail KABHI nahi. Rules bhi
 *   rokti hain. Tutor "Interested" karta hai, phir parent faisla karta hai ke
 *   number dena hai ya nahi — yahi is platform ka sabse bara privacy wada hai.
 *
 * Return: kitne tutors tak request pohanchi.
 */
export async function fanOutLeads(
  parentUid: string,
  requestId: string,
  input: RequestInput
): Promise<number> {
  const { db } = await getFirebase();
  const { doc, serverTimestamp, writeBatch, collection } = await import('firebase/firestore');

  const pool = await searchTutors(input.city, input.subject);

  const matched = applyFilters(pool, {
    city: input.city,
    subject: input.subject,
    classLevel: input.classLevel,
    gender: input.genderPref === 'any' ? undefined : input.genderPref,
    mode: input.mode === 'any' ? undefined : input.mode,
    budgetMax: input.budgetMax,
    // Area ko sakht filter nahi banate — aas paas ke tutors bhi kaam ke hain.
  }).slice(0, MAX_LEADS_PER_REQUEST);

  if (matched.length === 0) return 0;

  const batch = writeBatch(db);
  for (const tutor of matched) {
    batch.set(doc(collection(db, 'leads')), {
      requestId,
      parentUid,
      tutorUid: tutor.id,
      classLevel: input.classLevel,
      subject: input.subject,
      area: input.area,
      mode: input.mode,
      budgetMax: input.budgetMax,
      timing: input.timing,
      status: 'new',
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
  }
  await batch.commit();

  return matched.length;
}

export async function listMyRequests(parentUid: string): Promise<TuitionRequest[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'requests'),
      where('parentUid', '==', parentUid),
      orderBy('createdAt', 'desc'),
      limit(LIST_CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TuitionRequest);
}

export async function getRequest(id: string): Promise<TuitionRequest | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'requests', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as TuitionRequest) : null;
}

export async function closeRequest(id: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'requests', id), { status: 'closed' });
}

/** Ek request par kaun se tutors ne dilchaspi li. */
export async function listLeadsForRequest(requestId: string): Promise<Lead[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'leads'),
      where('requestId', '==', requestId),
      where('status', '==', 'interested'),
      limit(LIST_CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
}

// ---------------------------------------------------------------------------
// Connections — unlock kiye hue tutors
// ---------------------------------------------------------------------------

export interface Connection {
  id: string;
  parentUid: string;
  tutorUid: string;
  source: 'search' | 'lead';
  createdAt: { toDate(): Date } | null;
}

export async function listMyConnections(parentUid: string): Promise<Connection[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(collection(db, 'connections'), where('parentUid', '==', parentUid), limit(LIST_CAP))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Connection);
}

/** Public tutor doc — connections se naam/slug nikalne ke liye. */
export async function getTutorById(uid: string): Promise<Tutor | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tutor) : null;
}

// ---------------------------------------------------------------------------
// Reviews
//
// ★ Review sirf tab ban sakta hai jab `connections/{parentUid}_{tutorUid}`
//   mojood ho — yani parent ne waqai us tutor ka contact khola ho. Rules ye
//   enforce karti hain, aur yahi fake reviews ke khilaf sabse mazboot defence
//   hai. Composite ID = ek parent ek tutor ko ek hi review de sakta hai.
// ---------------------------------------------------------------------------

export interface ReviewInput { rating: number; text: string; parentName: string }

export async function createReview(
  parentUid: string,
  tutorUid: string,
  input: ReviewInput
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  await setDoc(doc(db, 'reviews', `${parentUid}_${tutorUid}`), {
    tutorUid,
    parentUid,
    parentName: input.parentName,
    rating: input.rating,
    text: input.text,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function getMyReview(parentUid: string, tutorUid: string) {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'reviews', `${parentUid}_${tutorUid}`));
  return snap.exists() ? (snap.data() as { rating: number; text: string; status: string }) : null;
}
