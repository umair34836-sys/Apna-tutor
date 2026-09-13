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

// -----------------------------------------------------------------------------
// SERVICE AREA — site kahan chalti hai
// -----------------------------------------------------------------------------

export interface ServiceArea {
  /** URL mein aata hai: /city/gunderi-payan, /maths-tutor-gunderi-payan */
  slug: string;
  /** Har title, H1 aur dropdown mein yahi naam dikhta hai. */
  name: string;
  district: string;
  province: string;
  /** Ye ek gaon hai ya sheher — UI ka lafz isi se badalta hai. */
  kind: 'village' | 'city';
  /**
   * Dropdown ke default mohallay. Firestore mein `cities/{slug}.areas` mojood
   * ho to wo in par bhaari hai (scripts/import-areas.mjs se aate hain).
   */
  areas: string[];
}

/**
 * ★ SITE FILHAAL SIRF IN AREAS MEIN CHALTI HAI.
 *
 * Ye list is poore project ka geographic daira hai. Jo tutor, city page, SEO
 * combo page ya dropdown option is list se bahar hai, wo site par aata hi
 * nahi — src/lib/data.ts ismein se filter karti hai.
 *
 * ─── Naya gaon ya sheher add karna ho to: ────────────────────────────────
 *   1. Neeche ek entry barhayein (slug chhote haroof mein, dash ke saath).
 *   2. Firestore mein `cities/{slug}` ka `intro` likhein — 120+ words, unique.
 *      Iske bagair us area ka SEO page NAHI banega (thin-page gate,
 *      src/lib/seo.ts). Ye jaan boojh kar hai.
 *   3. Mohallay `data/areas-{slug}.csv` mein daal kar import kar lein.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: 'gunderi-payan',
    name: 'Gunderi Payan',
    district: 'Nowshera',
    province: 'Khyber Pakhtunkhwa',
    kind: 'village',
    // Filhaal poora gaon ek hi area hai. Mohallay confirm hotay hi
    // data/areas-gunderi-payan.csv se import ho kar yahan ki jagah le lenge.
    areas: ['Gunderi Payan'],
  },
];

/** `true` jab sirf ek hi area ho — forms tab dropdown ke bajaye usay fix kar dete hain. */
export const IS_SINGLE_AREA = SERVICE_AREAS.length === 1;

/** Sirf tab set hota hai jab ek hi area ho. Copy aur JSON-LD isay parhte hain. */
export const ONLY_AREA: ServiceArea | null = IS_SINGLE_AREA ? SERVICE_AREAS[0] : null;

/** "Gunderi Payan, Nowshera" — pata batane ke liye. */
export const SERVICE_AREA_LABEL = ONLY_AREA
  ? `${ONLY_AREA.name}, ${ONLY_AREA.district}`
  : `${SERVICE_AREAS.length} areas`;

/** Sirf area ka naam — titles aur H1 ke liye. */
export const SERVICE_AREA_NAME = ONLY_AREA ? ONLY_AREA.name : 'Pakistan';

/** "gaon" ya "sheher" — labels isay istemal karte hain. */
export const AREA_WORD = ONLY_AREA?.kind === 'village' ? 'gaon' : 'sheher';

/** Form label ke liye wahi lafz, bare haroof se: "Gaon" / "Sheher". */
export const AREA_LABEL = AREA_WORD === 'gaon' ? 'Gaon' : 'Sheher';

/** JSON-LD `areaServed` — Google ko batata hai ke daira kitna hai. */
export const AREA_SERVED = ONLY_AREA
  ? {
      '@type': 'Place',
      name: `${ONLY_AREA.name}, ${ONLY_AREA.district}, ${ONLY_AREA.province}, Pakistan`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: ONLY_AREA.name,
        addressRegion: ONLY_AREA.province,
        addressCountry: 'PK',
      },
    }
  : { '@type': 'Country', name: 'Pakistan' };

/**
 * Subjects ki default list.
 *
 * Cities ki tarah, ye isliye code mein hai ke site Firestore khali hone par
 * bhi chale — warna registration aur request forms "abhi band hain" dikhate
 * rehte hain aur koi tutor onboard hi nahi ho sakta.
 *
 * Ye DATA nahi, TAXONOMY hai — CLASSES aur BOARDS ki tarah. Har subject ka
 * `intro` (SEO page ke liye) admin Firestore mein likhta hai; wahan ka
 * document is list par bhaari hai.
 */
export const DEFAULT_SUBJECTS: { slug: string; name: string; nameUrdu: string }[] = [
  { slug: 'mathematics',      name: 'Mathematics',      nameUrdu: 'Maths' },
  { slug: 'physics',          name: 'Physics',          nameUrdu: 'Physics' },
  { slug: 'chemistry',        name: 'Chemistry',        nameUrdu: 'Chemistry' },
  { slug: 'biology',          name: 'Biology',          nameUrdu: 'Biology' },
  { slug: 'english',          name: 'English',          nameUrdu: 'English' },
  { slug: 'urdu',             name: 'Urdu',             nameUrdu: 'Urdu' },
  { slug: 'computer-science', name: 'Computer Science', nameUrdu: 'Computer' },
  { slug: 'general-science',  name: 'General Science',  nameUrdu: 'General Science' },
  { slug: 'islamiat',         name: 'Islamiat',         nameUrdu: 'Islamiat' },
  { slug: 'pakistan-studies', name: 'Pakistan Studies', nameUrdu: 'Pak Studies' },
  { slug: 'accounting',       name: 'Accounting',       nameUrdu: 'Accounting' },
];

// -----------------------------------------------------------------------------

export const SITE = {
  name: 'ApnaTutor',
  url: import.meta.env.SITE ?? 'https://apnatutor.com',
  /** Roman Urdu UI, English SEO — isliye ur-Latn-PK */
  lang: 'ur-Latn-PK',
  ogLocale: 'ur_PK',
  tagline: `Apne ${AREA_WORD} ka right tutor, ek jagah.`,
  description: `${SERVICE_AREA_LABEL} mein verified home tutor ya online tutor dhoondein. Class, subject aur budget select karein — parents ke liye bilkul free.`,
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
