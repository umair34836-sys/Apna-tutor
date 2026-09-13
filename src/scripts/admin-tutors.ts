import { getAdminSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { listTutorsByStatus, setTutorStatus } from '../lib/admin';
import { isFullyVerified, type Tutor, type TutorStatus } from '../lib/types';
import { svg } from '../lib/icons';
import { feeRange } from '../lib/taxonomy';

const root = document.getElementById('admin-tutors');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  let adminUid = '';
  let active: TutorStatus = (new URLSearchParams(window.location.search).get('status') as TutorStatus) || 'pending';

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  function badgeSummary(t: Tutor): string {
    if (isFullyVerified(t)) return '<span class="badge b-full">Verified</span>';
    const bits = [
      t.badges?.phoneChecked ? '<span class="badge b-phone">Phone</span>' : '',
      t.badges?.idChecked ? '<span class="badge b-id">ID</span>' : '',
      t.badges?.qualChecked ? '<span class="badge b-qual">Qual</span>' : '',
    ].filter(Boolean);
    return bits.length ? bits.join('') : '<span class="badge b-none">Koi check nahi</span>';
  }

  function row(t: Tutor): string {
    const actions: string[] = [
      `<a class="btn btn-outline btn-sm" href="${url(`/admin/tutors/verify?id=${encodeURIComponent(t.id)}`)}">${svg('shield-check', { size: 16 })}Verify</a>`,
    ];

    if (t.status !== 'approved') {
      actions.push(`<button type="button" class="btn btn-primary btn-sm" data-act="approved" data-id="${esc(t.id)}">Approve</button>`);
    }
    if (t.status === 'pending') {
      actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-act="rejected" data-id="${esc(t.id)}">Reject</button>`);
    }
    if (t.status === 'approved') {
      actions.push(`<a class="btn btn-ghost btn-sm" href="${url(`/teacher/${encodeURIComponent(t.slug)}`)}">Public page</a>`);
      actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-act="suspended" data-id="${esc(t.id)}">Suspend</button>`);
    }
    if (t.status === 'suspended' || t.status === 'rejected') {
      actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-act="pending" data-id="${esc(t.id)}">Wapas queue mein</button>`);
    }

    return `
      <article class="admin-row" data-row="${esc(t.id)}">
        <div class="admin-row-main">
          <div>
            <b>${esc(t.name)}</b>
            <span>${esc(t.city)} · ${esc((t.subjects ?? []).join(', '))} · ${esc(t.qualification)}</span>
            <span>${esc(t.experienceYears)} saal · ${esc(feeRange(t.feeMin, t.feeMax))}</span>
          </div>
          <div class="badges">${badgeSummary(t)}</div>
        </div>
        <div class="admin-row-actions">${actions.join('')}</div>
        <p class="state state-error row-error" hidden><span></span></p>
      </article>`;
  }

  async function render() {
    q('[data-loading]').hidden = false;
    q('[data-list]').hidden = true;
    q('[data-error]').hidden = true;

    try {
      const tutors = await listTutorsByStatus(active);

      q('[data-list]').innerHTML = tutors.length
        ? `<div class="admin-list">${tutors.map(row).join('')}</div>`
        : `<div class="empty">${svg('check-circle')}<h3>Queue khali hai</h3>
             <p>Is status mein koi profile nahi.</p></div>`;

      q('[data-loading]').hidden = true;
      q('[data-list]').hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  }

  // ---- Status badalna ----
  q('[data-list]').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;

    const id = btn.dataset.id!;
    const next = btn.dataset.act as TutorStatus;
    const article = root.querySelector<HTMLElement>(`[data-row="${id}"]`)!;
    const errEl = article.querySelector<HTMLElement>('.row-error')!;

    let note = '';
    if (next === 'rejected' || next === 'suspended') {
      // Wajah likhna lazmi — baad mein tutor ko batana parta hai kya kami thi.
      const answer = window.prompt(
        next === 'rejected'
          ? 'Reject karne ki wajah? (tutor ko batane ke liye)'
          : 'Suspend karne ki wajah?'
      );
      if (answer === null) return;
      note = answer.trim();
      if (!note) { window.alert('Wajah likhna zaroori hai.'); return; }
    }

    errEl.hidden = true;
    article.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
      await setTutorStatus(id, next, adminUid, note);
      await render();
    } catch (err) {
      errEl.querySelector('span')!.textContent = firestoreError(err);
      errEl.hidden = false;
      article.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  });

  // ---- Tabs ----
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.filter'));

  function selectTab(tab: HTMLButtonElement) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    active = tab.dataset.status as TutorStatus;
    window.history.replaceState({}, '', `/admin/tutors?status=${active}`);
    render();
  }

  tabs.forEach((tab, i) => {
    if (tab.dataset.status === active) {
      tabs.forEach((t) => { t.setAttribute('aria-selected', 'false'); t.tabIndex = -1; });
      tab.setAttribute('aria-selected', 'true');
      tab.tabIndex = 0;
    }
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      let next: HTMLButtonElement | undefined;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); selectTab(next); next.focus(); }
    });
  });

  getAdminSession().then((session) => {
    if (!session) return;
    adminUid = session.user.uid;
    render();
  });
}
