// =============================================================================
// scripts/validate-seo.mjs
//
// Build ke baad chalta hai aur FAIL hone par build tor deta hai. Ye jaan boojh
// kar sakht hai — jo cheezein ye pakadta hai, unki penalty poori site ko le
// doobti hai aur baad mein theek karna bohat mehnga parta hai.
//
// Checks:
//   1. THIN / DOORWAY PAGES — SEO combo page sirf 3+ approved tutors par, aur
//      har page par 120+ words unique intro text (docs/02-PAGES-SPEC.md)
//   2. PHONE LEAK — kisi bhi static HTML mein Pakistani number nahi hona chahiye
//      (docs/00-BUILD-PROMPT.md constraint #3)
//   3. FAKE RATINGS — aggregateRating sirf tab jab reviewCount > 0
//      (Google structured data policy — warna manual action)
//   4. DUPLICATE TITLES / DESCRIPTIONS — har indexable page ka unique hona
//   5. MISSING HEAD TAGS — title, description, canonical
//
// Isay bypass na karna. Agar koi check ghalat lag raha ho to pehle poocho.
// =============================================================================

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const MIN_TUTORS_PER_PAGE = 3;
const MIN_INTRO_WORDS = 120;

const failures = [];
const warnings = [];
const fail = (page, msg) => failures.push(`${page}\n    → ${msg}`);
const warn = (page, msg) => warnings.push(`${page}\n    → ${msg}`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nesting-safe: `data-seo-intro` wale har element ka andar ka HTML nikalta hai. */
function blocksWithAttr(html, attr) {
  const blocks = [];
  const open = new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*\\b${attr}\\b[^>]*>`, 'gi');
  let m;
  while ((m = open.exec(html))) {
    const tag = m[1].toLowerCase();
    const start = m.index + m[0].length;
    const scan = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi');
    scan.lastIndex = start;
    let depth = 1;
    let end = html.length;
    let s;
    while ((s = scan.exec(html))) {
      if (s[0].startsWith('</')) depth -= 1;
      else if (!s[0].endsWith('/>')) depth += 1;
      if (depth === 0) { end = s.index; break; }
    }
    blocks.push(html.slice(start, end));
  }
  return blocks;
}

const tagContent = (html, tag) => {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
};

const metaContent = (html, name) => {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};

function isSeoComboPage(rel) {
  const p = rel.split(sep).join('/');
  if (p.startsWith('teacher/')) return false;          // ek tutor ki profile — gate lagoo nahi
  if (['find-tutor.html', 'request-tutor.html', 'for-tutors.html', 'teachers.html'].includes(p)) return false;
  if (p.startsWith('city/') || p.startsWith('subject/')) return true;
  return /-tutor-/.test(p);
}

// ---------------------------------------------------------------------------
// Phone numbers — static HTML mein kabhi nahi
// ---------------------------------------------------------------------------

const OFFICIAL = [process.env.PUBLIC_OFFICIAL_PHONE, process.env.PUBLIC_OFFICIAL_WHATSAPP]
  .filter(Boolean)
  .map((n) => n.replace(/[^\d]/g, ''));

const PHONE_PATTERNS = [
  /\+92[\s-]?3\d{2}[\s-]?\d{7}/g,   // +923001234567
  /\b03\d{2}[\s-]?\d{7}\b/g,        // 03001234567
  /wa\.me\/92\d{10}/g,              // WhatsApp deep link
  /tel:\+?92\d{10}/g,
];

function phoneHits(html) {
  const hits = new Set();
  for (const re of PHONE_PATTERNS) {
    for (const m of html.matchAll(re)) {
      const digits = m[0].replace(/[^\d]/g, '');
      const isOfficial = OFFICIAL.some((o) => o.slice(-10) === digits.slice(-10));
      if (!isOfficial) hits.add(m[0].trim());
    }
  }
  return [...hits];
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

if (!existsSync(DIST)) {
  console.error('✗ dist/ mojood nahi. Pehle `npm run build` chalao.');
  process.exit(1);
}

const files = htmlFiles(DIST);
if (files.length === 0) {
  console.error('✗ dist/ mein koi HTML page nahi mila.');
  process.exit(1);
}

const titles = new Map();
const descriptions = new Map();
let comboPages = 0;

for (const file of files) {
  const rel = relative(DIST, file);
  const html = readFileSync(file, 'utf8');
  const noindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);

  // ---- 2. Phone leak (har page par, noindex pages par bhi) ----
  const phones = phoneHits(html);
  if (phones.length) {
    fail(rel, `Static HTML mein phone number mila: ${phones.join(', ')}\n` +
              '       Contact sirf tutors/{id}/private/contact se, login ke baad, client-side aana chahiye.');
  }

  // ---- 3. Fake ratings ----
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = block[1].replace(/\\u003c/g, '<');
    if (!/aggregateRating/i.test(raw)) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { fail(rel, 'JSON-LD parse nahi ho saki.'); continue; }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const agg = node?.aggregateRating;
      if (!agg) continue;
      const count = Number(agg.reviewCount ?? agg.ratingCount ?? 0);
      if (!Number.isFinite(count) || count < 1) {
        fail(rel, 'aggregateRating markup hai magar reviewCount 0 hai. Ye Google ki structured\n' +
                  '       data policy ki khilaaf-warzi hai — manual action ka khatra.');
      }
    }
  }

  // ---- 5. Head tags ----
  const title = tagContent(html, 'title');
  const description = metaContent(html, 'description');
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);

  if (!title) fail(rel, '<title> nahi hai.');
  if (!description) fail(rel, 'meta description nahi hai.');
  if (!canonical) fail(rel, 'canonical link nahi hai.');

  // ---- 4. Duplicates (sirf indexable pages par) ----
  if (!noindex) {
    if (title) (titles.get(title) ?? titles.set(title, []).get(title)).push(rel);
    if (description) (descriptions.get(description) ?? descriptions.set(description, []).get(description)).push(rel);
  }

  // ---- 1. Thin / doorway pages ----
  if (!isSeoComboPage(rel) || noindex) continue;
  comboPages += 1;

  const tutorCount = (html.match(/data-tutor-card/g) ?? []).length;
  if (tutorCount < MIN_TUTORS_PER_PAGE) {
    fail(rel, `Sirf ${tutorCount} tutor card hain, kam az kam ${MIN_TUTORS_PER_PAGE} chahiye.\n` +
              '       Ye page banao hi na — us URL ko 404 rehne do (doorway page penalty).');
  }

  const introWords = blocksWithAttr(html, 'data-seo-intro')
    .map((b) => stripTags(b).split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);

  if (introWords < MIN_INTRO_WORDS) {
    fail(rel, `Unique intro text sirf ${introWords} words hai, ${MIN_INTRO_WORDS} chahiye.\n` +
              '       cities/{slug}.intro aur subjects/{slug}.intro admin panel se bharo —\n' +
              '       sirf naam badal kar wahi template doorway page hai.');
  }
}

for (const [title, pages] of titles) {
  if (pages.length > 1) fail(pages.join(', '), `Duplicate <title>: "${title}"`);
}
for (const [desc, pages] of descriptions) {
  if (pages.length > 1) fail(pages.join(', '), `Duplicate meta description: "${desc.slice(0, 60)}…"`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\nSEO gate — ${files.length} pages check kiye (${comboPages} SEO combo pages).`);

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning:`);
  warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
}

if (failures.length) {
  console.error(`\n✗ SEO gate FAIL — ${failures.length} masle:\n`);
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  console.error('Build jaan boojh kar roki gayi hai. docs/02-PAGES-SPEC.md dekho.\n');
  process.exit(1);
}

console.log('✓ SEO gate pass\n');
