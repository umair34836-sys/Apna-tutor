// =============================================================================
// src/pages/manifest.webmanifest.ts
//
// App ka shanakhti card. Isi ki wajah se phone "Install" ka option deta hai,
// aur install hone ke baad site apni alag window mein khulti hai — browser ka
// address bar aur tabs ke bagair.
//
// ★ Ye file build ke waqt banti hai, public/ mein pari hui nahi. Wajah: har
//   raasta base path ke saath hona chahiye (GitHub project page par site
//   /Apna-tutor/ ke neeche chalti hai). public/ ki file mein wo path hard-code
//   karna parta, aur domain lene ke din wo chupchap ghalat ho jata.
// =============================================================================

import type { APIRoute } from 'astro';
import { SERVICE_AREA_LABEL, SITE, url } from '../lib/site';

export const GET: APIRoute = () => {
  const scope = url('/');

  const manifest = {
    // `id` ko kabhi na badlein — phone isi se pehchanta hai ke ye wahi app hai.
    // Badalne par install shuda app ka rishta toot jata hai aur wo dusri app
    // ban jati hai.
    id: scope,
    name: `ApnaTutor — ${SERVICE_AREA_LABEL} ke tutors`,
    short_name: 'ApnaTutor',
    description: SITE.description,

    start_url: scope,
    scope,
    display: 'standalone',
    orientation: 'portrait',

    lang: SITE.lang,
    dir: 'ltr',
    categories: ['education'],

    background_color: '#FFFFFF',  // splash screen — tokens.css --bg
    theme_color: '#0F766E',       // status bar — tokens.css --primary

    icons: [
      { src: url('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: url('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android icon ko apni marzi ki shakl mein kaatta hai — iske liye alag
      // file chahiye jismein logo beech mein aur kinare khali hon.
      { src: url('/icons/icon-maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: url('/icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    // Icon par der tak dabane se ye do raaste seedha khulte hain.
    shortcuts: [
      {
        name: 'Tutor dhoondein',
        short_name: 'Dhoondein',
        url: url('/find-tutor'),
        icons: [{ src: url('/icons/icon-192.png'), sizes: '192x192' }],
      },
      {
        name: 'Request post karein',
        short_name: 'Request',
        url: url('/request-tutor'),
        icons: [{ src: url('/icons/icon-192.png'), sizes: '192x192' }],
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
