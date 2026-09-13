// =============================================================================
// src/lib/admin.ts — admin panel ki saari queries
//
// ★ Cloud Functions Spark plan par nahi hain, isliye jo kaam normally server
//   karta wo yahan admin panel karta hai — khaas taur par ratings ka average
//   (recomputeRating). Iska matlab: is file ka bug seedha ghalat ratings banata
//   hai. Isliye recompute hamesha SCRATCH SE hota hai, kabhi "purana average +
//   naya review" jaisa shortcut nahi. /admin/recompute-ratings se poori list
//   dobara bhi calculate ki ja sakti hai.
//
// ★ Ye file sirf UI ke liye hai. Asli protection firestore.rules hai — agar
//   koi non-admin ye functions call kare to Firestore usay reject kar dega.
// =============================================================================

import { getFirebase } from './firebase';
import type { Tutor, TutorBadges, TutorStatus } from './types';

const CAP = 30;      // rules: tutors aur reviews
const LIST_CAP = 50; // rules: reports, leads, requests

// ---------------------------------------------------------------------------
// Tutors — approval queue
// ---------------------------------------------------------------------------

export async function listTutorsByStatus(status: TutorStatus): Promise<Tutor[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'tutors'),
      where('status', '==', status),
      orderBy('updatedAt', 'desc'),
      limit(CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tutor);
}

export async function setTutorStatus(
  tutorUid: string,
  status: TutorStatus,
  adminUid: string,
  note = ''
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

  await updateDoc(doc(db, 'tutors', tutorUid), {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    ...(note ? { reviewNote: note } : {}),
  });
}

/**
 * Badges set karta hai aur saath mein audit line likhta hai.
 *
 * ★ Audit line (verifiedBy, verifiedAt) isliye lazmi hai ke baad mein pata
 *   rahe kis ne kab kya approve kiya — khaas taur par jab ek se zyada log
 *   admin banein.
 */
export async function setBadges(
  tutorUid: string,
  badges: TutorBadges,
  adminUid: string,
  verifyNote: string
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

  await updateDoc(doc(db, 'tutors', tutorUid), {
    badges,
    verifiedBy: adminUid,
    verifiedAt: serverTimestamp(),
    ...(verifyNote ? { verifyNote } : {}),
  });
}

/** Tutor ki submit ki hui photo ko live karta hai. */
export async function approvePhoto(tutorUid: string, url: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'tutors', tutorUid), { photoUrl: url, updatedAt: serverTimestamp() });
}

export async function rejectPhoto(tutorUid: string): Promise<void> {
  const { db } = await getFirebase();
  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'tutors', tutorUid, 'private', 'photoSubmission'));
}

export async function setFeaturedUntil(tutorUid: string, until: Date | null): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'tutors', tutorUid), { featuredUntil: until, updatedAt: serverTimestamp() });
}

export async function getTutorContact(tutorUid: string) {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', tutorUid, 'private', 'contact'));
  return snap.exists() ? (snap.data() as { phone: string; whatsapp: string; email: string }) : null;
}

export async function getPhotoSubmission(tutorUid: string) {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'tutors', tutorUid, 'private', 'photoSubmission'));
  return snap.exists() ? (snap.data() as { url: string; publicId: string }) : null;
}

// ---------------------------------------------------------------------------
// Reviews — moderation + ratings
// ---------------------------------------------------------------------------

export interface AdminReview {
  id: string;
  tutorUid: string;
  parentName: string;
  rating: number;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: { toDate(): Date } | null;
}

export async function listReviewsByStatus(status: AdminReview['status']): Promise<AdminReview[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'reviews'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminReview);
}

/**
 * Ek tutor ki rating SCRATCH SE dobara calculate karta hai.
 *
 * Rules har list query ko 30 docs par cap karti hain (admin ke liye bhi),
 * isliye paging zaroori hai. Purane average par shortcut kabhi nahi lagate —
 * ek galat write hamesha ke liye rating kharab kar deti.
 */
