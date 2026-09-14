// =============================================================================
// src/lib/promo-stats.ts — ishtihaar ke numbers ginna
//
// Do jagah ginte hain, aur dono ki wajah alag hai:
//
//   1. GA4 (track) — asli, poora number. Muft aur be-hisaab. Tafseel wahan
//      behtar milti hai (kis page se, kaun sa shehr, wagera).
//   2. Firestore — sirf is liye ke admin ko number ADMIN PANEL mein dikhe,
//      GA4 kholay bagair. Brand se baat karte waqt yahi kaam aata hai.
//
// ★ Firestore wala number "har baar dikhne" ka nahi, "roz kitne alag logon ne
//   dekha" ka hai — kyunki ek browser din mein ek hi baar ginta hai (neeche
//   `once` dekhein). Ye jaan boojh kar hai:
//
//   (a) Har view par likhna roz 20,000 writes ki hadd kha jata, aur wo hadd
//       khatam hone par signup aur request post karna bhi ruk jata. Ishtihaar
//       ki ginti ke liye poori site rok dena bewaqoofi hoti.
//   (b) "500 logon ne dekha" brand ke liye "2,000 baar dikha" se zyada saaf
//       aur zyada sacchi baat hai.
//
//   Admin panel mein yahi baat likhi hai — number ko zyada bana kar dikhana
//   brand se jhoot bolna hai.
//
// ★ Likhne ki koshish nakaam ho to KHAMOSHI. Ginti ka masla banday ko dikhane
//   wali cheez nahi.
// =============================================================================

import { track } from './analytics';

/** Pakistan UTC+5. Din raat 12 baje badalta hai, UTC par nahi. */
const PK_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Aaj ka din, 1970 se ginti. firestore.rules bilkul yahi hisaab lagati hai. */
function pkDay(now = Date.now()): number {
  return Math.floor((now + PK_OFFSET_MS) / 86_400_000);
}

/**
 * Ek din mein ek hi baar. localStorage na ho (private window, ya band ho) to
 * `true` lauta dete hain — ginti thori zyada ho jaye, ye ginti hi na hone se
 * behtar hai.
 */
function once(key: string): boolean {
  try {
    const k = `at.promo.${key}.${pkDay()}`;
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, '1');
    // Kal ki chabiyan aaj hi saaf — warna ye storage bharta chala jata hai.
    const keep = `.${pkDay()}`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const kk = localStorage.key(i);
      if (kk && kk.startsWith('at.promo.') && !kk.endsWith(keep)) localStorage.removeItem(kk);
    }
    return true;
  } catch {
    return true;
  }
}

async function bump(promoId: string, field: 'views' | 'clicks'): Promise<void> {
  try {
    const { getFirebase } = await import('./firebase');
    const { db } = await getFirebase();
    const { doc, increment, setDoc } = await import('firebase/firestore');

    const day = pkDay();
    const id = `${promoId}__${day}`;

    // merge:true — doc pehli dafa banega, uske baad barhta jayega. Rules dono
    // sooraton ko alag alag jaanchti hain.
    await setDoc(
      doc(db, 'promoStats', id),
      { promoId, day, [field]: increment(1) },
      { merge: true }
    );
  } catch {
    // Khamoshi — dekhein upar.
  }
}

export function promoView(promoId: string, slot: string, brand: string): void {
  track('promo_view', { promo_id: promoId, slot, brand });
  if (once(`v.${promoId}`)) void bump(promoId, 'views');
}

export function promoClick(promoId: string, slot: string, brand: string): void {
  track('promo_click', { promo_id: promoId, slot, brand });
  if (once(`c.${promoId}`)) void bump(promoId, 'clicks');
}
