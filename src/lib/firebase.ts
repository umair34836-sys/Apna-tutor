// =============================================================================
// src/lib/firebase.ts
//
// Firebase init — ApnaTutor
//
// Do ahem design faisle:
//
// 1. LAZY LOADING. Firebase SDK ~300 KB hai. Homepage, city pages aur tutor
//    profiles sab static HTML hain — unhe Firebase ki zarurat NAHI hai. Isliye
//    yahan dynamic import() use kiya hai. Jo page Firebase use nahi karta, wo
//    usay download bhi nahi karta. Ye sabse bara performance win hai.
//
//    Kabhi is file ko Base.astro ya kisi static page mein top-level import na
//    karo. Sirf wahan await karo jahan waqai zarurat ho.
//
// 2. PERSISTENT CACHE. Spark plan par 50,000 reads/day hain. Local cache dobara
//    wahi documents padhne se bachata hai — quota par seedha farq parta hai.
// =============================================================================

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// =============================================================================
// Firebase web config.
//
// ★ Ye values PUBLIC hain — by design. Firebase web config browser mein nazar
//   aati hai aur usay chhupana mumkin bhi nahi. Asli protection firestore.rules
//   aur storage.rules hain, aur App Check hai.
//
// Isliye ye yahan committed hain: site bina kisi secret ke chal jati hai.
// Dev/staging project chalana ho to .env mein PUBLIC_FIREBASE_* set kar dein —
// wo in par ghalib aa jayengi.
// =============================================================================

// storageBucket jaan boojh kar yahan NAHI hai. Cloud Storage istemal nahi hoti
// (na Spark par available hai, na hum chahte hain) — photos Firestore mein
// base64 ke taur par jati hain, src/lib/photo.ts dekhein. Bucket yahan hota to
// kabhi galti se getStorage() call ho jata aur ek confusing error milta.
const DEFAULTS = {
  apiKey: 'AIzaSyCpmLDXV1KL-gkShWmDoSfaT13MB191qxs',
  authDomain: 'apna-tutor-33bf3.firebaseapp.com',
  projectId: 'apna-tutor-33bf3',
  messagingSenderId: '703030381065',
  appId: '1:703030381065:web:0e5428011db1d2f85306d8',
} as const;

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || DEFAULTS.apiKey,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_SENDER_ID || DEFAULTS.messagingSenderId,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || DEFAULTS.appId,
};

interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let bundle: Promise<FirebaseBundle> | null = null;

/**
 * Firebase ko initialize karta hai (sirf ek baar) aur app/auth/db return karta
 * hai. Har call safe hai — dobara init nahi hota.
 *
 *   const { db, auth } = await getFirebase();
 */
export function getFirebase(): Promise<FirebaseBundle> {
  if (bundle) return bundle;

  bundle = (async () => {
    const [
      { initializeApp, getApps, getApp },
      { getAuth, browserLocalPersistence, setPersistence },
      { initializeFirestore, persistentLocalCache, persistentSingleTabManager },
    ] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    // ---- App Check ----
    // Server nahi hai, isliye rate limiting mumkin nahi. App Check hi scraping
    // aur automated abuse ke khilaf sabse asar-daar free tool hai.
    //
    // Pehle Firebase Console mein MONITOR mode par chalao (7 din), traffic
    // dekho, phir ENFORCE karo. Seedha enforce karne se asli users block ho
    // sakte hain aur pata nahi chalega.
    const siteKey = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      const { initializeAppCheck, ReCaptchaV3Provider } =
        await import('firebase/app-check');

      // Local development ke liye: Console se debug token lo aur
      // .env.local mein PUBLIC_APPCHECK_DEBUG_TOKEN rakho.
      // Ye NEVER production build mein set na karo.
      const debugToken = import.meta.env.PUBLIC_APPCHECK_DEBUG_TOKEN;
      if (debugToken) {
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      }

      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    // ---- Auth ----
    const auth = getAuth(app);
    // Parent ko har baar login na karna pare.
    await setPersistence(auth, browserLocalPersistence).catch(() => {
      // Private browsing / storage blocked — session-only chalega. Fatal nahi.
    });

    // ---- Firestore ----
    // Persistent cache se reads bachti hain (50k/day ka budget hai).
    // Single-tab manager kaafi hai; multi-tab sync ki zarurat nahi aur wo
    // thoda heavy hota hai.
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({}),
      }),
    });

    return { app, auth, db };
  })();

  return bundle;
}