export async function recomputeRating(tutorUid: string): Promise<{ avg: number; count: number }> {
  const { db } = await getFirebase();
  const {
    collection, doc, getDocs, limit, orderBy, query, startAfter, updateDoc, where, serverTimestamp,
  } = await import('firebase/firestore');

  let total = 0;
  let count = 0;
  let cursor: unknown = null;

  // Paging — 30 se zyada reviews ho sakte hain.
  for (;;) {
    const clauses = [
      where('tutorUid', '==', tutorUid),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(CAP),
    ];
    const snap = await getDocs(query(collection(db, 'reviews'), ...(clauses as [])));
    if (snap.empty) break;

    snap.docs.forEach((d) => {
      total += Number((d.data() as { rating: number }).rating) || 0;
      count += 1;
    });

    if (snap.docs.length < CAP) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  // Ek decimal — UI bhi yahi dikhata hai, to store bhi wahi karo.
  const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  await updateDoc(doc(db, 'tutors', tutorUid), {
    ratingAvg: avg,
    ratingCount: count,
    updatedAt: serverTimestamp(),
  });

  return { avg, count };
}

/** Approve karke us tutor ki rating foran recompute hoti hai. */
export async function approveReview(reviewId: string, tutorUid: string) {
  const { db } = await getFirebase();
  const { doc, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'reviews', reviewId), { status: 'approved' });
  return recomputeRating(tutorUid);
}

export async function rejectReview(reviewId: string, tutorUid: string) {
  const { db } = await getFirebase();
  const { doc, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'reviews', reviewId), { status: 'rejected' });
  // Pehle approved raha ho to count badal jata hai — isliye yahan bhi recompute.
  return recomputeRating(tutorUid);
}

/** Saare approved tutors ki ratings dobara — mahine mein ek baar chalayein. */
export async function recomputeAllRatings(
  onProgress?: (done: number, total: number, name: string) => void
): Promise<number> {
  const tutors = await listTutorsByStatus('approved');
  let done = 0;

  for (const tutor of tutors) {
    await recomputeRating(tutor.id);
    done += 1;
    onProgress?.(done, tutors.length, tutor.name);
  }

  return done;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface Report {
  id: string;
  reporterUid: string;
  targetType: 'tutor' | 'review' | 'request';
  targetId: string;
  reason: string;
  detail: string;
  status: 'open' | 'actioned' | 'dismissed';
  createdAt: { toDate(): Date } | null;
}

export async function listReports(status: Report['status']): Promise<Report[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(
      collection(db, 'reports'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(LIST_CAP)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report);
}

export async function setReportStatus(
  reportId: string,
  status: Report['status'],
  adminUid: string
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'reports', reportId), {
    status,
    actionedBy: adminUid,
    actionedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// SEO content — cities aur subjects
// ---------------------------------------------------------------------------

export interface CityDoc {
  name: string;
  nameUrdu?: string;
  district?: string;
  province?: string;
  areas: string[];
  intro: string;
  pageIntros?: Record<string, string>;
}

export interface SubjectDoc {
  name: string;
  nameUrdu?: string;
  intro: string;
}

export async function listCityDocs(): Promise<(CityDoc & { slug: string })[]> {
  const { db } = await getFirebase();
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'cities'));
  return snap.docs.map((d) => ({ slug: d.id, ...(d.data() as CityDoc) }));
}

export async function listSubjectDocs(): Promise<(SubjectDoc & { slug: string })[]> {
  const { db } = await getFirebase();
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'subjects'));
  return snap.docs.map((d) => ({ slug: d.id, ...(d.data() as SubjectDoc) }));
}

export async function saveCityDoc(slug: string, data: CityDoc): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'cities', slug), data, { merge: true });
}

export async function saveSubjectDoc(slug: string, data: SubjectDoc): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'subjects', slug), data, { merge: true });
}

/** SEO gate 120 words maangta hai — admin ko likhte waqt hi pata chal jaye. */
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const MIN_INTRO_WORDS = 120;
