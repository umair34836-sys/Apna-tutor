// =============================================================================
// src/lib/seo.ts — SEO combo pages kaun si banti hain, aur kyun
//
// ⚠ Ye file is project ki sabse nazuk SEO file hai. Hazaron auto-generated
//   patli pages Google ki nazar mein DOORWAY PAGES hain, aur uski penalty poori
//   site ko le doobti hai. Isliye yahan teen gates hain — teeno pass hon tabhi
//   page banta hai:
//
//     1. Us combo ke kam az kam 3 approved tutors hon
//     2. Us page ka apna intro text 120+ words ka ho
//     3. Wo intro text kisi doosre page par pehle se na ho
//
//   Gate 3 khaas taur par ahem hai: agar /home-tutor-risalpur aur
//   /city/risalpur par bilkul wahi paragraph ho, to wo do pages nahi — ek page
//   ka doorway version hai.
//
//   Jo page gate pass na kare wo banta hi nahi — us URL ko 404 rehne dete hain.
//   scripts/validate-seo.mjs build ke baad dobara check karta hai.
// =============================================================================

import { cities, subjects, tutors } from './data';
import { BOARDS, CLASSES, GENDERS } from './taxonomy';
import { isFeatured, type City, type Subject, type Tutor } from './types';

export const MIN_TUTORS_PER_PAGE = 3;
export const MIN_INTRO_WORDS = 120;

export type ComboKind = 'subject' | 'home' | 'tutorhome' | 'online' | 'gender' | 'class' | 'board';

