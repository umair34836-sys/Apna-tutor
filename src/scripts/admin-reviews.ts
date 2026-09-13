import { getAdminSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import { approveReview, listReviewsByStatus, rejectReview, type AdminReview } from '../lib/admin';
import { getTutorById } from '../lib/queries';
import { svg } from '../lib/icons';

const root = document.getElementById('admin-reviews');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  let active: AdminReview['status'] = 'pending';
  const tutorNames = new Map<string, string>();

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  const stars = (n: number) =>
    Array.from({ length: 5 }, (_, i) => svg(i < n ? 'star' : 'star-outline', { size: 16 })).join('');

  function card(r: AdminReview): string {
    const actions =
      active === 'pending'
        ? `<button type="button" class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(r.id)}" data-tutor="${esc(r.tutorUid)}">Approve</button>
           <button type="button" class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(r.id)}" data-tutor="${esc(r.tutorUid)}">Reject</button>`
        : active === 'approved'
          ? `<button type="button" class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(r.id)}" data-tutor="${esc(r.tutorUid)}">Hata dein</button>`
          : `<button type="button" class="btn btn-outline btn-sm" data-act="approve" data-id="${esc(r.id)}" data-tutor="${esc(r.tutorUid)}">Approve kar dein</button>`;

    return `
      <article class="admin-row" data-row="${esc(r.id)}">
        <div class="admin-row-main">
          <div>
            <b>${esc(r.parentName)} → ${esc(tutorNames.get(r.tutorUid) ?? r.tutorUid)}</b>
            <span class="stars-inline">${stars(r.rating)} ${r.rating}/5</span>
          </div>
        </div>
        <p class="admin-note">${esc(r.text)}</p>
        <div class="admin-row-actions">${actions}</div>
        <p class="state state-success row-ok" hidden><span></span></p>
        <p class="state state-error row-error" hidden><span></span></p>
      </article>`;
  }

  async function render() {
    q('[data-loading]').hidden = false;
    q('[data-list]').hidden = true;
    q('[data-error]').hidden = true;

    try {
      const reviews = await listReviewsByStatus(active);

      // Tutor ke naam — har review par ek read na ho, isliye unique IDs par.
      const unknown = [...new Set(reviews.map((r) => r.tutorUid))].filter((id) => !tutorNames.has(id));
      await Promise.all(
        unknown.map(async (id) => {
          const t = await getTutorById(id).catch(() => null);
          tutorNames.set(id, t?.name ?? id);
        })
      );

      q('[data-list]').innerHTML = reviews.length
        ? `<div class="admin-list">${reviews.map(card).join('')}</div>`
        : `<div class="empty">${svg('check-circle')}<h3>Queue khali hai</h3><p>Is status mein koi review nahi.</p></div>`;

      q('[data-loading]').hidden = true;
      q('[data-list]').hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  }

  q('[data-list]').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;

    const id = btn.dataset.id!;
    const tutorUid = btn.dataset.tutor!;
    const article = root.querySelector<HTMLElement>(`[data-row="${id}"]`)!;
    const okEl = article.querySelector<HTMLElement>('.row-ok')!;
    const errEl = article.querySelector<HTMLElement>('.row-error')!;

    okEl.hidden = true;
    errEl.hidden = true;
    article.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
      const result = btn.dataset.act === 'approve'
        ? await approveReview(id, tutorUid)
        : await rejectReview(id, tutorUid);

      // Recompute ka nateeja dikhana zaroori hai — ye admin panel hi rating
      // likhta hai, to confirm hona chahiye ke sahi number gaya.
      okEl.querySelector('span')!.textContent =
        `Ho gaya. Nayi rating: ${result.count > 0 ? `${result.avg} (${result.count} reviews)` : 'koi approved review nahi'}`;
      okEl.hidden = false;

      window.setTimeout(render, 1200);
    } catch (err) {
      errEl.querySelector('span')!.textContent = firestoreError(err);
      errEl.hidden = false;
      article.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  });

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.filter'));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1; });
      active = tab.dataset.status as AdminReview['status'];
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
