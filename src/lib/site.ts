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
  contactEmail: import.meta.env.PUBLIC_CONTACT_EMAIL ?? '',
  /** ApnaTutor ka apna number. SEO gate ke phone-leak check se mustasna hai. */
  officialWhatsapp: import.meta.env.PUBLIC_OFFICIAL_WHATSAPP ?? '',
  /** "owner/repo" — /admin/rebuild isay GitHub Actions trigger karne ke liye padhta hai. */
  githubRepo: import.meta.env.PUBLIC_GITHUB_REPO ?? '',
  /** Workflow ka file name. */
  githubWorkflow: import.meta.env.PUBLIC_GITHUB_WORKFLOW ?? 'deploy.yml',
} as const;

/**
 * /teachers par ek page mein kitne tutors.
 *
 * ★ Ye yahan isliye hai ke Astro ka `getStaticPaths` sirf imports dekh sakta
 *   hai — page file ke apne module-level consts bhi us tak nahi pohanchte.
 */
export const TUTORS_PER_PAGE = 24;

/** Har canonical absolute honi chahiye (docs/03-SEO-ANALYTICS.md §4). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).href;
}
