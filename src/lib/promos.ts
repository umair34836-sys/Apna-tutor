// =============================================================================
// src/lib/promos.ts — build time par ishtihaar chunna
//
// ★ Ye module SIRF build time par chalta hai (Node). Browser mein promos
//   Firestore se NAHI aate — wo HTML mein pehle se pak kar aate hain. Wajah:
//   har page view par Firestore read karna roz 50,000 ki hadd kha jata, aur
//   ad baad mein aane se page hilta.
//
// ★ Tareekh ka faisla browser mein hota hai, build par nahi. Build sirf ye
//   tay karti hai ke kaun kaun se ad is slot ke liye mumkin hain; un mein se
//   "aaj kaun sa" ka faisla PromoSlot.astro ka chhota sa script karta hai.
//   Isi liye "agle pir se shuru" wala ad bina naye rebuild ke apne waqt par
//   khud chalu ho jata hai.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSlotId } from './promo-slots';
import type { Promo } from './types';

const DATA_DIR = join(process.cwd(), 'src', 'data');

function read(): Promo[] {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, 'promos.json'), 'utf8')) as Promo[];
  } catch {
    // File na ho (fresh clone, ya credentials ke bagair build) — koi ad nahi.
    // Khali chalao, banao mat.
    return [];
  }
}

/**
 * Sab promos jo kabhi dikh sakte hain.
 *
 * `active: false` yahin chhant diya jata hai — banda jise band kar chuka wo
 * HTML mein jana hi nahi chahiye. Magar tareekh yahan nahi dekhi jati (upar
 * wali wajah).
 */
const all: Promo[] = read().filter(
  (p) =>
    p.active &&
    // ★ Scheme dobara jaancha ja raha hai — build script bhi jaanchti hai.
    //   Do jagah is liye ke ye aakhri darwaza hai jis se guzar kar link HTML
    //   mein jata hai. `javascript:` wala link seedha XSS hota hai.
    /^https?:\/\//i.test(p.href ?? '') &&
    Array.isArray(p.slots) &&
    p.slots.some(isSlotId)
);

/** Kisi ek slot ke liye mumkin ads — bara wazan pehle. */
export function promosForSlot(slotId: string): Promo[] {
  return all
    .filter((p) => p.slots.includes(slotId))
    .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
}

/** Kya kisi bhi jagah koi ad hai? Docs aur admin ke liye. */
export const hasAnyPromo = all.length > 0;

/** Sirf gin'ti ke liye — build ke waqt log mein dikhane ke kaam aata hai. */
export const promoCount = all.length;
