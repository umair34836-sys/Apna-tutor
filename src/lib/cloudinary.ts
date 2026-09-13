// =============================================================================
// src/lib/cloudinary.ts — profile photo upload
//
// Firebase Cloud Storage Spark plan par available nahi (3 Feb 2026 se Blaze
// zaroori), isliye photos Cloudinary par jati hain — unsigned preset se,
// kyunki signed upload ke liye server chahiye hota hai.
//
// ★ SIRF profile photo. Shanakhti dastavez (CNIC, B-Form, degree) yahan KABHI
//   nahi — Cloudinary URLs public hote hain, aur ek URL leak = ek shanakhti
//   dastavez leak. Wajah docs/05-RISKS.md §2 mein hai. Isliye is file mein
//   koi "document upload" function hai hi nahi, aur na hona chahiye.
// =============================================================================

import { env } from './site';

export const MAX_BYTES = 3 * 1024 * 1024; // preset par bhi 3 MB cap hai
export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadResult { url: string; publicId: string }

/** File theek hai? Na ho to Roman Urdu mein wajah. */
export function validatePhoto(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Sirf JPG, PNG ya WebP photo chalegi.';
  if (file.size > MAX_BYTES) return 'Photo 3 MB se chhoti honi chahiye.';
  return null;
}

export async function uploadPhoto(file: File): Promise<UploadResult> {
  if (!env.cloudinaryCloud || !env.cloudinaryPreset) {
    throw new Error('Photo upload abhi set nahi hua. Aap photo ke bagair bhi profile bhej sakte hain.');
  }

  const problem = validatePhoto(file);
  if (problem) throw new Error(problem);

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', env.cloudinaryPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.cloudinaryCloud}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    throw new Error('Photo upload nahi ho saki. Dobara koshish karein ya photo ke bagair aage barhein.');
  }

  const data = (await res.json()) as { secure_url?: string; public_id?: string };
  if (!data.secure_url || !data.public_id) {
    throw new Error('Photo upload nahi ho saki. Dobara koshish karein.');
  }

  return { url: data.secure_url, publicId: data.public_id };
}

/** Display ke liye chhoti, optimized image — credits bachati hai. */
export function thumb(url: string, width = 400): string {
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}
