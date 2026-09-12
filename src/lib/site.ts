// =============================================================================
// src/lib/site.ts — ek jagah site-wide constants
// =============================================================================

export const SITE = {
  name: 'ApnaTutor',
  url: 'https://apnatutor.com',
  /** Roman Urdu UI, English SEO — isliye ur-Latn-PK */
  lang: 'ur-Latn-PK',
  ogLocale: 'ur_PK',
  tagline: 'Apne area ka right tutor, ek jagah.',
  description:
    'Pakistan mein apne area ka verified home tutor ya online tutor dhoondein. Class, subject, area aur budget select karein.',
  /** Organization JSON-LD ke liye. Page live hone par sahi URL daalo. */
  sameAs: [] as string[],
} as const;

export const env = {
  gtmId: import.meta.env.PUBLIC_GTM_ID ?? '',
  ga4Id: import.meta.env.PUBLIC_GA4_ID ?? '',
  metaPixelId: import.meta.env.PUBLIC_META_PIXEL_ID ?? '',
  cloudinaryCloud: import.meta.env.PUBLIC_CLOUDINARY_CLOUD ?? '',
  cloudinaryPreset: import.meta.env.PUBLIC_CLOUDINARY_PRESET ?? '',
} as const;

/** Har canonical absolute honi chahiye (docs/03-SEO-ANALYTICS.md §4). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).href;
}
