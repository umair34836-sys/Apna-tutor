// =============================================================================
// src/lib/site.ts — ek jagah site-wide constants
// =============================================================================

/**
 * Base path — project page par `/Apna-tutor/`, custom domain par `/`.
 * Astro ye `base` config se khud set karta hai.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/**
 * Har internal link isi se guzarta hai.
 *
 *   url('/find-tutor')  →  '/Apna-tutor/find-tutor'   (project page par)
 *                       →  '/find-tutor'              (custom domain par)
 *
 * ★ Kisi bhi page ya script mein `href="/kuch"` seedha na likhein — project
 *   page par wo domain ki jar par chala jata hai aur 404 deta hai.
 *   scripts/validate-links.mjs build ke baad ye pakad leta hai.
 */
export function url(path: string): string {
  if (!path.startsWith('/')) return path; // bahar ka link, mailto, #anchor
  return `${BASE}${path}` || '/';
}

export const SITE = {
  name: 'ApnaTutor',
  url: import.meta.env.SITE ?? 'https://apnatutor.com',
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
  return new URL(url(path), SITE.url).href;
}
