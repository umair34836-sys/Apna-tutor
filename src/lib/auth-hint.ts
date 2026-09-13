// =============================================================================
// src/lib/auth-hint.ts
//
// Header har page par hai — static pages par bhi — aur usay itna to pata hona
// chahiye ke banda logged in hai ya nahi, warna login ke baad bhi
// "Login / Sign up" hi dikhta rahega.
//
// Magar wahan Firebase SDK load karna mumkin nahi: ~300 KB, aur poori
// architecture usi se bachti hai (src/lib/firebase.ts ka pehla note). Isliye
// ek chhota sa nishan localStorage mein rakhte hain.
//
// ★ Ye file jaan boojh kar ALAG hai, auth.ts ka hissa nahi. auth.ts apne saath
//   firebase.ts aur queries kheench leti hai (~7 KB), aur wo sab header ke
//   zariye har static page par chala jata — sirf ek key parhne ke liye. Yahan
//   sirf ye hai, ~300 bytes.
//
// ★ Ye nishan SIRF UI ka faisla karta hai. Na ispar koi ijazat mabni hai, na
//   koi data. Purana ho jaye to bura se bura ye hoga ke "Mera dashboard" par
//   click karne par login page khul jayega — aur wahan nishan theek ho jayega.
//   Asli gate hamesha Firebase Auth aur firestore.rules hain.
// =============================================================================

import type { Role } from './types';

const KEY = 'apnatutor-auth';

export interface AuthHint {
  signedIn: boolean;
  role?: Role;
}

const SIGNED_OUT: AuthHint = { signedIn: false };

export function readAuthHint(): AuthHint {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SIGNED_OUT;
    const parsed = JSON.parse(raw) as AuthHint;
    return parsed?.signedIn ? parsed : SIGNED_OUT;
  } catch {
    // Private window ya storage band — logged-out maan lo, yahi mehfooz hai.
    return SIGNED_OUT;
  }
}

export function writeAuthHint(hint: AuthHint | null): void {
  try {
    if (hint) localStorage.setItem(KEY, JSON.stringify(hint));
    else localStorage.removeItem(KEY);
  } catch {
    // Na likh sake to header ek page load peeche reh jayega. Bas itna hi.
  }
}

/** Role ke hisaab se uska apna dashboard. */
export function homeForRole(role: Role | undefined): string {
  return role === 'tutor' ? '/tutor/dashboard' : '/parent/dashboard';
}
