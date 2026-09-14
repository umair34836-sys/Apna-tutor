// =============================================================================
// src/scripts/admin-promos.ts — ishtihaar panel
//
// ★ Slots ki fehrist page se aati hai (data-slots), jo khud src/lib/promo-slots.ts
//   se bani hai — wahi file jo site par ads lagati hai. Yahan dobara likhte to
//   ek din dono alag ho jatin.
//
// ★ Preview site ke asli class names (.promo-card, .promo-banner) istemal karta
//   hai, apna alag CSS nahi. Alag CSS likhte to preview kuch aur dikhata aur
//   site kuch aur — aur banda ad ko bar bar theek karta reh jata.
// =============================================================================

import { getAdminSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import {
  deletePromo, listPromos, promoTotals, savePromo, setPromoActive, shrinkImage,
  type PromoDraft, type PromoRow, type PromoTotals,
} from '../lib/admin-promos';
import type { PromoSlot } from '../lib/promo-slots';
import { svg } from '../lib/icons';

const root = document.getElementById('admin-promos')!;
const q = <T extends HTMLElement = HTMLElement>(sel: string, from: ParentNode = root) =>
  from.querySelector<T>(sel)!;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const SLOTS: PromoSlot[] = JSON.parse(root.dataset.slots || '[]');
const slotLabel = (id: string) => SLOTS.find((s) => s.id === id)?.label ?? id;

/** Kya ye jagah is shakal ko leti hai. */
const slotTakes = (id: string, sh: string) =>
  SLOTS.find((s) => s.id === id)?.shapes.includes(sh as 'card' | 'banner') ?? true;

const loading = q('[data-loading]');
const errorBox = q('[data-error]');
const listBox = q('[data-list]');
const countOut = q('[data-count]');

const sheet = q('[data-sheet]');
const form = q<HTMLFormElement>('[data-form]');
const formError = q('[data-form-error]');
const idField = q<HTMLInputElement>('[data-id]');
const deleteBtn = q<HTMLButtonElement>('[data-delete]');
const saveBtn = q<HTMLButtonElement>('[data-save]');
const previewBox = q('[data-preview]');

const fileInput = q<HTMLInputElement>('[data-image]');
const imageRow = q('[data-image-row]');
const imagePreview = q<HTMLImageElement>('[data-image-preview]');

let rows: PromoRow[] = [];
let totals = new Map<string, PromoTotals>();

/**
 * Tasveer ki teen halatein, aur farq ahem hai:
 *   undefined → haath mat lagao (banda sirf naam badal raha hai)
 *   null      → hata do
 *   string    → nayi tasveer
 */
let imageData: string | null | undefined;
let imageW = 0;
let imageH = 0;

const fail = (box: HTMLElement, msg: string) => {
  box.querySelector('span')!.textContent = msg;
  box.hidden = false;
};

// ---------------------------------------------------------------------------
// Fehrist
// ---------------------------------------------------------------------------

function statusPill(p: PromoRow): string {
  if (!p.active) return '<span class="promo-pill off">Band</span>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p.startsAt && today < new Date(p.startsAt)) {
    return `<span class="promo-pill">Shuru ${esc(fmtDate(p.startsAt))} se</span>`;
  }
  if (p.endsAt) {
    const end = new Date(p.endsAt);
    end.setHours(23, 59, 59, 999);
    if (today > end) return '<span class="promo-pill gone">Waqt khatam</span>';
  }
  return '<span class="promo-pill on">Chal raha hai</span>';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

function rowHtml(p: PromoRow): string {
  const t = totals.get(p.id) ?? { views: 0, clicks: 0, days: 0 };
  const thumb = p.imageData
    ? `<img class="promo-row-thumb" src="${esc(p.imageData)}" alt="" />`
    : `<div class="promo-row-thumb"></div>`;

  const bill = p.billing.amount
    ? `<div class="promo-num"><b>Rs ${esc(p.billing.amount)}</b><span>${p.billing.paid ? 'mil gaye' : 'baqi hain'}</span></div>`
    : '';

  return `
    <article class="promo-row">
      <div class="promo-row-top">
        ${thumb}
        <div class="promo-row-main">
          <h3>${esc(p.title || p.brand)} ${statusPill(p)}</h3>
          <p class="promo-row-brand">${esc(p.brand)} · ${p.shape === 'banner' ? 'Banner' : 'Card'} · wazan ${esc(p.weight ?? 1)}</p>
          <p class="promo-row-sub">${esc(p.href)}</p>
        </div>
      </div>

      <div class="promo-row-slots">
        ${(p.slots ?? [])
          .map((s) =>
            slotTakes(s, p.shape)
              ? `<span class="promo-pill">${esc(slotLabel(s))}</span>`
              : `<span class="promo-pill warn" title="Ye jagah ${esc(p.shape === 'banner' ? 'Banner' : 'Card')} nahi leti">
                   ⚠ ${esc(slotLabel(s))}
                 </span>`
          )
          .join('')}
      </div>
      ${
        (p.slots ?? []).some((s) => !slotTakes(s, p.shape))
          ? `<p class="promo-row-warn">${svg('alert-triangle', { size: 16 })}
               Nishan wali jagah ye shakal nahi leti — wahan ad site ke design se mail nahi
               khayega. "Badlein" se ya wo jagah hata dein, ya doosri shakal chunein.
             </p>`
          : ''
      }

      <div class="promo-row-nums">
        <div class="promo-num"><b>${t.views}</b><span>logon ne dekha</span></div>
        <div class="promo-num"><b>${t.clicks}</b><span>ne click kiya</span></div>
        ${bill}
      </div>

      <div class="promo-row-actions">
        <button type="button" class="btn btn-outline btn-sm" data-edit="${esc(p.id)}">
          ${svg('edit', { size: 16 })}Badlein
        </button>
        <button type="button" class="btn btn-ghost btn-sm" data-toggle="${esc(p.id)}">
          ${p.active ? 'Band karein' : 'Chalu karein'}
        </button>
      </div>
    </article>`;
}

function render(): void {
  countOut.textContent = rows.length
    ? `${rows.length} ishtihaar · numbers pichle 30 din ke`
    : '';

  if (!rows.length) {
    listBox.innerHTML = `
      <div class="promo-row" style="text-align:center">
        <p style="color:var(--muted-fg)">
          Abhi koi ishtihaar nahi. "Naya ishtihaar" se pehla bana lein.
        </p>
      </div>`;
  } else {
    listBox.innerHTML = rows.map(rowHtml).join('');
  }
  listBox.hidden = false;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const shapeWord = (sh: string) => (sh === 'banner' ? 'Banner' : 'Card');

function buildSlotOptions(): void {
  q('[data-slot-list]').innerHTML = SLOTS.map(
    (s) => `
    <label class="promo-slot-opt" data-slot-opt="${esc(s.id)}">
      <input type="checkbox" name="slots" value="${esc(s.id)}" />
      <span>
        <strong>${esc(s.label)}</strong>
        <em>${esc(s.where)}</em>
        <em class="promo-slot-takes">Ye jagah leti hai: ${s.shapes.map(shapeWord).join(' ya ')}</em>
      </span>
    </label>`
  ).join('');
}

/**
 * Jo jagah is shakal ko nahi leti, wo band kar do.
 *
 * ★ Ye shart shuru se promo-slots.ts mein likhi thi magar kahin LAGAI nahi
 *   gayi thi — yani sirf likhi hui thi, chalti nahi thi. Nateeja: banner ko
 *   "patli patti" wali jagah par lagaya ja sakta tha, aur wahan logo poori
 *   chaurai mein khinch kar har page ke neeche dikhta tha.
 *
 * ★ Pehle se chuni hui ghalat jagah ko KHAMOSHI se nahi hatate — nishan laga
 *   rehta hai aur uske saath wajah likhi aati hai. Chupke se hata dete to
 *   banda save karta aur usay pata bhi na chalta ke uska ad ek jagah se ghayab
 *   ho gaya.
 */
function syncSlotShapes(): void {
  const sh = shape();
  let mismatched = 0;

  for (const def of SLOTS) {
    const box = root.querySelector<HTMLElement>(`[data-slot-opt="${def.id}"]`);
    const input = box?.querySelector<HTMLInputElement>('input');
    if (!box || !input) continue;

    const ok = def.shapes.includes(sh);
    input.disabled = !ok && !input.checked;
    box.classList.toggle('promo-slot-off', !ok);

    if (!ok && input.checked) mismatched += 1;
  }

  const warn = q('[data-slot-warn]');
  if (mismatched) {
    warn.querySelector('span')!.textContent =
      `${mismatched} aisi jagah chuni hui hai jo ${shapeWord(sh)} nahi leti. ` +
      'Wahan ad site ke design se mail nahi khayega — ya nishan hata dein, ya doosri shakal chunein.';
    warn.hidden = false;
  } else {
    warn.hidden = true;
  }
}

function shape(): 'card' | 'banner' {
  return (form.querySelector<HTMLInputElement>('input[name=shape]:checked')?.value ?? 'card') as
    'card' | 'banner';
}

/** Card wale khane banner par chhup jate hain — wahan un ka koi kaam nahi. */
function syncShape(): void {
  const isCard = shape() === 'card';
  root.querySelectorAll<HTMLElement>('[data-card-only]').forEach((el) => { el.hidden = !isCard; });
  q<HTMLInputElement>('#p-title').required = isCard;
  syncSlotShapes();
  q('[data-image-note]').textContent = isCard
    ? 'Card ke liye sirf logo — na ho to bhi ad chal jata hai. Tasveer khud ba khud chhoti ho jati hai.'
    : 'Banner ke liye tasveer LAZMI hai — banner ki poori baat hi tasveer hai. Chaurai 1200px tak khud ho jati hai.';
  drawPreview();
}

function openSheet(p?: PromoRow): void {
  form.reset();
  formError.hidden = true;
  imageData = undefined;
  imageW = 0;
  imageH = 0;

  idField.value = p?.id ?? '';
  q('#promo-form-title').textContent = p ? 'Ishtihaar badlein' : 'Naya ishtihaar';
  deleteBtn.hidden = !p;

  if (p) {
    (form.elements.namedItem('shape') as RadioNodeList).value = p.shape ?? 'card';
    setVal('brand', p.brand); setVal('title', p.title); setVal('body', p.body);
    setVal('ctaLabel', p.ctaLabel); setVal('href', p.href);
    setVal('startsAt', p.startsAt?.slice(0, 10)); setVal('endsAt', p.endsAt?.slice(0, 10));
    setVal('weight', String(p.weight ?? 1));
    setVal('contact', p.billing.contact);
    setVal('amount', p.billing.amount != null ? String(p.billing.amount) : '');
    setVal('notes', p.billing.notes);
    (form.elements.namedItem('active') as HTMLInputElement).checked = p.active !== false;
    (form.elements.namedItem('paid') as HTMLInputElement).checked = !!p.billing.paid;

    form.querySelectorAll<HTMLInputElement>('input[name=slots]').forEach((el) => {
      el.checked = (p.slots ?? []).includes(el.value);
    });

    imageW = p.imageW ?? 0;
    imageH = p.imageH ?? 0;
    showImage(p.imageData ?? null);
  } else {
    (form.elements.namedItem('active') as HTMLInputElement).checked = true;
    showImage(null);
  }

  q('[data-weight-out]').textContent = String(
    (form.elements.namedItem('weight') as HTMLInputElement).value
  );
  syncShape();
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
}

function setVal(name: string, v: string | number | null | undefined): void {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = v == null ? '' : String(v);
}

function closeSheet(): void {
  sheet.hidden = true;
  document.body.style.overflow = '';
}

/** `null` = koi tasveer nahi. Ye sirf dikhata hai, `imageData` ko nahi chherta. */
function showImage(src: string | null): void {
  if (src) {
    imagePreview.src = src;
    imageRow.hidden = false;
  } else {
    imagePreview.removeAttribute('src');
    imageRow.hidden = true;
  }
  drawPreview();
}

/** Abhi jo tasveer dikhani chahiye — nayi, ya purani, ya koi nahi. */
function currentImage(): string | null {
  if (imageData !== undefined) return imageData;
  return imagePreview.getAttribute('src') || null;
}

// ---------------------------------------------------------------------------
// Preview — site ke asli class names ke saath
// ---------------------------------------------------------------------------

function drawPreview(): void {
  const brand = (form.elements.namedItem('brand') as HTMLInputElement)?.value || 'Brand';
  const title = (form.elements.namedItem('title') as HTMLInputElement)?.value || 'Heading';
  const body = (form.elements.namedItem('body') as HTMLInputElement)?.value || '';
  const cta = (form.elements.namedItem('ctaLabel') as HTMLInputElement)?.value || 'Dekhein';
  const img = currentImage();

  if (shape() === 'banner') {
    previewBox.innerHTML = img
      ? `<div class="promo promo-banner"><img src="${esc(img)}" alt="" /><span class="promo-tag">Ishtihaar</span></div>`
      : `<p style="color:var(--muted-fg);font-size:14.5px">Banner ke liye tasveer chunein — us ke bagair ye ad site par nahi jayega.</p>`;
    return;
  }

  previewBox.innerHTML = `
    <div class="promo promo-card">
      ${img ? `<img class="promo-logo" src="${esc(img)}" alt="" />` : ''}
      <div class="promo-text">
        <p class="promo-tag">Ishtihaar · ${esc(brand)}</p>
        <h3>${esc(title)}</h3>
        ${body ? `<p class="promo-body">${esc(body)}</p>` : ''}
        <span class="promo-cta">${esc(cta)}</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Chalao
// ---------------------------------------------------------------------------

async function load(): Promise<void> {
  loading.hidden = false;
  errorBox.hidden = true;
  try {
    rows = await listPromos();
    // Numbers na milein to ads phir bhi dikhne chahiyen — ginti zaroori nahi.
    try {
      totals = await promoTotals(30);
    } catch (err) {
      console.error('promoStats nahi mile:', err);
      totals = new Map();
    }
    render();
  } catch (err) {
    fail(errorBox, firestoreError(err));
  } finally {
    loading.hidden = true;
  }
}

(async () => {
  const session = await getAdminSession();
  if (!session) return; // Layout ka gate pehle hi /login bhej chuka hoga.

  buildSlotOptions();

  q('[data-new]').addEventListener('click', () => openSheet());
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // Preview har harkat par — banda likhte likhte dekhta rahe.
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'shape') syncShape();
    if (t.name === 'slots') syncSlotShapes();
    if (t.name === 'weight') q('[data-weight-out]').textContent = t.value;
    drawPreview();
  });

  // ---- tasveer ----
  q('[data-pick]').addEventListener('click', () => fileInput.click());
  q('[data-image-clear]').addEventListener('click', () => {
    imageData = null;
    fileInput.value = '';
    showImage(null);
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    formError.hidden = true;
    try {
      // Banner chaura hota hai, card ka logo chhota — ek hi hadd dono par
      // lagana ya to logo ko bekar bhari banata hai ya banner ko dhundhla.
      const maxW = shape() === 'banner' ? 1200 : 256;
      const out = await shrinkImage(file, maxW);
      imageData = out.dataUrl;
      imageW = out.w;
      imageH = out.h;
      showImage(out.dataUrl);
    } catch (err) {
      fail(formError, err instanceof Error ? err.message : 'Tasveer nahi li ja saki.');
    }
  });

  // ---- save ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const fd = new FormData(form);
    const slots = fd.getAll('slots').map(String);
    const isBanner = shape() === 'banner';

    const brand = String(fd.get('brand') ?? '').trim();
    const title = String(fd.get('title') ?? '').trim();
    const href = String(fd.get('href') ?? '').trim();

    if (!brand) return fail(formError, 'Brand ka naam likhein.');
    if (!href) return fail(formError, 'Click par kahan jana hai, wo link likhein.');
    if (!/^https?:\/\//i.test(href)) {
      return fail(formError, 'Link https:// se shuru hona chahiye — warna kaam nahi karega.');
    }
    if (!isBanner && !title) return fail(formError, 'Card ka heading likhein.');
    if (!slots.length) return fail(formError, 'Kam se kam ek jagah chunein jahan ye ad chale.');
    if (isBanner && !currentImage()) {
      return fail(formError, 'Banner ke liye tasveer lazmi hai — us ke bagair site par khali dabba reh jata.');
    }

    const from = String(fd.get('startsAt') ?? '');
    const to = String(fd.get('endsAt') ?? '');
    if (from && to && new Date(from) > new Date(to)) {
      return fail(formError, 'Khatam hone ki tareekh shuru se pehle nahi ho sakti.');
    }

    const draft: PromoDraft = {
      shape: isBanner ? 'banner' : 'card',
      brand,
      title: isBanner ? title || brand : title,
      body: String(fd.get('body') ?? '').trim(),
      ctaLabel: String(fd.get('ctaLabel') ?? '').trim(),
      href,
      imageAlt: isBanner ? `${brand} ka ishtihaar` : '',
      imageW, imageH,
      slots,
      weight: Number(fd.get('weight') ?? 1),
      active: fd.get('active') === 'on',
      startsAt: from ? new Date(from).toISOString() : null,
      endsAt: to ? new Date(to).toISOString() : null,
      contact: String(fd.get('contact') ?? '').trim(),
      amount: fd.get('amount') ? Number(fd.get('amount')) : 0,
      paid: fd.get('paid') === 'on',
      notes: String(fd.get('notes') ?? '').trim(),
      ...(imageData !== undefined ? { imageData } : {}),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Save ho raha hai…';
    try {
      await savePromo(idField.value || null, draft);
      closeSheet();
      await load();
    } catch (err) {
      fail(formError, firestoreError(err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save karein';
    }
  });

  // ---- mitana ----
  deleteBtn.addEventListener('click', async () => {
    const id = idField.value;
    if (!id) return;
    if (!confirm('Ye ishtihaar mita dein? Ye wapis nahi aayega.')) return;
    try {
      await deletePromo(id);
      closeSheet();
      await load();
    } catch (err) {
      fail(formError, firestoreError(err));
    }
  });

  // ---- fehrist ke buttons ----
  listBox.addEventListener('click', async (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-edit],[data-toggle]');
    if (!el) return;

    const editId = el.dataset.edit;
    if (editId) {
      const row = rows.find((r) => r.id === editId);
      if (row) openSheet(row);
      return;
    }

    const id = el.dataset.toggle!;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    (el as HTMLButtonElement).disabled = true;
    try {
      await setPromoActive(id, !row.active);
      await load();
    } catch (err) {
      fail(errorBox, firestoreError(err));
      (el as HTMLButtonElement).disabled = false;
    }
  });

  await load();
})();
