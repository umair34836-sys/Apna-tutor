// =============================================================================
// scripts/import-areas.mjs
//
// data/areas-*.csv se areas Firestore ke `cities/{slug}` documents mein load
// karta hai.
//
//   node scripts/import-areas.mjs data/areas-nowshera.csv          # dekhein
//   node scripts/import-areas.mjs data/areas-nowshera.csv --write  # likhein
//
// ★ Jis row mein `source` khali ho, wo import NAHI hoti. Ye jaan boojh kar
//   hai: dropdown mein ghalat gaon ka naam aana us gaon ke parents ka bharosa
//   toranay ke barabar hai, aur is project ka buniyadi usool hi "jhoota data
//   nahi" hai.
//
// Areas do shakal mein likhe jate hain:
//   areas       — flat list. Purana har consumer isi ko parhta hai.
//   areaGroups  — union council ke hisaab se grouping, dropdown ke liye.
// =============================================================================

import { readFileSync } from 'node:fs';

const [, , file, ...flags] = process.argv;
const WRITE = flags.includes('--write');

if (!file) {
  console.error('Istemal: node scripts/import-areas.mjs <csv-file> [--write]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV parse
// ---------------------------------------------------------------------------

const lines = readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const header = lines.shift().split(',').map((h) => h.trim());
const need = ['city', 'village', 'union_council', 'tehsil', 'source'];
const missing = need.filter((c) => !header.includes(c));
if (missing.length) {
  console.error(`✗ CSV mein ye columns nahi hain: ${missing.join(', ')}`);
  process.exit(1);
}

const rows = [];
const skipped = [];
const seen = new Set();

for (const [i, line] of lines.entries()) {
  const cells = line.split(',').map((c) => c.trim());
  const row = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']));

  if (!row.city || !row.village) {
    skipped.push(`row ${i + 2}: city ya village khali hai`);
    continue;
  }
  if (!row.source) {
    // ★ Ye check hi is file ka maqsad hai.
    skipped.push(`row ${i + 2}: "${row.village}" ka source nahi — skip`);
    continue;
  }

  const key = `${row.city}|${row.village.toLowerCase()}`;
  if (seen.has(key)) {
    skipped.push(`row ${i + 2}: "${row.village}" pehle se hai — skip`);
    continue;
  }
  seen.add(key);
  rows.push(row);
}

// ---------------------------------------------------------------------------
// City ke hisaab se jama karo
// ---------------------------------------------------------------------------

const cities = new Map();

for (const row of rows) {
  if (!cities.has(row.city)) cities.set(row.city, { areas: [], groups: new Map() });
  const city = cities.get(row.city);

  city.areas.push(row.village);

  const group = row.union_council || row.tehsil || 'Doosre areas';
  if (!city.groups.has(group)) city.groups.set(group, []);
  city.groups.get(group).push(row.village);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${file}\n`);
for (const [slug, city] of cities) {
  console.log(`  ${slug} — ${city.areas.length} areas, ${city.groups.size} groups`);
  for (const [group, villages] of city.groups) {
    console.log(`      ${group}: ${villages.join(', ')}`);
  }
}

if (skipped.length) {
  console.log(`\n  ${skipped.length} rows skip hui:`);
  skipped.forEach((s) => console.log(`      ${s}`));
}

if (!WRITE) {
  console.log('\n(Ye sirf preview tha. Likhne ke liye --write lagayein.)\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('\n✗ FIREBASE_SERVICE_ACCOUNT set nahi hai — likh nahi sakte.\n');
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(raw)) }));

for (const [slug, city] of cities) {
  // merge: true — `intro`, `name`, `pageIntros` waghaira ko haath na lagayein.
  await db.doc(`cities/${slug}`).set(
    {
      areas: city.areas.sort((a, b) => a.localeCompare(b)),
      areaGroups: [...city.groups].map(([uc, villages]) => ({
        unionCouncil: uc,
        villages: villages.sort((a, b) => a.localeCompare(b)),
      })),
      areasUpdatedAt: new Date(),
    },
    { merge: true }
  );
  console.log(`  ✓ cities/${slug} — ${city.areas.length} areas likhe gaye`);
}

console.log('\n✓ ho gaya. Agli build par ye areas dropdowns mein aa jayenge.\n');
