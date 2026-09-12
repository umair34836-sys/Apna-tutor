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

// Config public hai (by design) — lekin env se lo, hard-code na karo, taake
// dev aur prod projects switch kar sako.
const firebaseConfig = {
  apiKey:            import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain:        import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_SENDER_ID,
  appId:             import.meta.env.PUBLIC_FIREBASE_APP_ID,
  // storageBucket jaan boojh kar nahi hai. Cloud Storage Spark plan par
  // available nahi (3 Feb 2026 se Blaze zaroori). Photos Cloudinary par jati
  // hain. Agar ye field rakhein to kabhi galti se getStorage() call ho jayega
  // aur ek confusing runtime error milega.
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
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');

  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
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
