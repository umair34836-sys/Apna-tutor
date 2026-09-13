import { getAdminSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import {
  listCityDocs, listSubjectDocs, saveCityDoc, saveSubjectDoc, wordCount, MIN_INTRO_WORDS,
  type CityDoc, type SubjectDoc,
} from '../lib/admin';
import { svg } from '../lib/icons';

const root = document.getElementById('admin-content');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  let kind: 'cities' | 'subjects' = 'cities';

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  const counterClass = (n: number) => (n >= MIN_INTRO_WORDS ? 'ok' : 'short');

  function cityCard(c: CityDoc & { slug: string }): string {
    const n = wordCount(c.intro ?? '');
    // Variant pages ke apne intros — inke bagair wo pages banti hi nahi.
    const variants = Object.entries(c.pageIntros ?? {});

    return `
      <article class="content-card" data-slug="${esc(c.slug)}" data-kind="cities">
        <div class="content-head">
          <h2>${esc(c.name)}</h2>
          <code>/city/${esc(c.slug)}</code>
        </div>

        <div class="field">
          <label for="intro-${esc(c.slug)}">City intro <span class="hint">(/city/${esc(c.slug)} par)</span></label>
          <textarea id="intro-${esc(c.slug)}" data-field="intro" rows="6">${esc(c.intro ?? '')}</textarea>
          <p class="counter ${counterClass(n)}" data-counter>${n} / ${MIN_INTRO_WORDS} words</p>
        </div>

        <details class="variants">
          <summary>Combo pages ke alag intros (${variants.length})</summary>
          <p class="hint">
            Misal: <code>home-tutor-${esc(c.slug)}</code>, <code>female-tutor-${esc(c.slug)}</code>,
            <code>class-9-tutor-${esc(c.slug)}</code>. Har ek ka apna 120+ words ka text — warna wo
            page nahi banta.
          </p>
          <div data-variants>
            ${variants.map(([slug, text]) => variantRow(slug, text)).join('')}
          </div>
          <div class="variant-add">
            <input type="text" data-new-slug placeholder="page slug — misal: home-tutor-${esc(c.slug)}" />
            <button type="button" class="btn btn-outline btn-sm" data-add-variant>Add</button>
          </div>
        </details>

        <div class="content-actions">
          <p class="state state-success" data-saved hidden>${svg('check-circle', { size: 16 })}Save ho gaya</p>
          <p class="state state-error" data-save-error hidden><span></span></p>
          <button type="button" class="btn btn-primary btn-sm" data-save>Save karein</button>
        </div>
      </article>`;
  }

  function variantRow(slug: string, text: string): string {
    const n = wordCount(text ?? '');
    return `
      <div class="field variant-row" data-variant="${esc(slug)}">
        <label>
          <code>/${esc(slug)}</code>
          <button type="button" class="linklike" data-remove-variant>hata dein</button>
        </label>
        <textarea data-variant-text rows="4">${esc(text ?? '')}</textarea>
        <p class="counter ${counterClass(n)}" data-counter>${n} / ${MIN_INTRO_WORDS} words</p>
      </div>`;
  }

  function subjectCard(s: SubjectDoc & { slug: string }): string {
    const n = wordCount(s.intro ?? '');
    return `
      <article class="content-card" data-slug="${esc(s.slug)}" data-kind="subjects">
        <div class="content-head">
          <h2>${esc(s.name)}</h2>
          <code>/subject/${esc(s.slug)}</code>
        </div>
        <div class="field">
          <label for="sintro-${esc(s.slug)}">Subject intro</label>
          <textarea id="sintro-${esc(s.slug)}" data-field="intro" rows="6">${esc(s.intro ?? '')}</textarea>
          <p class="counter ${counterClass(n)}" data-counter>${n} / ${MIN_INTRO_WORDS} words</p>
        </div>
        <div class="content-actions">
          <p class="state state-success" data-saved hidden>${svg('check-circle', { size: 16 })}Save ho gaya</p>
          <p class="state state-error" data-save-error hidden><span></span></p>
          <button type="button" class="btn btn-primary btn-sm" data-save>Save karein</button>
        </div>
      </article>`;
  }

  async function render() {
    q('[data-loading]').hidden = false;
    q('[data-list]').hidden = true;
    q('[data-error]').hidden = true;

    try {
      const html =
        kind === 'cities'
          ? (await listCityDocs()).map(cityCard).join('')
          : (await listSubjectDocs()).map(subjectCard).join('');

      q('[data-list]').innerHTML = html
        ? `<div class="content-list">${html}</div>`
        : `<div class="empty">${svg('file-text')}<h3>Koi ${kind === 'cities' ? 'city' : 'subject'} nahi</h3>
             <p>Firebase Console se ${kind} collection mein documents banayein, phir yahan intro likhein.</p></div>`;

      q('[data-loading]').hidden = true;
      q('[data-list]').hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  }

  // ---- Live word count ----
  q('[data-list]').addEventListener('input', (e) => {
    const ta = e.target as HTMLTextAreaElement;
    if (ta.tagName !== 'TEXTAREA') return;
    const counter = ta.parentElement?.querySelector<HTMLElement>('[data-counter]');
    if (!counter) return;
    const n = wordCount(ta.value);
    counter.textContent = `${n} / ${MIN_INTRO_WORDS} words`;
    counter.className = `counter ${counterClass(n)}`;
  });

  // ---- Variants add/remove ----
  q('[data-list]').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const addBtn = target.closest<HTMLButtonElement>('[data-add-variant]');
    if (addBtn) {
      const card = addBtn.closest<HTMLElement>('.content-card')!;
      const input = card.querySelector<HTMLInputElement>('[data-new-slug]')!;
      const slug = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!slug) { input.focus(); return; }
      card.querySelector('[data-variants]')!.insertAdjacentHTML('beforeend', variantRow(slug, ''));
      input.value = '';
      return;
    }

    const removeBtn = target.closest<HTMLButtonElement>('[data-remove-variant]');
    if (removeBtn) removeBtn.closest('.variant-row')?.remove();
  });

  // ---- Save ----
  q('[data-list]').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-save]');
    if (!btn) return;

    const card = btn.closest<HTMLElement>('.content-card')!;
    const slug = card.dataset.slug!;
    const saved = card.querySelector<HTMLElement>('[data-saved]')!;
    const err = card.querySelector<HTMLElement>('[data-save-error]')!;

    saved.hidden = true;
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Save ho raha hai…';

    try {
      const intro = card.querySelector<HTMLTextAreaElement>('[data-field="intro"]')!.value;

      if (card.dataset.kind === 'cities') {
        const pageIntros: Record<string, string> = {};
        card.querySelectorAll<HTMLElement>('.variant-row').forEach((row) => {
          const text = row.querySelector<HTMLTextAreaElement>('[data-variant-text]')!.value;
          if (text.trim()) pageIntros[row.dataset.variant!] = text;
        });
        // merge: true — name/areas jaise fields yahan se nahi aate, unhe na chhero.
        await saveCityDoc(slug, { intro, pageIntros } as never);
      } else {
        await saveSubjectDoc(slug, { intro } as never);
      }

      saved.hidden = false;
      window.setTimeout(() => { saved.hidden = true; }, 3500);
    } catch (e2) {
      err.querySelector('span')!.textContent = firestoreError(e2);
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save karein';
    }
  });

  // ---- Tabs ----
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.filter'));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1; });
      kind = tab.dataset.kind as 'cities' | 'subjects';
      render();
    });
    tab.addEventListener('keydown', (e) => {
      let next: HTMLButtonElement | undefined;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.click(); next.focus(); }
    });
  });

  getAdminSession().then((session) => { if (session) render(); });
}
