// =============================================================================
// src/lib/data.ts — build-time data access
//
// `scripts/fetch-data.mjs` Firestore se JSON files banata hai; ye module unhe
// padhta hai. SIRF build time par chalta hai (Node), browser mein nahi.
//
// Files na hon (fresh clone, ya credentials ke bagair build) to khali arrays
// milte hain aur build phir bhi chalti hai — UI empty states dikhata hai.
// Ye jaan boojh kar hai: kabhi jhoota fallback data nahi.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Sirf approved tutors — fetch-data.mjs pehle hi filter karta hai. */
export const tutors: Tutor[] = read<Tutor[]>('tutors.json', []);
export const cities: City[] = read<City[]>('cities.json', []);
export const subjects: Subject[] = read<Subject[]>('subjects.json', []);

/** Sirf approved reviews, aur sirf un tutors ke jo live hain. */
export const reviews: Review[] = read<Review[]>('reviews.json', []);

export const stats: Stats = read<Stats>('stats.json', {
  tutorCount: 0,
  cityCount: 0,
  subjectCounts: [],
  generatedAt: new Date().toISOString(),
  offline: true,
});

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
