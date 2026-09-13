// =============================================================================
// src/lib/photo.ts — profile photos, Firestore ke andar
//
// Koi bahar ki service nahi (na Cloudinary), aur Cloud Storage bhi nahi. Poora
// backend Firebase hai, aur Functions bhi istemal nahi hote — to photo ki bytes
// rakhne ki ek hi jagah bachti hai: Firestore document, base64 data URI ke taur
// par.
//
// Ye is scale par kaam karta hai kyunki photo upload se PEHLE browser mein
// simat jati hai:
//     600x600 tak, JPEG q0.82  →  taqreeban 40-70 KB
//     base64 ke baad            →  taqreeban 55-95 KB
//     Firestore ka document cap →  1 MiB
// Yani ek photo cap ka 10% se bhi kam leti hai, aur 1 GiB free storage mein
// hazaron profiles aa jati hain.
//
// ★ SIRF profile photo. Shanakhti dastavez (CNIC, B-Form, degree) yahan KABHI
//   nahi — is file mein aisa koi function hai hi nahi. docs/05-RISKS.md §2.
// =============================================================================

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // asli file, shrink se pehle
export const MAX_DATA_URL_CHARS = 300_000;       // profile photo ki hadd (rules mein bhi)
export const MAX_THUMB_CHARS = 30_000;           // card thumbnail ki hadd
export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const FULL_DIMENSION = 600;   // profile page
const THUMB_DIMENSION = 96;   // tutor cards
const QUALITY = 0.82;

/** File theek hai? Na ho to Roman Urdu mein wajah. */
export function validatePhoto(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Sirf JPG, PNG ya WebP photo chalegi.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Photo 5 MB se chhoti honi chahiye.';
  return null;
}

export interface PreparedPhoto {
  /** 600px — sirf tutor ki apni profile page par */
  dataUrl: string;
  /** 96px — tutor cards par (search results, listings) */
  thumbUrl: string;
}

function render(bitmap: ImageBitmap, maxDimension: number, cap: number): string {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Is browser mein photo process nahi ho saki. Photo ke bagair aage barh sakte hain.');

  // JPEG shafaaf (transparent) hissa kaala kar deta hai — isliye pehle safed.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Hadd se bari nikle to quality kam karke dobara — user ko "photo bari hai"
  // keh kar wapas bhejne se behtar hai ke hum khud chhoti kar dein.
  for (const quality of [QUALITY, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= cap) return dataUrl;
  }

  throw new Error('Ye photo bohat bari hai. Koi doosri photo chunein.');
}

/**
 * Do size banata hai — aur yahi is design ki asli wajah hai:
 *
 * Photos static HTML mein baked hoti hain. Ek city page par 30 cards hote
 * hain; agar har card par 600px wali photo hoti to page 2.4 MB ka ban jata.
 * Cards par 96px thumbnail (~6 KB) jati hai, aur 600px wali sirf us tutor ki
 * apni profile page par.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const problem = validatePhoto(file);
  if (problem) throw new Error(problem);

  const bitmap = await createImageBitmap(file);
  try {
    return {
      dataUrl: render(bitmap, FULL_DIMENSION, MAX_DATA_URL_CHARS),
      thumbUrl: render(bitmap, THUMB_DIMENSION, MAX_THUMB_CHARS),
    };
  } finally {
    bitmap.close?.();
  }
}

/** Approximate KB — UI mein dikhane ke liye. */
export const dataUrlKb = (dataUrl: string) => Math.round((dataUrl.length * 0.75) / 1024);
