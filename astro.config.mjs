// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { writeFile } from 'node:fs/promises';

// =============================================================================
// Site kahan chal rahi hai?
//
// Custom domain abhi nahi hai, isliye default GitHub ka project page hai:
//     https://umair34836-sys.github.io/Apna-tutor
//
// Domain lene ke baad repo → Settings → Secrets and variables → Actions →
// Variables mein ye do set kar dein, aur bas:
//     PUBLIC_SITE_URL  = https://apnatutor.com
//     PUBLIC_BASE_PATH = /
//
// BASE_PATH isliye ahem hai: project page par site `/Apna-tutor/` ke neeche
// serve hoti hai. Agar links `/find-tutor` rahein to wo domain ki jar par
// chale jate hain aur 404 dete hain — CSS bhi isi wajah se load nahi hoti.
// =============================================================================

const SITE = process.env.PUBLIC_SITE_URL || 'https://umair34836-sys.github.io';
const RAW_BASE = process.env.PUBLIC_BASE_PATH || '/Apna-tutor';

// Astro `base` trailing slash ke bagair chahta hai (siwaye '/' ke).
const BASE = RAW_BASE === '/' ? '/' : `/${RAW_BASE.replace(/^\/|\/$/g, '')}`;

/** CNAME sirf tab likho jab waqai custom domain ho. */
function cnameIntegration() {
  return {
    name: 'apnatutor:cname',
    hooks: {
      /** @param {{ dir: URL }} ctx */
      'astro:build:done': async ({ dir }) => {
        const host = new URL(SITE).hostname;
        // github.io par CNAME likh dein to GitHub Pages us domain par chali
        // jati hai aur site tootti hai. Isliye sirf asli domain par.
        if (host.endsWith('github.io')) return;
        await writeFile(new URL('CNAME', dir), `${host}\n`);
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    cnameIntegration(),
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/tutor/dashboard') &&
        !page.includes('/tutor/leads') &&
        !page.includes('/tutor/profile') &&
        !page.includes('/tutor/register') &&
        !page.includes('/parent/') &&
        !page.includes('/find-tutor') &&
        !page.includes('/login') &&
        !page.includes('/signup') &&
        !page.includes('/forgot-password') &&
        !page.includes('/404') &&
        !page.includes('/offline'),
    }),
  ],
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
  compressHTML: true,
});
