// =============================================================================
// scripts/validate-links.mjs
//
// Build ke baad har internal link check karta hai: kya wo base path ke andar
// hai, aur kya us par koi file waqai mojood hai?
//
// Ye check isliye hai ke site hamesha root par nahi hoti. GitHub project page
// par wo `/Apna-tutor/` ke neeche chalti hai — aur agar ek bhi link `/find-tutor`
// reh jaye to wo domain ki jar par chala jata hai aur 404 deta hai. CSS ka
// masla bhi bilkul yahi tha.
//
// Isliye har link `url()` se guzarna chahiye (src/lib/site.ts).
// =============================================================================

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const RAW_BASE = process.env.PUBLIC_BASE_PATH || '/Apna-tutor';
const BASE = RAW_BASE === '/' ? '' : `/${RAW_BASE.replace(/^\/|\/$/g, '')}`;

const failures = [];

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Link ka target dist mein kis file par hai? */
function resolveTarget(path) {
  const clean = path.replace(/[?#].*$/, '');
  const withoutBase = BASE && clean.startsWith(BASE) ? clean.slice(BASE.length) : clean;
  const rel = withoutBase.replace(/^\//, '');

  if (rel === '' || rel === '/') return join(DIST, 'index.html');

  // build format 'file' → /about ka matlab about.html
  for (const candidate of [`${rel}.html`, rel, join(rel, 'index.html')]) {
    const full = join(DIST, candidate);
    if (existsSync(full)) return full;
  }
  return null;
}

if (!existsSync(DIST)) {
  console.error('✗ dist/ mojood nahi. Pehle `npm run build` chalao.');
  process.exit(1);
}

const files = htmlFiles(DIST);
const seen = new Set();

for (const file of files) {
  const rel = relative(DIST, file).split(sep).join('/');
  const html = readFileSync(file, 'utf8');

  for (const m of html.matchAll(/(?:href|src|action)="([^"]+)"/g)) {
    const value = m[1];

    // Bahar ke links, anchors, data URIs — hamare daire mein nahi.
    if (!value.startsWith('/') || value.startsWith('//')) continue;

    // 1. Base path ke andar hona chahiye
    if (BASE && !value.startsWith(`${BASE}/`) && value !== BASE) {
      const key = `${rel}|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        failures.push(
          `${rel}\n    → link base path se bahar hai: ${value}\n` +
          `       Isay url('${value}') se guzaarein (src/lib/site.ts).`
        );
      }
      continue;
    }

    // 2. Target waqai mojood ho
    if (!resolveTarget(value)) {
      const key = `${rel}|404|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        failures.push(`${rel}\n    → link kisi file par nahi jata: ${value}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Source lint — JS se hone wali navigation
//
// Bundle ko scan karna bekaar hai: `url('/login')` compile hone ke baad bundle
// mein "/login" chhod hi jata hai, to har sahi link bhi ghalat lagta hai.
// Isliye SOURCE dekhte hain — jahan navigation ho rahi hai, wahan url() hona
// chahiye. Ye check deterministic hai aur jhoote alarm nahi deta.
// ---------------------------------------------------------------------------

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'data') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/[.](ts|astro)$/.test(entry)) out.push(full);
  }
  return out;
}

const NAV_PATTERNS = [
  // window.location.href = '/x'   ya  .replace('/x')
  { re: /location\.(?:href\s*=|replace\s*\()\s*[`'"]\//g, what: 'location navigation' },
  // setAttribute('href', '/x')
  { re: /setAttribute\(\s*['"]href['"]\s*,\s*[`'"]\//g, what: "setAttribute('href', …)" },
  // template string ke andar  href="/x"
  { re: /href="\/(?!\/)/g, what: 'href="/…" (template string mein)' },
];

const SRC = join(process.cwd(), 'src');
if (existsSync(SRC)) {
  for (const file of sourceFiles(SRC)) {
    const rel = relative(process.cwd(), file).split(sep).join('/');
    if (rel.endsWith('lib/site.ts')) continue; // url() khud yahan define hota hai

    const code = readFileSync(file, 'utf8');
    const lines = code.split('\n');

    lines.forEach((line, i) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      for (const { re, what } of NAV_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(line)) {
          failures.push(
            `${rel}:${i + 1}\n    → ${what} base path ke bagair hai:\n` +
            `       ${line.trim().slice(0, 100)}\n` +
            "       Isay url(…) se guzaarein (src/lib/site.ts)."
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Source lint 2 — url('/kuch') ka target waqai banta hai?
//
// Upar wala check sirf un links ko dekhta hai jo HTML mein chhap chuke. Magar
// bohat se links JS banata hai (search results, dashboards, admin), aur wo
// build ke waqt kahin nazar nahi aate. Ek ghalat raasta wahan mahinon chhupa
// reh sakta tha — parent ko sirf "page nahi mila" milta.
//
// Yahan har LITERAL url('/x') ka target dist mein dhoondte hain. Jo raaste
// data se bante hain (tutor profile, city, subject, SEO combo) wo is list se
// mustasna hain — unka na hona normal hai, aur 404 page unhe khud sambhalta
// hai (src/pages/404.astro).
// ---------------------------------------------------------------------------

/** Ye raaste data se bante hain — na milna ghalti nahi. */
const DATA_ROUTES = [/^\/teacher\//, /^\/city\//, /^\/subject\//];

if (existsSync(SRC)) {
  const seenPath = new Set();

  for (const file of sourceFiles(SRC)) {
    const rel = relative(process.cwd(), file).split(sep).join('/');
    const code = readFileSync(file, 'utf8');

    // Sirf saade literal: url('/x') aur url("/x"). Template strings mein
    // ${} hota hai — wo build ke waqt maloom hi nahi, is liye chhor dete hain.
    for (const m of code.matchAll(/\burl\(\s*['"](\/[^'"`${}]*)['"]\s*\)/g)) {
      const target = m[1];
      if (DATA_ROUTES.some((re) => re.test(target))) continue;
      if (seenPath.has(target)) continue;
      seenPath.add(target);

      if (!resolveTarget(`${BASE}${target}`)) {
        failures.push(
          `${rel}\n    → url('${target}') kisi page par nahi jata.\n` +
          '       Ya to wo page banayein, ya link theek karein.'
        );
      }
    }
  }
}

console.log(`\nLink check — ${files.length} pages, base path "${BASE || '/'}".`);

if (failures.length) {
  console.error(`\n✗ ${failures.length} tootay hue link:\n`);
  failures.slice(0, 25).forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  if (failures.length > 25) console.error(`  … aur ${failures.length - 25}\n`);
  process.exit(1);
}

console.log('✓ har internal link theek hai\n');
