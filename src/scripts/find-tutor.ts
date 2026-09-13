// =============================================================================
// src/scripts/find-tutor.ts — client-side search
//
// ★ Saare filters URL mein rehte hain: link share ho sakta hai aur back button
//   theek kaam karta hai. Isi liye page noindex hai — in hazaron URLs ka index
//   hona duplicate/thin content bana deta.
// =============================================================================

import { firestoreError } from '../lib/firebase';
import { applyFilters, searchTutors, type SearchFilters } from '../lib/queries';
import { tutorCardHtml } from '../lib/tutor-card';
import { track } from '../lib/analytics';
import type { Tutor } from '../lib/types';

const PAGE_SIZE = 12;

const root = document.getElementById('search');

if (root && root.dataset.ready === '1') {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const cityAreas: Record<string, string[]> = JSON.parse(root.dataset.cityAreas || '{}');
  const form = $<HTMLFormElement>('filter-form');
  const filters = $('filters');
  const backdrop = $('sheet-backdrop');

  // URL param → form field id
  const MAP: Record<string, string> = {
    city: 'f-city', subject: 'f-subject', area: 'f-area', class: 'f-class',
    board: 'f-board', gender: 'f-gender', mode: 'f-mode', budget: 'f-budget', exp: 'f-exp',
  };

  const OPTIONAL = ['area', 'class', 'board', 'gender', 'mode', 'budget', 'exp'];

  let pool: Tutor[] = [];        // server se aaye (city + subject par)
  let shown = PAGE_SIZE;
  let lastKey = '';              // wahi city+subject dobara query na ho

  // -------------------------------------------------------------------------
  // URL ↔ form
  // -------------------------------------------------------------------------

  const readUrl = () => new URLSearchParams(window.location.search);

  function formToUrl(push: boolean) {
    const p = new URLSearchParams();
    Object.entries(MAP).forEach(([param, id]) => {
      const v = ($(id) as HTMLSelectElement).value;
      if (v) p.set(param, v);
    });
    const url = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`;
    if (push) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
  }

  function urlToForm() {
    const p = readUrl();
    // City pehle — usi se areas bharte hain.
    //
    // Param na ho to select ki apni value rakho: ek hi service area hone par
    // wo pehle se selected hoti hai, aur usay khali kar dene se parent ko
    // bina wajah "ilaqa select karein" wala khali page dikhta.
    const cityEl = $('f-city') as HTMLSelectElement;
    const city = p.get('city') ?? cityEl.value;
    cityEl.value = city;
    renderAreas(p.get('area') ?? '');

    Object.entries(MAP).forEach(([param, id]) => {
      if (param === 'city' || param === 'area') return;
      ($(id) as HTMLSelectElement).value = p.get(param) ?? '';
    });
  }

  function renderAreas(selected = '') {
    const city = ($('f-city') as HTMLSelectElement).value;
    const select = $('f-area') as HTMLSelectElement;
    const areas = cityAreas[city] ?? [];

    select.disabled = areas.length === 0;
    select.innerHTML =
      `<option value="">Koi bhi</option>` +
      areas.map((a) => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`).join('');
    select.value = selected;
  }

  function currentFilters(): SearchFilters {
    const v = (id: string) => ($(id) as HTMLSelectElement).value;
    return {
      city: v('f-city'),
      subject: v('f-subject'),
      area: v('f-area') || undefined,
      classLevel: v('f-class') || undefined,
      board: v('f-board') || undefined,
      gender: v('f-gender') || undefined,
      mode: v('f-mode') || undefined,
      budgetMax: v('f-budget') ? Number(v('f-budget')) : undefined,
      minExperience: v('f-exp') ? Number(v('f-exp')) : undefined,
    };
  }

  const activeOptionalCount = () =>
    OPTIONAL.filter((param) => ($(MAP[param]) as HTMLSelectElement).value).length;

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  const views = ['prompt', 'loading', 'error', 'zero'] as const;
  function only(name?: (typeof views)[number]) {
    views.forEach((v) => { q(`[data-${v}]`).hidden = v !== name; });
    const isResults = name === undefined;
    q('[data-list]').hidden = !isResults;
    q('[data-count]').hidden = !isResults;
    q('[data-more]').hidden = true;
  }

  function updateFilterCount() {
    const n = activeOptionalCount();
    const pill = $('filter-count');
    pill.hidden = n === 0;
    pill.textContent = String(n);
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async function run(resetPage = true) {
    const f = currentFilters();
    updateFilterCount();

    if (!f.city || !f.subject) { only('prompt'); return; }

    if (resetPage) shown = PAGE_SIZE;

    const key = `${f.city}|${f.subject}`;
    if (key !== lastKey) {
      only('loading');
      try {
        pool = await searchTutors(f.city, f.subject);
        lastKey = key;
      } catch (err) {
        only('error');
        q('[data-error]').querySelector('span')!.textContent = firestoreError(err);
        return;
      }
    }

    const results = applyFilters(pool, f);

    track('search_tutors', {
      city: f.city, subject: f.subject,
      class_level: f.classLevel ?? '', results_count: results.length,
    });

    if (results.length === 0) {
      only('zero');
      const n = activeOptionalCount();
      q('[data-zero-tip]').textContent =
        n > 0
          ? `Aap ne ${n} extra ${n === 1 ? 'filter' : 'filters'} lagaye hain. Unhe hata kar dekhein — ya request post kar dein, hum aap ke liye tutor dhoondenge.`
          : 'Is ilaqe mein is subject ka koi tutor abhi nahi hai. Request post kar dein — jaise hi koi aayega, hum aap ko bata denge.';

      track('zero_results', { city: f.city, subject: f.subject, class_level: f.classLevel ?? '' });
      return;
    }

    only(undefined);

    const page = results.slice(0, shown);
    q('[data-count]').textContent =
      `${results.length} ${results.length === 1 ? 'tutor' : 'tutors'} mile${results.length > page.length ? ` — ${page.length} dikha rahe hain` : ''}`;
    q('[data-list]').innerHTML = `<div class="tutors">${page.map(tutorCardHtml).join('')}</div>`;
    q('[data-more]').hidden = results.length <= page.length;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  form.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;

    if (el.id === 'f-city') { renderAreas(); }

    const param = Object.entries(MAP).find(([, id]) => id === el.id)?.[0];
    if (param && el.value) track('filter_applied', { filter_name: param, filter_value: el.value });

    formToUrl(true);
    run();
  });

  $('filter-reset').addEventListener('click', () => {
    Object.values(MAP).forEach((id) => { ($(id) as HTMLSelectElement).value = ''; });
    renderAreas();
    formToUrl(true);
    run();
  });

  q('[data-relax]').addEventListener('click', () => {
    // Sirf optional filters hatao — city aur subject rehne do.
    OPTIONAL.forEach((param) => { ($(MAP[param]) as HTMLSelectElement).value = ''; });
    renderAreas();
    formToUrl(true);
    run();
  });

  q('[data-more-btn]').addEventListener('click', () => { shown += PAGE_SIZE; run(false); });

  // Back/forward button
  window.addEventListener('popstate', () => { urlToForm(); run(); });

  // ---- Mobile bottom sheet ----
  const openSheet = (open: boolean) => {
    filters.dataset.open = String(open);
    $('filter-toggle').setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('filter-close').focus();
  };

  $('filter-toggle').addEventListener('click', () => openSheet(filters.dataset.open !== 'true'));
  $('filter-close').addEventListener('click', () => openSheet(false));
  $('filter-apply').addEventListener('click', () => openSheet(false));
  backdrop.addEventListener('click', () => openSheet(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filters.dataset.open === 'true') openSheet(false);
  });

  // ---- Boot ----
  urlToForm();
  run();
}
