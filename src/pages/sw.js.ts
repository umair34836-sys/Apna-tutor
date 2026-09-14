// =============================================================================
// src/pages/sw.js.ts — service worker
//
// Iska kaam sirf itna hai: app khulne par foran khule, aur signal chala jaye
// to bhi kuch to dikhe. Gaon mein ye koi luxury nahi — 2G par har dobara
// download waqt aur paisa dono kharch karta hai.
//
// ★ Teen alag tareeqe, teen alag qism ki cheezon ke liye:
//
//     /_astro/*     cache-first   — in files ke naam mein hi unka hash hota
//                                   hai. Content badle to naam badal jata
//                                   hai, is liye purana kabhi nahi milta.
//
//     page (HTML)   network-first — HTML par cache-first LAGANA SAB SE BARI
//                                   ghalti hoti. Banda naye tutors dekhne
//                                   aata aur usay kal ka page milta, bina ye
//                                   jane ke ke wo purana hai. Is liye pehle
//                                   network; wo na chale tabhi cache.
//
//     baqi          stale-while-revalidate — icons, robots.txt waghaira.
//                                   Foran cache se, aur peeche chupke se
//                                   naya le aata hai.
//
// ★ Cross-origin ko HAATH NAHI LAGATE. Firebase ke calls, Google fonts — un
//   par respondWith karne ka matlab hai auth aur data ke beech mein khara
//   ho jana. Wo kabhi acha khatma nahi hota.
// =============================================================================

import type { APIRoute } from 'astro';
import { url } from '../lib/site';

export const GET: APIRoute = () => {
  const scope = url('/');
  // Har build ka apna cache. Purane build ka cache activate par khud mit jata
  // hai, is liye naya deploy purani files leke nahi baithta.
  const version = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

  const sw = `/* ApnaTutor service worker — build ${version} */
const SCOPE = ${JSON.stringify(scope)};
const CACHE = 'apnatutor-' + ${JSON.stringify(version)};
const OFFLINE = SCOPE + 'offline';

/* Install ke waqt sirf itna jitna offline kaam aaye. */
const SHELL = [SCOPE, OFFLINE, SCOPE + 'icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* Ek file na mile to poora install fail na ho — isi liye alag alag. */
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('apnatutor-') && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* Sirf theek-thaak jawab cache karo. Adhoora ya ghalat jawab cache karna
   us se bura hai ke kuch cache na karo. */
function cacheable(res) {
  return res && res.status === 200 && res.type === 'basic';
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (cacheable(res)) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    const offline = await caches.match(OFFLINE);
    if (offline) return offline;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const hit = await caches.match(req);
  const fresh = fetch(req).then(async (res) => {
    if (cacheable(res)) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const u = new URL(req.url);
  /* Doosre domain (Firebase, fonts) aur apne scope ke bahar — bilkul na chhero. */
  if (u.origin !== self.location.origin) return;
  if (!u.pathname.startsWith(SCOPE)) return;

  if (u.pathname.includes('/_astro/')) { event.respondWith(cacheFirst(req)); return; }
  if (req.mode === 'navigate')        { event.respondWith(networkFirst(req)); return; }
  event.respondWith(staleWhileRevalidate(req));
});

/* Page keh sakta hai "ab intezar mat kar" — naya version foran lagane ke liye. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
`;

  return new Response(sw, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // SW file khud kabhi cache na ho, warna naya version pohanchta hi nahi.
      'Cache-Control': 'no-cache',
    },
  });
};
