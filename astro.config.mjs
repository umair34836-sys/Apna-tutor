// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// docs/04-DEPLOY.md §3
export default defineConfig({
  site: 'https://apnatutor.com',
  base: '/',                    // custom domain hai, isliye '/'
  output: 'static',
  trailingSlash: 'never',       // GitHub Pages par consistency ke liye ahem
  integrations: [
    sitemap({
      // Sirf indexable pages sitemap mein. Private aur admin routes bahar.
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
        !page.includes('/404'),
    }),
  ],
  build: {
    format: 'file',             // /about.html — GitHub Pages ke liye behtar
    // Firebase SDK sirf un pages par load ho jo usay waqai use karte hain.
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
  compressHTML: true,
});
