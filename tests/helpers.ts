// =============================================================================
// tests/helpers.ts — rules tests ka setup
//
// Har test Firestore emulator par chalta hai. Emulator `firebase emulators:exec`
// start karta hai — `npm run test:rules` dekho.
//
// @firebase/rules-unit-testing compat instance return karti hai, magar modular
// functions (doc/setDoc/getDocs) usay khud unwrap kar leti hain. Isliye cast
// karke modular API use ki hai — wahi API jo asli app code use karta hai.
// =============================================================================

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export const ADMIN_UID = 'admin-uid';
export const TUTOR_UID = 'tutor-uid';
export const PENDING_TUTOR_UID = 'pending-tutor-uid';
export const PARENT_UID = 'parent-uid';
export const PARENT2_UID = 'parent2-uid';
export const REQUEST_ID = 'request-1';

let env: RulesTestEnvironment;

export async function setupEnv(): Promise<RulesTestEnvironment> {
  env = await initializeTestEnvironment({
    projectId: 'apnatutor-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  return env;
}

export const testEnv = () => env;

const fs = (ctx: RulesTestContext): Firestore => ctx.firestore() as unknown as Firestore;

/** Logged-out visitor ka Firestore. */
export const anonDb = (): Firestore => fs(env.unauthenticatedContext());

/** Kisi bhi logged-in user ka Firestore. */
export const db = (uid: string): Firestore => fs(env.authenticatedContext(uid));

// ---------------------------------------------------------------------------
// Seed — rules ke bagair likha jata hai ("aisa data jo pehle se mojood hai")
// ---------------------------------------------------------------------------

export async function seed(): Promise<void> {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = fs(ctx);
    const now = new Date();

    await setDoc(doc(d, `admins/${ADMIN_UID}`), { email: 'admin@apnatutor.com', addedAt: now });

    await setDoc(doc(d, `users/${PARENT_UID}`), {
      role: 'parent', name: 'Test Parent', city: 'risalpur', createdAt: now,
    });
    await setDoc(doc(d, `users/${TUTOR_UID}`), {
      role: 'tutor', name: 'Test Tutor', city: 'risalpur', createdAt: now,
    });

    // Approved tutor — public
    await setDoc(doc(d, `tutors/${TUTOR_UID}`), {
      ...newTutorDoc({ slug: 'approved-tutor-risalpur' }),
      status: 'approved',
      createdAt: now, updatedAt: now, reviewedAt: now,
    });
    await setDoc(doc(d, `tutors/${TUTOR_UID}/private/contact`), {
      phone: '+923001234567', whatsapp: '+923001234567', email: 'tutor@example.com',
    });

    // Pending tutor — abhi public nahi
    await setDoc(doc(d, `tutors/${PENDING_TUTOR_UID}`), {
      ...newTutorDoc({ slug: 'pending-tutor-risalpur' }),
      status: 'pending',
      createdAt: now, updatedAt: now,
    });

    // Parent 1 ki ek request — lead fan-out tests ke liye
    await setDoc(doc(d, `requests/${REQUEST_ID}`), {
      parentUid: PARENT_UID,
      parentPhone: '+923009876543',
      classLevel: '9', subject: 'mathematics', city: 'risalpur', area: 'risalpur-cantt',
      mode: 'home', genderPref: 'any', budgetMax: 6000, timing: '4-6 PM', notes: '',
      status: 'open', createdAt: now,
    });
  });
}

/** Rules ke create constraints ke mutabiq ek poora tutor document. */
export function newTutorDoc(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'naya-tutor-risalpur',
    name: 'Naya Tutor',
    gender: 'male',
    city: 'risalpur',
    areas: ['risalpur-cantt'],
    subjects: ['mathematics'],
    classes: ['9', '10'],
    boards: ['fbise'],
    modes: ['home'],
    feeMin: 3000,
    feeMax: 6000,
    qualification: 'MSc Mathematics',
    experienceYears: 5,
    availability: 'Mon-Sat, 4 PM - 9 PM',
    bio: 'Mathematics parhata hoon.',
    photoUrl: null,
    status: 'pending',
    badges: { phoneChecked: false, idChecked: false, qualChecked: false },
    ratingAvg: 0,
    ratingCount: 0,
    featuredUntil: null,
    ...overrides,
  };
}

/** Ek connection doc bana deta hai (rules ke bagair) — unlock ho chuka hai. */
export async function giveConnection(parentUid: string, tutorUid: string): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(fs(ctx), `connections/${parentUid}_${tutorUid}`), {
      parentUid, tutorUid, source: 'search', createdAt: new Date(),
    });
  });
}

/** Seed data ke bahar ka koi bhi document rules ke bagair likhne ke liye. */
export async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(fs(ctx), path), data);
  });
}
