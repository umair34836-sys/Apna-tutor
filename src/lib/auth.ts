// =============================================================================
// src/lib/auth.ts — Firebase Auth ke saare raste ek jagah
//
// Spark plan par Phone/SMS OTP available nahi hai (Sep 2024 se billing account
// zaroori). Isliye sirf Email/Password aur Google sign-in hain — Console mein
// Phone provider enable KARNA HI NAHI, warna sirf confusion paida hoti hai.
//
// Firebase yahan bhi lazy import hoti hai: jo page login nahi karta, wo SDK
// download bhi nahi karta.
// =============================================================================

import { getFirebase, currentUser } from './firebase';
import { url } from './site';
import { homeForRole, writeAuthHint } from './auth-hint';
import type { User } from 'firebase/auth';
import type { Role } from './types';

/**
 * Role ki tareef src/lib/types.ts mein hai — wahan isliye ke auth-hint.ts ko
 * bhi chahiye, aur usay auth.ts (yani Firebase) import nahi karni chahiye.
 */
export type { Role };

/** Wo roles jo tutor DHOONDTE hain (parent side ki har page inke liye hai). */
export const isLearnerRole = (role: Role | undefined): boolean =>
  role === 'parent' || role === 'student';

export interface UserProfile {
  role: Role;
  name: string;
  city: string;
}

/**
 * Firebase Auth ke error codes → Roman Urdu.
 *
 * Note: modern Firebase `wrong-password` aur `user-not-found` ki jagah
 * `invalid-credential` deta hai (jaan boojh kar — taake pata na chale ke email
 * registered hai ya nahi). Message dono surton ko cover karta hai.
 */
export function authError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ya password ghalat hai. Dobara koshish karein.';
    case 'auth/invalid-email':
      return 'Email address theek nahi lag raha.';
    case 'auth/email-already-in-use':
      return 'Is email par pehle se account hai. Login karein ya password reset karein.';
    case 'auth/weak-password':
      return 'Password kam az kam 6 characters ka hona chahiye.';
    case 'auth/too-many-requests':
      return 'Bohat zyada koshishein ho gayin. Thori dair baad dobara try karein.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google window band ho gayi. Dobara koshish karein.';
    case 'auth/popup-blocked':
      return 'Browser ne popup rok diya. Popup allow karein ya email se login karein.';
    case 'auth/network-request-failed':
      return 'Internet connection check karein aur dobara koshish karein.';
    case 'auth/user-disabled':
      return 'Ye account band kar diya gaya hai. Rabta karein.';
    case 'auth/requires-recent-login':
      return 'Security ke liye dobara login karein, phir ye kaam karein.';
    default:
      console.error('[auth]', code, err);
      return 'Kuch masla hua. Dobara koshish karein.';
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  profile: UserProfile
): Promise<User> {
  const { auth, db } = await getFirebase();
  const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } =
    await import('firebase/auth');
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: profile.name });

  // Rules: keys sirf ye chaar, role parent|tutor, createdAt serverTimestamp.
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: profile.role,
    name: profile.name,
    city: profile.city,
    createdAt: serverTimestamp(),
  });

  writeAuthHint({ signedIn: true, role: profile.role });

  // Sabse sasta spam filter. Verify na ho to tutor profile submit nahi hoti.
  await sendEmailVerification(cred.user).catch(() => {
    // Spark par 150 emails/day. Limit lagne par signup fail na ho.
  });

  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

/**
 * Google sign-in. Naya user ho to `users/{uid}` doc nahi hota — caller ko
 * role aur city poochni parti hai (isi liye `isNew` return hota hai).
 */
export async function signInWithGoogle(): Promise<{ user: User; isNew: boolean }> {
  const { auth, db } = await getFirebase();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const { doc, getDoc } = await import('firebase/firestore');

  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  return { user: cred.user, isNew: !snap.exists() };
}

/** Google se aaye naye user ka profile doc banata hai. */
export async function completeProfile(profile: UserProfile): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Login nahi hai.');

  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  await setDoc(doc(db, 'users', user.uid), {
    role: profile.role,
    name: profile.name || user.displayName || 'User',
    city: profile.city,
    createdAt: serverTimestamp(),
  });

  writeAuthHint({ signedIn: true, role: profile.role });
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { auth } = await getFirebase();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
}

export async function resendVerification(): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Login nahi hai.');
  const { sendEmailVerification } = await import('firebase/auth');
  await sendEmailVerification(user);
}

export async function signOut(): Promise<void> {
  writeAuthHint(null);
  const { auth } = await getFirebase();
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
}

/**
 * `users/{uid}` doc. Na mile to null.
 *
 * Har raasta — login, signup, har guarded page — yahin se guzarta hai, isliye
 * header ka auth hint bhi yahin taza hota hai.
 */
