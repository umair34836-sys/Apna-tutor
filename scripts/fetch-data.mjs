// =============================================================================
// scripts/fetch-data.mjs
//
// Build time par Firestore se data lata hai aur src/data/*.json likhta hai.
// GitHub Actions mein Admin SDK se chalta hai. Admin SDK reads Spark plan par
// bilkul kaam karti hain — Blaze sirf Functions DEPLOY karne ke liye chahiye.
//
// ★ Do rules jo yahan hard-coded hain:
//   1. `tutors/{id}/private/*` KABHI nahi padha jata. Wahan phone number hai;
//      ek baar static HTML mein gaya to ek hi scrape mein sab leak.
//   2. Credentials na hon to khali data likhta hai, jhoota data nahi. UI empty
//      state dikhayega — "148 tutors" jaisa koi placeholder kabhi nahi.
// =============================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'src', 'data');

/** Firestore Timestamp / Date → ISO string. Baqi values waisi hi. */
function plain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/** Agar public tutor doc mein galti se contact field aa jaye to build TOOTNI chahiye. */
const FORBIDDEN_FIELDS = ['phone', 'whatsapp', 'email', 'cnic', 'address'];

function assertNoContactLeak(doc, id) {
  const leaked = FORBIDDEN_FIELDS.filter((f) => f in doc);
  if (leaked.length) {
    throw new Error(
      `tutors/${id} mein contact field mojood hai: ${leaked.join(', ')}\n` +
        'Ye public document hai — contact sirf tutors/{id}/private/contact mein hona chahiye.\n' +
        'Build jaan boojh kar rok di gayi hai (docs/00-BUILD-PROMPT.md constraint #3).'
    );
  }
}

async function writeAll({ tutors, cities, subjects, reviews, offline }) {
  await mkdir(OUT_DIR, { recursive: true });

  const subjectCounts = subjects.map((s) => ({
    slug: s.slug,
    count: tutors.filter((t) => (t.subjects ?? []).includes(s.slug)).length,
  }));

  await Promise.all([
    writeFile(join(OUT_DIR, 'tutors.json'), JSON.stringify(tutors)),
    writeFile(join(OUT_DIR, 'cities.json'), JSON.stringify(cities)),
    writeFile(join(OUT_DIR, 'subjects.json'), JSON.stringify(subjects)),
    writeFile(join(OUT_DIR, 'reviews.json'), JSON.stringify(reviews)),
    writeFile(
      join(OUT_DIR, 'stats.json'),
      JSON.stringify({
        // ★ Asli counts. Homepage par jo number dikhega wo yahi hai.
        tutorCount: tutors.length,
        cityCount: new Set(tutors.map((t) => t.city)).size,
        subjectCounts,
        generatedAt: new Date().toISOString(),
        offline,
      })
    ),
  ]);
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.warn(
      '⚠ FIREBASE_SERVICE_ACCOUNT set nahi hai — khali data ke saath build ho rahi hai.\n' +
        '  Site banegi aur deploy hogi, magar tutors ke bajaye empty states dikhenge.\n' +
        '  Ye local development ke liye theek hai. Production build mein ye secret lazmi hai.'
    );
    await writeAll({ tutors: [], cities: [], subjects: [], reviews: [], offline: true });
    console.log('✓ 0 tutors, 0 cities (offline mode)');
    return;
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  let credential;
  try {
    credential = cert(JSON.parse(raw));
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT valid JSON nahi hai: ${err.message}`);
  }

  const db = getFirestore(initializeApp({ credential }));

  // ---- Tutors: sirf approved. Pending/rejected/suspended static site par nahi aate.
  const tutorSnap = await db.collection('tutors').where('status', '==', 'approved').get();

  const tutors = tutorSnap.docs.map((d) => {
    const data = plain(d.data());
    assertNoContactLeak(data, d.id);

    // Pending photo public nahi hoti — sirf admin-approved photoUrl.
    delete data.photoPending;

    return { id: d.id, ...data };
  });

  // ---- SEO content
  const cities = (await db.collection('cities').get()).docs.map((d) => ({ slug: d.id, ...plain(d.data()) }));
  const subjects = (await db.collection('subjects').get()).docs.map((d) => ({ slug: d.id, ...plain(d.data()) }));

  // ---- Reviews: sirf approved, aur sirf un tutors ke jo live hain.
  const liveIds = new Set(tutors.map((t) => t.id));
  const reviewSnap = await db.collection('reviews').where('status', '==', 'approved').get();
  const reviews = reviewSnap.docs
    .map((d) => ({ id: d.id, ...plain(d.data()) }))
    .filter((r) => liveIds.has(r.tutorUid))
    .map(({ parentUid, ...rest }) => rest); // parent ki uid public HTML mein na jaye

  await writeAll({ tutors, cities, subjects, reviews, offline: false });

  console.log(
    `✓ ${tutors.length} tutors, ${cities.length} cities, ${subjects.length} subjects, ${reviews.length} reviews`
  );
}

main().catch((err) => {
  console.error('\n✗ fetch-data fail hui:\n' + (err?.stack ?? err) + '\n');
  process.exit(1);
});
