// =============================================================================
// src/lib/data.ts — build-time data access
//
// `scripts/fetch-data.mjs` Firestore se JSON files banata hai; ye module unhe
// padhta hai. SIRF build time par chalta hai (Node), browser mein nahi.
//
// Files na hon (fresh clone, ya credentials ke bagair build) to khali arrays
// milte hain aur build phir bhi chalti hai — UI empty states dikhata hai.
// Ye jaan boojh kar hai: kabhi jhoota fallback data nahi.
//
// ★ GEOGRAPHIC DAIRA — ye module SERVICE_AREAS (src/lib/site.ts) ke bahar ka
//   kuch bhi aagey nahi jaane deta. Firestore mein purane sheher ya doosre
//   area ke tutors mojood hon to bhi site par nahi aate. Sab kuch — dropdowns,
//   SEO pages, footer links, sitemap — isi filtered data se banta hai, isliye
//   daira badalne ke liye sirf SERVICE_AREAS badalni hoti hai.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SUBJECTS, SERVICE_AREAS } from './site';
import type { City, Review, Stats, Subject, Tutor } from './types';

const DATA_DIR = join(process.cwd(), 'src', 'data');

function read<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
  } catch {
    // ENOENT ya invalid JSON — khali chalao, banao mat.
    return fallback;
  }
}

const SERVED = new Set(SERVICE_AREAS.map((a) => a.slug));

const allTutors = read<Tutor[]>('tutors.json', []);
const allCities = read<City[]>('cities.json', []);

/**
 * Sirf approved tutors, aur sirf wo jo hamare service area mein hain.
 * (fetch-data.mjs pehle hi status filter kar deta hai.)
 */
export const tutors: Tutor[] = allTutors.filter((t) => SERVED.has(t.city));

/**
 * Har service area ek city document hai.
 *
 * Naam aur mohallay config se aate hain taake site Firestore khali hone par
 * bhi chale — forms aur dropdowns pehle din se kaam karte hain. Firestore ka
 * document mojood ho to uska `intro`, `pageIntros` aur (import kiye hue)
 * `areas` config par bhaari hain.
 */
export const cities: City[] = SERVICE_AREAS.map((area) => {
  const fromDb = allCities.find((c) => c.slug === area.slug);
  return {
    slug: area.slug,
    name: fromDb?.name?.trim() || area.name,
    district: fromDb?.district || area.district,
    province: fromDb?.province || area.province,
    areas: fromDb?.areas?.length ? fromDb.areas : area.areas,
    ...(fromDb?.nameUrdu ? { nameUrdu: fromDb.nameUrdu } : {}),
    ...(fromDb?.areaGroups?.length ? { areaGroups: fromDb.areaGroups } : {}),
    ...(fromDb?.pageIntros ? { pageIntros: fromDb.pageIntros } : {}),
    // Intro kabhi generate nahi hota — admin likhta hai. Na ho to us area ka
    // SEO page banta hi nahi (thin-page gate).
    intro: fromDb?.intro ?? '',
  };
});

/**
 * Subjects: default taxonomy + Firestore ka intro.
 *
 * Firestore mein jo subject mojood hai uska naam aur intro chalta hai; jo
 * sirf default list mein hai wo bhi dropdown mein aata hai (intro ke bagair,
 * yani uska SEO hub page nahi banta — wahi thin-page gate).
 */
const dbSubjects = read<Subject[]>('subjects.json', []);

export const subjects: Subject[] = [
  ...DEFAULT_SUBJECTS.map((d) => {
    const fromDb = dbSubjects.find((s) => s.slug === d.slug);
    return {
      slug: d.slug,
      name: fromDb?.name?.trim() || d.name,
      nameUrdu: fromDb?.nameUrdu || d.nameUrdu,
      intro: fromDb?.intro ?? '',
    };
  }),
  // Admin ne koi naya subject Firestore mein banaya ho to wo bhi aayega.
  ...dbSubjects.filter((s) => !DEFAULT_SUBJECTS.some((d) => d.slug === s.slug)),
];

/** Sirf approved reviews, aur sirf un tutors ke jo live hain. */
const liveTutorIds = new Set(tutors.map((t) => t.id));
export const reviews: Review[] = read<Review[]>('reviews.json', []).filter((r) =>
  liveTutorIds.has(r.tutorUid)
);

const rawStats = read<Partial<Stats>>('stats.json', {});

/**
 * Counts filtered data se dobara ginte hain — warna homepage par wo number
 * dikh sakta tha jismein service area ke bahar ke tutors bhi shaamil hon.
 */
export const stats: Stats = {
  tutorCount: tutors.length,
  cityCount: new Set(tutors.map((t) => t.city)).size,
  subjectCounts: subjects.map((s) => ({
    slug: s.slug,
    count: tutors.filter((t) => (t.subjects ?? []).includes(s.slug)).length,
  })),
  generatedAt: rawStats.generatedAt ?? new Date().toISOString(),
  offline: rawStats.offline ?? true,
};

export function tutorsInCity(citySlug: string): Tutor[] {
  return tutors.filter((t) => t.city === citySlug);
}

export function tutorsForSubject(subjectSlug: string): Tutor[] {
  return tutors.filter((t) => t.subjects.includes(subjectSlug));
}

export function reviewsForTutor(tutorUid: string): Review[] {
  return reviews
    .filter((r) => r.tutorUid === tutorUid)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

export function cityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}

export function subjectBySlug(slug: string): Subject | undefined {
  return subjects.find((s) => s.slug === slug);
}