export interface ComboPage {
  slug: string;
  kind: ComboKind;
  city: City;
  subject?: Subject;
  tutors: Tutor[];
  title: string;
  description: string;
  h1: string;
  lead: string;
  intro: string[];
  breadcrumbs: { name: string; url: string }[];
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Featured pehle, phir naya update — wahi tarteeb jo search results mein hai. */
export function rank(list: Tutor[]): Tutor[] {
  return [...list].sort((a, b) => {
    const fa = Number(isFeatured(a));
    const fb = Number(isFeatured(b));
    if (fa !== fb) return fb - fa;
    return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
  });
}

/**
 * Page ka intro. Pehle admin ka page-specific text dekhta hai; wo na ho to
 * city + subject ke intro jorta hai (jaisa docs/02-PAGES-SPEC.md kehti hai).
 */
function introFor(slug: string, city: City, subject?: Subject): string[] {
  const override = city.pageIntros?.[slug];
  if (override && words(override) >= MIN_INTRO_WORDS) return [override];
  return [city.intro, subject?.intro].filter((p): p is string => Boolean(p && p.trim()));
}

/** 50–60 chars target. Zyada lamba ho to Google khud kaat deta hai. */
function title(text: string): string {
  const suffix = ' | ApnaTutor';
  const max = 60 - suffix.length;
  return (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text) + suffix;
}

/** 140–160 chars target, aur ismein ASLI tutor count hota hai. */
function description(text: string): string {
  return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
}

const crumb = (name: string, url: string) => ({ name, url });

// ---------------------------------------------------------------------------
// Har combo ka definition
// ---------------------------------------------------------------------------

interface Candidate {
  slug: string;
  kind: ComboKind;
  city: City;
  subject?: Subject;
  match: (t: Tutor) => boolean;
  h1: string;
  lead: string;
  titleText: (n: number) => string;
  descText: (n: number) => string;
  extraCrumbs?: { name: string; url: string }[];
}

function candidates(): Candidate[] {
  const out: Candidate[] = [];

  for (const city of cities) {
    const cityName = city.name;

    // /[subject]-tutor-[city]
    for (const subject of subjects) {
      out.push({
        slug: `${subject.slug}-tutor-${city.slug}`,
        kind: 'subject',
        city,
        subject,
        match: (t) => t.city === city.slug && t.subjects.includes(subject.slug),
        h1: `${subject.name} Tutors in ${cityName}`,
        lead: `${cityName} mein ${subject.name} parhane wale verified tutors. Profile khol kar fee, timing aur tajurba dekhein.`,
        titleText: (n) => `${subject.name} Tutors in ${cityName} — ${n} Verified`,
        descText: (n) =>
          `${cityName} mein ${n} verified ${subject.name.toLowerCase()} tutors. Class, board aur budget ke hisaab se filter karein. Parents ke liye bilkul free.`,
        extraCrumbs: [crumb(subject.name, `/subject/${subject.slug}`)],
      });
    }

    // /home-tutor-[city]
    out.push({
      slug: `home-tutor-${city.slug}`,
      kind: 'home',
      city,
      match: (t) => t.city === city.slug && t.modes.includes('home'),
      h1: `Home Tutors in ${cityName}`,
      lead: `${cityName} mein ghar aa kar parhane wale verified tutors.`,
      titleText: (n) => `Home Tutors in ${cityName} — ${n} Verified`,
      descText: (n) =>
        `${cityName} mein ${n} verified home tutors jo aapke ghar aa kar parhate hain. Subject, class aur budget ke hisaab se dekhein. Parents ke liye free.`,
    });

    // /tuition-at-tutor-home-[city]
    //
    // Gaon ki asli soorat-e-haal: bachay teacher ke ghar jate hain. Iska apna
    // page isliye hai ke parent jo search karta hai ("tutor ke ghar tuition")
    // wo "home tutor" se bilkul alag cheez hai — aur dono ko ek page par
    // milana parent ko ghalat tutor tak le jata.
    out.push({
      slug: `tuition-at-tutor-home-${city.slug}`,
      kind: 'tutorhome',
      city,
      match: (t) => t.city === city.slug && t.modes.includes('tutorhome'),
      h1: `Tuition at Tutor's Home in ${cityName}`,
      lead: `${cityName} ke wo verified teachers jinke ghar ja kar bachay parh sakte hain.`,
      titleText: (n) => `Tuition at Tutor's Home in ${cityName} — ${n}`,
      descText: (n) =>
        `${cityName} mein ${n} verified teachers jinke ghar ja kar tuition li ja sakti hai. Subject, class aur budget ke hisaab se dekhein. Parents ke liye free.`,
    });

    // /online-tutor-[city]
    out.push({
      slug: `online-tutor-${city.slug}`,
      kind: 'online',
      city,
      match: (t) => t.city === city.slug && t.modes.includes('online'),
      h1: `Online Tutors in ${cityName}`,
      lead: `${cityName} ke wo tutors jo online parhate hain — ghar se, apne waqt par.`,
      titleText: (n) => `Online Tutors in ${cityName} — ${n} Verified`,
      descText: (n) =>
        `${cityName} ke ${n} verified online tutors. Video par live tuition, subject aur class ke hisaab se. Parents ke liye bilkul free.`,
    });

    // /female-tutor-[city], /male-tutor-[city]
    for (const g of GENDERS) {
      out.push({
        slug: `${g.urlSlug}-tutor-${city.slug}`,
        kind: 'gender',
        city,
        match: (t) => t.city === city.slug && t.gender === g.slug,
        h1: `${g.label} Tutors in ${cityName}`,
        lead: `${cityName} ki verified ${g.labelUrdu.toLowerCase()}s — ghar par, teacher ke ghar, ya online.`,
        titleText: (n) => `${g.label} Tutors in ${cityName} — ${n} Verified`,
        descText: (n) =>
          `${cityName} mein ${n} verified ${g.label.toLowerCase()} tutors. Subject, class aur area ke hisaab se filter karein. Parents ke liye free.`,
      });
    }

    // /class-[n]-tutor-[city] waghaira
    for (const c of CLASSES) {
      out.push({
        slug: `${c.urlSlug}-tutor-${city.slug}`,
        kind: 'class',
        city,
        match: (t) => t.city === city.slug && t.classes.includes(c.slug),
        h1: `${c.label} Tutors in ${cityName}`,
        lead: `${cityName} mein ${c.labelUrdu} parhane wale verified tutors.`,
        titleText: (n) => `${c.label} Tutors in ${cityName} — ${n} Verified`,
        descText: (n) =>
          `${cityName} mein ${c.label} ke ${n} verified tutors. Subject aur budget ke hisaab se dekhein, seedha rabta karein. Parents ke liye free.`,
      });
    }

    // /[board]-tutor-[city]
    for (const b of BOARDS) {
      out.push({
        slug: `${b.urlSlug}-tutor-${city.slug}`,
        kind: 'board',
        city,
        match: (t) => t.city === city.slug && t.boards.includes(b.slug),
        h1: `${b.label} Tutors in ${cityName}`,
        lead: `${cityName} mein ${b.labelUrdu} ka syllabus parhane wale verified tutors.`,
        titleText: (n) => `${b.label} Tutors in ${cityName} — ${n} Verified`,
        descText: (n) =>
          `${cityName} mein ${b.label} syllabus ke ${n} verified tutors. Class aur subject ke hisaab se filter karein. Parents ke liye free.`,
      });
    }
  }

  return out;
}

/**
 * Wo saare combo pages jo teeno gates pass karte hain. Jo pass na kare wo is
 * list mein nahi aata — yani us URL par page banta hi nahi.
 */
export function comboPages(): ComboPage[] {
  const seenIntro = new Set<string>();
  const seenSlug = new Set<string>();

  // City aur subject pages ke intro pehle register kar lo — variant pages unhe
  // dobara use na kar sakein.
  for (const c of cities) if (c.intro) seenIntro.add(norm(c.intro));
  for (const s of subjects) if (s.intro) seenIntro.add(norm(s.intro));

  const pages: ComboPage[] = [];

  for (const c of candidates()) {
    if (seenSlug.has(c.slug)) continue;               // slug collision (misal: o-level class aur board)

    const matched = rank(tutors.filter(c.match));
    if (matched.length < MIN_TUTORS_PER_PAGE) continue;   // gate 1

    const intro = introFor(c.slug, c.city, c.subject);
    const total = intro.reduce((n, p) => n + words(p), 0);
    if (total < MIN_INTRO_WORDS) continue;                // gate 2

    const key = norm(intro.join(' '));
    if (seenIntro.has(key)) continue;                     // gate 3
    seenIntro.add(key);
    seenSlug.add(c.slug);

    const n = matched.length;
    pages.push({
      slug: c.slug,
      kind: c.kind,
      city: c.city,
      subject: c.subject,
      tutors: matched,
      title: title(c.titleText(n)),
      description: description(c.descText(n)),
      h1: c.h1,
      lead: c.lead,
      intro,
      breadcrumbs: [
        crumb('Home', '/'),
        crumb(c.city.name, `/city/${c.city.slug}`),
        ...(c.extraCrumbs ?? []),
        crumb(c.h1, `/${c.slug}`),
      ],
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Hub pages — /city/[city] aur /subject/[subject]
//
// Inhi teen gates par: 3+ tutors, 120+ words intro. Farq sirf itna ke inka
// intro seedha cities/{slug}.intro aur subjects/{slug}.intro se aata hai.
// ---------------------------------------------------------------------------

export interface HubPage<T> {
  entity: T;
  tutors: Tutor[];
  intro: string[];
}

export function cityPages(): HubPage<City>[] {
  return cities
    .map((city) => ({ entity: city, tutors: rank(tutors.filter((t) => t.city === city.slug)), intro: [city.intro] }))
    .filter((p) => p.tutors.length >= MIN_TUTORS_PER_PAGE && words(p.entity.intro ?? '') >= MIN_INTRO_WORDS);
}

export function subjectPages(): HubPage<Subject>[] {
  return subjects
    .map((subject) => ({
      entity: subject,
      tutors: rank(tutors.filter((t) => t.subjects.includes(subject.slug))),
      intro: [subject.intro],
    }))
    .filter((p) => p.tutors.length >= MIN_TUTORS_PER_PAGE && words(p.entity.intro ?? '') >= MIN_INTRO_WORDS);
}

const cityPageSlugs = new Set(cityPages().map((p) => p.entity.slug));

/**
 * City hub page waqai bani hai? Breadcrumbs aur links isay poochte hain —
 * warna hum apne hi 404 par link kar rahe hote.
 */
export const hasCityPage = (slug: string) => cityPageSlugs.has(slug);

/** Build log ke liye — kaun si pages kyun nahi banin. */
export function comboReport(): string {
  const built = comboPages().length;
  const total = candidates().length;
  return `SEO combo pages: ${built} bani, ${total - built} gate par ruk gayin (3+ tutors, 120+ words unique intro).`;
}

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

export function breadcrumbJsonLd(items: { name: string; url: string }[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: new URL(item.url, siteUrl).href,
    })),
  };
}
