// =============================================================================
// src/lib/taxonomy.ts
//
// Classes, boards aur modes ke canonical slugs + labels. Ye DATA nahi, LABELS
// hain — cities aur subjects ki tarah Firestore se nahi aate, kyunki inki list
// fix hai aur har jagah ek jaisi honi chahiye:
//   - tutor registration form (Phase 4)
//   - search filters (Phase 5)
//   - SEO combo page slugs
//
// Ek hi jagah rakhne ka faida: form mein "olevel" likha aur page mein "o-level"
// likha — aisa mismatch ho hi nahi sakta.
// =============================================================================

export interface Term {
  slug: string;
  /** URL mein jo aata hai — SEO ke liye English. */
  urlSlug: string;
  /** Page title / H1 ke liye — English. */
  label: string;
  /** UI ke liye — Roman Urdu. */
  labelUrdu: string;
}

export const CLASSES: Term[] = [
  { slug: 'primary', urlSlug: 'primary',  label: 'Primary (Class 1–5)', labelUrdu: 'Class 1–5 (Primary)' },
  { slug: 'middle',  urlSlug: 'middle',   label: 'Middle (Class 6–8)',  labelUrdu: 'Class 6–8 (Middle)' },
  { slug: '9',       urlSlug: 'class-9',  label: 'Class 9',             labelUrdu: 'Class 9' },
  { slug: '10',      urlSlug: 'class-10', label: 'Class 10 (Matric)',   labelUrdu: 'Class 10 (Matric)' },
  { slug: 'fsc',     urlSlug: 'fsc',      label: 'FSc / Intermediate',  labelUrdu: 'FSc / Intermediate' },
  { slug: 'olevel',  urlSlug: 'o-level',  label: 'O Level',             labelUrdu: 'O Level' },
  { slug: 'alevel',  urlSlug: 'a-level',  label: 'A Level',             labelUrdu: 'A Level' },
  { slug: 'bs',      urlSlug: 'bs',       label: 'University / BS',     labelUrdu: 'University / BS' },
];

export const BOARDS: Term[] = [
  { slug: 'fbise',   urlSlug: 'fbise',   label: 'FBISE',           labelUrdu: 'FBISE (Federal)' },
  { slug: 'kpk',     urlSlug: 'kpk',     label: 'KPK Board',       labelUrdu: 'KPK Board' },
  { slug: 'punjab',  urlSlug: 'punjab',  label: 'Punjab Board',    labelUrdu: 'Punjab Board' },
  { slug: 'sindh',   urlSlug: 'sindh',   label: 'Sindh Board',     labelUrdu: 'Sindh Board' },
  { slug: 'olevel',  urlSlug: 'o-level', label: 'O Level',         labelUrdu: 'O Level (Cambridge)' },
  { slug: 'alevel',  urlSlug: 'a-level', label: 'A Level',         labelUrdu: 'A Level (Cambridge)' },
  { slug: 'agha-khan', urlSlug: 'agha-khan', label: 'Agha Khan Board', labelUrdu: 'Agha Khan Board' },
];

export const MODES: Term[] = [
  { slug: 'home',      urlSlug: 'home',       label: 'Home tuition',          labelUrdu: 'Teacher aapke ghar aaye' },
  // Gaon mein ye sabse aam soorat hai — bachay teacher ke ghar parhne jate
  // hain. Isay chhorna ka matlab tha ke asli tutors "home tuition" par tick
  // laga kar ghalat waada karte, ya kuch bhi tick na kar patay.
  { slug: 'tutorhome', urlSlug: 'tutor-home', label: "Tuition at tutor's home", labelUrdu: 'Student teacher ke ghar jaye' },
  { slug: 'online',    urlSlug: 'online',     label: 'Online',                labelUrdu: 'Online tuition' },
];

export const GENDERS: Term[] = [
  { slug: 'female', urlSlug: 'female', label: 'Female', labelUrdu: 'Female teacher' },
  { slug: 'male',   urlSlug: 'male',   label: 'Male',   labelUrdu: 'Male teacher' },
];

const index = (terms: Term[]) => new Map(terms.map((t) => [t.slug, t]));

export const CLASS_BY_SLUG = index(CLASSES);
export const BOARD_BY_SLUG = index(BOARDS);
export const MODE_BY_SLUG = index(MODES);
export const GENDER_BY_SLUG = index(GENDERS);

export const classLabel = (slug: string) => CLASS_BY_SLUG.get(slug)?.labelUrdu ?? slug;
export const boardLabel = (slug: string) => BOARD_BY_SLUG.get(slug)?.labelUrdu ?? slug;
export const modeLabel = (slug: string) => MODE_BY_SLUG.get(slug)?.labelUrdu ?? slug;

/** "Rs. 3,000 – 6,000" */
export function feeRange(min: number, max: number): string {
  const f = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
  return min === max ? f(min) : `${f(min)} – ${max.toLocaleString('en-PK')}`;
}

/** Naam se initials — avatar ke liye (koi photo na ho to). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
