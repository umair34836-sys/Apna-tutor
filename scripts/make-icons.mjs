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

await writeFile(join(OUT, 'README.txt'),
  'Ye icons scripts/make-icons.mjs se bante hain (public/logo-mark.svg se).\n' +
  'Haath se edit na karein — logo badlein aur script dobara chala dein.\n');

console.log('\n✓ ho gaya — public/icons/\n');
