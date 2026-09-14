// =============================================================================
// scripts/make-icons.mjs
//
// App ke icons logo se banata hai. Chalane ka tareeqa:
//
//   node scripts/make-icons.mjs
//
// ★ Bane hue PNG repo mein commit hote hain. Wajah: CI ke paas Chromium nahi
//   hai, aur icon har build par dobara banane ki koi zarurat bhi nahi — wo
//   sirf tab badalta hai jab logo badle.
//
// ★ Do tarah ke icon hain, aur farq ahem hai:
//     any       — jaisa hai waisa dikhta hai (browser tab, install list)
//     maskable  — Android isay apni marzi ki shakl mein kaatta hai (gol,
//                 squircle). Is liye logo beech mein 60% par rakha hai; kinare
//                 ka 20% kat bhi jaye to kuch nahi jata. Ye na ho to Android
//                 poore icon ko ek safed daaire mein chipka deta hai.
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const OUT = join(process.cwd(), 'public', 'icons');
const BRAND = '#0F766E';   // tokens.css --primary

const logo = await readFile(join(process.cwd(), 'public', 'logo-mark.svg'), 'utf8');
const logoData = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;

/** Ek page jispar sirf icon ho — background aur logo ka size alag alag. */
const page = (size, scale, bg) => `data:text/html;base64,${Buffer.from(`
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
  body{background:${bg};display:grid;place-items:center}
  img{width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;display:block}
</style>
<img src="${logoData}" alt="">
`).toString('base64')}`;

async function shot(file, size, scale, bg) {
  await new Promise((resolve, reject) => {
    const p = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--window-size=${size},${size}`,
      `--screenshot=${join(OUT, file)}`,
      '--default-background-color=00000000',   // transparent, jab bg 'none' ho
      page(size, scale, bg),
    ], { stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exit ${code}`))));
    p.on('error', reject);
  });
  console.log(`  ✓ ${file}  ${size}×${size}`);
}

// -----------------------------------------------------------------------------
// Social preview (Open Graph)
//
// ★ Ye file pehle mojood hi NAHI thi, jabke har page uspar ishara karta tha.
//   Natija: WhatsApp ya Facebook par link share karne par preview khali ya
//   toota hua aata tha — yani har share apni aadhi taqat kho deta tha, aur
//   gaon mein link WhatsApp par hi phailta hai.
// -----------------------------------------------------------------------------

const ogPage = `data:text/html;base64,${Buffer.from(`
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
  body{
    background:#FFFFFF;
    font-family:system-ui,'DejaVu Sans',sans-serif;
    display:flex;align-items:center;gap:64px;
    padding:0 88px;box-sizing:border-box;
    border-bottom:18px solid ${BRAND};
  }
  img{width:280px;height:280px;flex:none}
  .txt{min-width:0}
  h1{margin:0;font-size:92px;line-height:1;letter-spacing:-2px;color:#0F172A;font-weight:700}
  h1 span{color:${BRAND}}
  p{margin:24px 0 0;font-size:38px;line-height:1.3;color:#475569;max-width:16ch}
  .pill{
    display:inline-block;margin-top:34px;padding:12px 28px;
    background:#F0FDFA;border:2px solid #99F6E4;border-radius:999px;
    font-size:28px;font-weight:600;color:#134E4A;
  }
</style>
<img src="${logoData}" alt="">
<div class="txt">
  <h1>Apna<span>Tutor</span></h1>
  <p>Gunderi Payan ke verified tutors</p>
  <div class="pill">Parents ke liye bilkul free</div>
</div>
`).toString('base64')}`;

async function ogShot() {
  const dir = join(process.cwd(), 'public', 'og');
  await mkdir(dir, { recursive: true });
  await new Promise((resolve, reject) => {
    const p = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--window-size=1200,630',
      `--screenshot=${join(dir, 'default.png')}`,
      ogPage,
    ], { stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exit ${code}`))));
    p.on('error', reject);
  });
  console.log('  ✓ og/default.png  1200×630');
}

await mkdir(OUT, { recursive: true });

console.log('\nIcons ban rahe hain…\n');
// "any" — poora logo, koi background nahi
await shot('icon-192.png', 192, 0.92, 'transparent');
await shot('icon-512.png', 512, 0.92, 'transparent');
// "maskable" — brand ka background, logo 60% par (safe zone ke andar)
await shot('icon-maskable-192.png', 192, 0.6, BRAND);
await shot('icon-maskable-512.png', 512, 0.6, BRAND);
// iOS maskable nahi samajhta aur transparency ko kala kar deta hai
await shot('apple-touch-icon.png', 180, 0.68, '#FFFFFF');

await ogShot();

await writeFile(join(OUT, 'README.txt'),
  'Ye icons scripts/make-icons.mjs se bante hain (public/logo-mark.svg se).\n' +
  'Haath se edit na karein — logo badlein aur script dobara chala dein.\n');

console.log('\n✓ ho gaya — public/icons/\n');