export async function getProfile(uid: string): Promise<UserProfile | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', uid));

  if (!snap.exists()) return null;

  const profile = snap.data() as UserProfile;
  writeAuthHint({ signedIn: true, role: profile.role });
  return profile;
}

export interface Session {
  user: User;
  profile: UserProfile | null;
}

/**
 * Page guard. Logged out ho to /login par bhej deta hai (wapas aane ke liye
 * `next` ke saath) aur null return karta hai.
 *
 * `role` do to us role ke bagair user ko uske apne dashboard par bhej deta hai
 * — "access denied" ka khali screen dikhane se behtar hai.
 */
export async function requireSession(role?: Role): Promise<Session | null> {
  const user = await currentUser();

  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(url(`/login?next=${next}`));
    return null;
  }

  const profile = await getProfile(user.uid);

  // Google se aaya naya user — abhi role aur city nahi di.
  if (!profile) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(url(`/signup?complete=1&next=${next}`));
    return null;
  }

  // `parent` maanga gaya ho to `student` bhi chalega — dono ka area ek hai.
  const allowed = role
    ? isLearnerRole(role)
      ? isLearnerRole(profile.role)
      : profile.role === role
    : true;

  if (!allowed) {
    window.location.replace(url(homeFor(profile.role)));
    return null;
  }

  return { user, profile };
}

/**
 * Admin gate. Admin hona `admins/{uid}` document ke mojood hone se tay hota
 * hai — custom claims ke liye Admin SDK chahiye hota, jo Spark par nahi.
 *
 * ★ Ye sirf UI ke liye hai. Asli protection firestore.rules hai: non-admin ye
 *   pages khol bhi le to har read/write reject ho jayegi.
 */
export interface AdminBlock {
  reason: 'no-doc' | 'denied' | 'error';
  uid: string;
  detail: string;
}

let lastAdminBlock: AdminBlock | null = null;

/** Admin gate kyun nahi khula — App.astro ye screen par dikhata hai. */
export const adminBlock = (): AdminBlock | null => lastAdminBlock;

export async function requireAdmin(): Promise<Session | null> {
  const user = await currentUser();

  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(url(`/login?next=${next}`));
    return null;
  }

  const { adminCheck } = await import('./firebase');
  const check = await adminCheck();

  if (!check.ok) {
    // ★ Yahan pehle chupke se dashboard par bhej dete thay. Pehla admin
    //   banate waqt wo sab se bura lamha tha: banda `admins` document bana
    //   chuka hota tha, bounce phir bhi hota tha, aur koi wajah nahi milti
    //   thi — na apna UID dikhta tha jo document ki ID hona chahiye.
    //   Ab rukte hain aur saaf batate hain. Ismein koi raaz nahi khulta:
    //   banda apna hi UID dekhta hai.
    lastAdminBlock = {
      reason: check.reason === 'signed-out' ? 'error' : check.reason,
      uid: check.uid ?? user.uid,
      detail: check.detail,
    };
    return null;
  }

  return { user, profile: await getProfile(user.uid) };
}

let adminOnce: Promise<Session | null> | null = null;

/** requireAdmin, magar ek page load par sirf ek baar. */
export function getAdminSession(): Promise<Session | null> {
  adminOnce ??= requireAdmin();
  return adminOnce;
}

let sessionOnce: Promise<Session | null> | null = null;

/**
 * Wahi `requireSession`, magar ek page load par SIRF EK BAAR chalta hai.
 *
 * Layout ka gate aur page ka apna code — dono isay call karte hain. Memoize na
 * karte to har call ek extra Firestore read kharch karti (50,000/day ka budget
 * hai), aur do alag redirects ki race bhi lag sakti thi.
 */
export function getSession(role?: Role): Promise<Session | null> {
  sessionOnce ??= requireSession(role);
  return sessionOnce;
}

/**
 * Login ke baad kahan jana hai. Seedha `window.location.href` mein daal sakte
 * hain — base path yahin lag jata hai.
 *
 * `next` do shakal mein aa sakta hai: `window.location.pathname` se (jismein
 * base pehle se hai) ya code se likha hua bare path. Dono handle hote hain.
 */
export function nextUrl(fallback = '/'): string {
  const next = new URLSearchParams(window.location.search).get('next');
  // Open redirect se bachao: sirf relative path, protocol-relative "//" nahi.
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return base && next.startsWith(`${base}/`) ? next : url(next);
  }
  return url(fallback);
}

export function homeFor(role: Role | undefined): string {
  return homeForRole(role);
}

/** Roman Urdu label — role batane ke liye. */
export function roleLabel(role: Role | undefined): string {
  return role === 'tutor' ? 'Tutor' : role === 'student' ? 'Student' : 'Parent';
}
