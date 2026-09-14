// =============================================================================
// src/lib/admin-promos.ts — ishtihaar ka saara Firestore kaam
//
// ★ Ye file sirf admin panel chalata hai. Asli hifazat firestore.rules hai:
//   agar koi aur ye functions call kare to Firestore usay rok dega.
//
// ★ Tasveer yahan base64 shakal mein Firestore ke andar jati hai, kyunki
//   Spark plan par Firebase Storage nahi hai. Build ke waqt wo wapis asli
//   file ban jati hai (scripts/fetch-data.mjs). Isi liye upload se pehle
//   tasveer ko chhota karna LAZMI hai — Firestore ka ek document zyada se
//   zyada 1 MB ka ho sakta hai, aur us hadd se takrane par error bohat
//   ajeeb shakal mein aata hai.
// =============================================================================

import { getFirebase } from './firebase';
import type { Promo, PromoBilling, PromoStat } from './types';

/** Firestore doc 1 MB ka hota hai; base64 asli size se ~33% bara hota hai. */
export const MAX_IMAGE_BYTES = 700 * 1024;

/** Admin ke form ka poora data — public hissa + paison ka hisaab. */
export type PromoDraft = Omit<Promo, 'id' | 'createdAt' | 'updatedAt' | 'image'> &
  PromoBilling & { imageData?: string | null };

export interface PromoRow extends Promo {
  billing: PromoBilling;
  /** Kya is ad ke saath koi tasveer rakhi hai. */
  hasImage: boolean;
  /** Preview ke liye — sirf admin panel mein, site par kabhi nahi. */
  imageData?: string | null;
}

// ---------------------------------------------------------------------------
// Padhna
// ---------------------------------------------------------------------------

export async function listPromos(): Promise<PromoRow[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, query } = await import('firebase/firestore');

  // rules: capped(100)
  const snap = await getDocs(query(collection(db, 'promos'), limit(100)));

  return snap.docs
    .map((d) => {
      const { contact, amount, paid, notes, imageData, ...rest } = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        ...(rest as unknown as Omit<Promo, 'id'>),
        billing: { contact, amount, paid, notes } as PromoBilling,
        hasImage: typeof imageData === 'string' && imageData.length > 0,
        imageData: (imageData as string | undefined) ?? null,
      } satisfies PromoRow;
    })
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

// ---------------------------------------------------------------------------
// Likhna
// ---------------------------------------------------------------------------

/**
 * `imageData: undefined` ka matlab "tasveer ko haath na lagao".
 * `imageData: null` ka matlab "tasveer hata do".
 * Ye farq is liye zaroori hai ke sirf naam badalne par purani tasveer ud na jaye.
 */
export async function savePromo(id: string | null, draft: PromoDraft): Promise<string> {
  const { db } = await getFirebase();
  const { addDoc, collection, doc, serverTimestamp, updateDoc } = await import('firebase/firestore');

  const { imageData, ...rest } = draft;
  const data: Record<string, unknown> = { ...rest, updatedAt: serverTimestamp() };
  if (imageData !== undefined) data.imageData = imageData;

  if (id) {
    await updateDoc(doc(db, 'promos', id), data);
    return id;
  }

  const ref = await addDoc(collection(db, 'promos'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function setPromoActive(id: string, active: boolean): Promise<void> {
  const { db } = await getFirebase();
  const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'promos', id), { active, updatedAt: serverTimestamp() });
}

export async function deletePromo(id: string): Promise<void> {
  const { db } = await getFirebase();
  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'promos', id));
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** Pakistan UTC+5 — promo-stats.ts aur firestore.rules mein bilkul yahi hisaab hai. */
export function pkDay(now = Date.now()): number {
  return Math.floor((now + 5 * 60 * 60 * 1000) / 86_400_000);
}

export function dayToDate(day: number): Date {
  return new Date(day * 86_400_000 - 5 * 60 * 60 * 1000);
}

export interface PromoTotals {
  views: number;
  clicks: number;
  days: number;
}

/**
 * Pichle `days` dinon ke numbers, har ad ke liye jama kiye hue.
 *
 * ★ Query sirf EK field (`day`) par hai, is liye koi composite index nahi
 *   chahiye — Firestore har single field par khud index rakhta hai. Do
 *   fields par filter karte (jaise day + promoId) to index banana parta.
 */
export async function promoTotals(days = 30): Promise<Map<string, PromoTotals>> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, query, where } = await import('firebase/firestore');

  const since = pkDay() - days + 1;
  // rules: capped(400)
  const snap = await getDocs(
    query(collection(db, 'promoStats'), where('day', '>=', since), limit(400))
  );

  const out = new Map<string, PromoTotals>();
  for (const d of snap.docs) {
    const s = d.data() as unknown as PromoStat;
    const cur = out.get(s.promoId) ?? { views: 0, clicks: 0, days: 0 };
    cur.views += s.views ?? 0;
    cur.clicks += s.clicks ?? 0;
    cur.days += 1;
    out.set(s.promoId, cur);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tasveer chhoti karna — browser mein, upload se pehle
// ---------------------------------------------------------------------------

/**
 * Phone se chuni hui tasveer ko chhota aur halka kar ke data: URI banata hai.
 *
 * ★ Phone ka camera aaj kal 4000px chaurai ki tasveer deta hai — wo seedhi
 *   bhejein to Firestore ki 1 MB ki hadd se takra jati hai. Yahan usay
 *   canvas par chhota kar ke JPEG bana dete hain.
 *
 * ★ Agar pehli koshish mein bhi bari rahe to quality ghata kar dobara —
 *   banday ko "tasveer choti karke laao" kehna us se tasveer editor
 *   khulwana hai, aur wo wahin kaam chhor deta hai.
 */
export async function shrinkImage(file: File, maxW: number): Promise<{ dataUrl: string; w: number; h: number }> {
  // SVG aur GIF ko chhera nahi ja sakta — canvas un ki harkat khatam kar deta
  // hai. Wo waise hi jate hain, agar hadd mein hon.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `Ye ${file.type === 'image/gif' ? 'GIF' : 'SVG'} bohat bari hai ` +
          `(${Math.round(file.size / 1024)} KB). ${Math.round(MAX_IMAGE_BYTES / 1024)} KB se chhoti chahiye.`
      );
    }
    return { dataUrl, w: 0, h: 0 };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Is browser mein tasveer chhoti nahi ki ja sakti.');

  // PNG ki shaffafiyat JPEG mein kaali ho jati hai — safed background pehle.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  for (const q of [0.82, 0.7, 0.58, 0.45]) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    if (dataUrl.length <= MAX_IMAGE_BYTES) return { dataUrl, w, h };
  }

  throw new Error(
    'Ye tasveer bohat bari hai. Koi doosri tasveer chunein, ya phone ki gallery se ' +
      'usay crop kar ke chhota kar lein.'
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Tasveer parhi nahi ja saki.'));
    r.readAsDataURL(file);
  });
}