/**
 * Current user ka intezaar karta hai (Firebase ko auth state restore karne mein
 * ek lamha lagta hai). `null` return hota hai agar logged out ho.
 *
 * Isay page load par use karo — warna logged-in user ko ek pal ke liye "login
 * karein" nazar aata hai, jo bura lagta hai.
 */
export async function currentUser() {
  const { auth } = await getFirebase();
  const { onAuthStateChanged } = await import('firebase/auth');

  return new Promise<import('firebase/auth').User | null>((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

/**
 * Banda admin hai? `admins/{uid}` doc ke mojood hone se pata chalta hai.
 *
 * Ye UI ke liye hai. Asli protection firestore.rules mein hai — UI mein admin
 * links chhupana security nahi hai, sirf tidiness hai.
 */
export type AdminCheck =
  | { ok: true; uid: string }
  | { ok: false; uid: string | null; reason: 'signed-out' | 'no-doc' | 'denied' | 'error'; detail: string };

/**
 * Admin check, magar WAJAH ke saath.
 *
 * ★ Pehle ye sirf `false` lautata tha aur error nigal jata tha. Natija ye ke
 *   pehla admin banate waqt "redirect ho gaya" ke siwa koi maloomat nahi
 *   milti thi — na ye ke document nahi mila, na ye ke rules ne roka, aur na
 *   hi apna UID. Setup ka sab se pehla qadam hi sab se andhera hissa tha.
 *
 *   `no-doc` aur `denied` mein farq ahem hai:
 *     no-doc  → login theek hai, bas `admins/{uid}` mojood nahi
 *     denied  → rules ne read hi nahi karne di (aksar rules deploy nahi huin)
 */
export async function adminCheck(): Promise<AdminCheck> {
  const user = await currentUser();
  if (!user) return { ok: false, uid: null, reason: 'signed-out', detail: 'Login nahi hai.' };

  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');

  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists()
      ? { ok: true, uid: user.uid }
      : { ok: false, uid: user.uid, reason: 'no-doc', detail: `admins/${user.uid} mojood nahi.` };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    // permission-denied yahan "aap admin nahi" ka matlab NAHI hai — admin ko
    // apna document parhne ki ijazat rules deti hain. Iska matlab aksar ye
    // hota hai ke firestore.rules deploy hi nahi huin.
    return code === 'permission-denied'
      ? { ok: false, uid: user.uid, reason: 'denied', detail: 'Firestore ne read block kar di (permission-denied).' }
      : { ok: false, uid: user.uid, reason: 'error', detail: firestoreError(err) };
  }
}

/**
 * Sirf haan/na chahiye to ye. Wajah chahiye to `adminCheck()`.
 */
export async function isAdmin(): Promise<boolean> {
  return (await adminCheck()).ok;
}

/**
 * Firestore errors ko Roman Urdu messages mein badalta hai.
 *
 * `resource-exhausted` khaas taur par ahem hai — Spark plan ka daily quota
 * khatam hone par yahi aata hai. Usay handle na karo to user ko tooti hui
 * screen dikhti hai aur tumhe pata bhi nahi chalta ke quota khatam hua.
 */
export function firestoreError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'permission-denied':
      return 'Aapko is kaam ki ijazat nahi hai. Login check karein.';
    case 'resource-exhausted':
      // Ye dekho to Firebase Console → Usage foran check karo.
      return 'Website par abhi bohat rush hai. Kuch dair baad koshish karein.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Internet connection check karein aur dobara koshish karein.';
    case 'unauthenticated':
      return 'Aapka session khatam ho gaya. Dobara login karein.';
    case 'already-exists':
      return 'Ye pehle se mojood hai.';
    case 'failed-precondition':
      // Aam wajah: composite index nahi bana. Console ke error mein link hota hai.
      return 'Kuch masla hua. Dobara koshish karein.';
    default:
      console.error('[firestore]', code, err);
      return 'Kuch masla hua. Dobara koshish karein.';
  }
}
