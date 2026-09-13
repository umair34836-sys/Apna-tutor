import { getAdminSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import { approvePhoto, getPhotoSubmission, getTutorContact, rejectPhoto, setBadges, setTutorStatus } from '../lib/admin';
import { getTutorById } from '../lib/queries';
import { classLabel, boardLabel, feeRange, modeLabel } from '../lib/taxonomy';
import { svg } from '../lib/icons';
import type { Tutor, TutorBadges, TutorStatus } from '../lib/types';

const rootEl = document.getElementById('verify-page');

if (rootEl) {
  // Closures ke andar TS narrowing kho jati hai, isliye ek non-null const.
  const root = rootEl;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const tutorId = new URLSearchParams(window.location.search).get('id') ?? '';
  let adminUid = '';
  let tutor: Tutor | null = null;

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  const badgeInputs = () =>
    Array.from(root.querySelectorAll<HTMLInputElement>('[data-badge]'));

  function readBadges(): TutorBadges {
    const get = (name: string) =>
      Boolean(root.querySelector<HTMLInputElement>(`[data-badge="${name}"]`)?.checked);
    return { phoneChecked: get('phoneChecked'), idChecked: get('idChecked'), qualChecked: get('qualChecked') };
  }

  /** "ApnaTutor Verified" derive hota hai — koi alag field nahi. */
  function updateDerived() {
    const b = readBadges();
    const full = b.phoneChecked && b.idChecked && b.qualChecked;
    const el = q('[data-derived]');
    el.dataset.full = full ? '1' : '';
    el.textContent = full
      ? 'Teeno checks complete — profile par "ApnaTutor Verified" badge aayega.'
      : 'Teeno checks complete nahi — sirf jo check hua uska badge lagega.';
  }

  function renderDecision(status: TutorStatus) {
    const buttons: string[] = [];
    if (status !== 'approved') buttons.push(`<button type="button" class="btn btn-primary" data-decide="approved">${svg('check')}Approve karein</button>`);
    if (status === 'pending') buttons.push('<button type="button" class="btn btn-ghost" data-decide="rejected">Reject karein</button>');
    if (status === 'approved') buttons.push('<button type="button" class="btn btn-ghost" data-decide="suspended">Suspend karein</button>');
    if (status === 'suspended' || status === 'rejected') buttons.push('<button type="button" class="btn btn-ghost" data-decide="pending">Wapas queue mein</button>');

    q('[data-decision]').innerHTML = buttons.join('');
  }

  // ---- Badges save ----
  q('[data-save-badges]').addEventListener('click', async () => {
    const saved = q('[data-saved]');
    const err = q('[data-save-error]');
    saved.hidden = true;
    err.hidden = true;

    const btn = q<HTMLButtonElement>('[data-save-badges]');
    btn.disabled = true;
    btn.textContent = 'Save ho raha hai…';

    try {
      const note = (document.getElementById('verify-note') as HTMLInputElement).value.trim();
      await setBadges(tutorId, readBadges(), adminUid, note);
      saved.hidden = false;
      window.setTimeout(() => { saved.hidden = true; }, 4000);
    } catch (e) {
      err.querySelector('span')!.textContent = firestoreError(e);
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Checks save karein';
    }
  });

  // ---- Decision ----
  q('[data-decision]').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-decide]');
    if (!btn) return;

    const next = btn.dataset.decide as TutorStatus;
    let note = '';

    if (next === 'rejected' || next === 'suspended') {
      const answer = window.prompt(next === 'rejected' ? 'Reject karne ki wajah?' : 'Suspend karne ki wajah?');
      if (answer === null) return;
      note = answer.trim();
      if (!note) { window.alert('Wajah likhna zaroori hai.'); return; }
    }

    const err = q('[data-decision-error]');
    err.hidden = true;
    q('[data-decision]').querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
      await setTutorStatus(tutorId, next, adminUid, note);
      window.location.href = '/admin/tutors';
    } catch (e2) {
      err.querySelector('span')!.textContent = firestoreError(e2);
      err.hidden = false;
      q('[data-decision]').querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  });

  // ---- Photo ----
  q('[data-photo-approve]').addEventListener('click', async () => {
    const img = q<HTMLImageElement>('[data-photo-img]');
    try {
      await approvePhoto(tutorId, img.src);
      q('[data-photo-card]').hidden = true;
    } catch (e) { fail(firestoreError(e)); }
  });

  q('[data-photo-reject]').addEventListener('click', async () => {
    try {
      await rejectPhoto(tutorId);
      q('[data-photo-card]').hidden = true;
    } catch (e) { fail(firestoreError(e)); }
  });

  badgeInputs().forEach((i) => i.addEventListener('change', updateDerived));

  // ---- Boot ----
  getAdminSession().then(async (session) => {
    if (!session) return;
    adminUid = session.user.uid;

    if (!tutorId) { fail('Tutor ki ID nahi mili. Queue se dobara kholein.'); return; }

    try {
      tutor = await getTutorById(tutorId);
      if (!tutor) { fail('Ye tutor nahi mila.'); return; }

      q('[data-t-name]').textContent = tutor.name;
      const status = q('[data-t-status]');
      status.textContent = tutor.status;
      status.dataset.status = tutor.status === 'approved' ? 'open' : tutor.status === 'pending' ? 'matched' : 'closed';

      const facts: [string, string][] = [
        ['Sheher', tutor.city],
        ['Areas', (tutor.areas ?? []).join(', ')],
        ['Subjects', (tutor.subjects ?? []).join(', ')],
        ['Classes', (tutor.classes ?? []).map(classLabel).join(', ')],
        ['Boards', (tutor.boards ?? []).map(boardLabel).join(', ')],
        ['Mode', (tutor.modes ?? []).map((m) => modeLabel(m).split(' (')[0]).join(', ')],
        ['Qualification', tutor.qualification],
        ['Tajurba', `${tutor.experienceYears} saal`],
        ['Fee', feeRange(tutor.feeMin, tutor.feeMax)],
        ['Availability', tutor.availability || '—'],
        ['Slug', tutor.slug],
      ];
      q('[data-t-facts]').innerHTML = facts
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`)
        .join('');

      if (tutor.bio) {
        const bio = q('[data-t-bio]');
        bio.textContent = tutor.bio;
        bio.hidden = false;
      }

      // Badges pehle se set hon to dikhao.
      const b = tutor.badges ?? { phoneChecked: false, idChecked: false, qualChecked: false };
      (Object.keys(b) as (keyof TutorBadges)[]).forEach((key) => {
        const input = root.querySelector<HTMLInputElement>(`[data-badge="${key}"]`);
        if (input) input.checked = Boolean(b[key]);
      });
      updateDerived();

      renderDecision(tutor.status);

      // Contact + photo — admin hi padh sakta hai.
      const [contact, photo] = await Promise.all([
        getTutorContact(tutorId).catch(() => null),
        getPhotoSubmission(tutorId).catch(() => null),
      ]);

      q('[data-t-contact]').innerHTML = contact
        ? `<a class="btn btn-wa btn-sm" href="https://wa.me/${esc(contact.whatsapp.replace(/[^\d]/g, ''))}" rel="noopener">${svg('message-square', { size: 16 })}WhatsApp ${esc(contact.whatsapp)}</a>
           <a class="btn btn-outline btn-sm" href="tel:${esc(contact.phone)}">${svg('phone', { size: 16 })}${esc(contact.phone)}</a>
           ${contact.email ? `<a class="btn btn-ghost btn-sm" href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}`
        : '<span class="hint">Is tutor ne abhi contact add nahi kiya.</span>';

      if (photo?.url) {
        q<HTMLImageElement>('[data-photo-img]').src = photo.url;
        q('[data-photo-card]').hidden = false;
      }

      q('[data-loading]').hidden = true;
      q('[data-content]').hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
