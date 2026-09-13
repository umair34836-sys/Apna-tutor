import { getSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { createReview, getMyReview, getTutorById, listMyConnections } from '../lib/queries';
import { tutorCardHtml } from '../lib/tutor-card';
import { svg } from '../lib/icons';
import type { Tutor } from '../lib/types';

const root = document.getElementById('saved-page');

if (root) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const dialog = $<HTMLDialogElement>('review-dialog');
  const textarea = $<HTMLTextAreaElement>('review-text');

  let uid = '';
  let parentName = '';
  let target: { uid: string; name: string } | null = null;

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  // -------------------------------------------------------------------------
  // Review dialog
  // -------------------------------------------------------------------------

  textarea.addEventListener('input', () => {
    $('review-count').textContent = String(textarea.value.length);
  });

  function openReview(tutorUid: string, name: string) {
    target = { uid: tutorUid, name };
    document.querySelector<HTMLElement>('[data-review-for]')!.textContent = `${name} ke baare mein`;
    textarea.value = '';
    $('review-count').textContent = '0';
    document.querySelectorAll<HTMLInputElement>('input[name="rating"]').forEach((i) => { i.checked = false; });
    document.querySelector<HTMLElement>('[data-review-error]')!.hidden = true;
    document.querySelector<HTMLElement>('[data-review-ok]')!.hidden = true;
    document.querySelector<HTMLElement>('[data-review-submit]')!.hidden = false;
    $('e-rating').classList.remove('show');
    $('e-text').classList.remove('show');
    dialog.showModal();
  }

  document.querySelector('[data-review-close]')?.addEventListener('click', () => dialog.close());

  document.querySelector('[data-review-submit]')?.addEventListener('click', async () => {
    if (!target) return;

    const errBox = document.querySelector<HTMLElement>('[data-review-error]')!;
    errBox.hidden = true;

    const rating = Number(
      document.querySelector<HTMLInputElement>('input[name="rating"]:checked')?.value ?? 0
    );
    const text = textarea.value.trim();

    // Hadden rules se match karti hain: rating 1–5, text 10–800.
    const noRating = !rating;
    $('e-rating').classList.toggle('show', noRating);

    const textBad = text.length < 10 ? 'Kam az kam 10 characters likhein' : text.length > 800 ? '800 se zyada nahi' : null;
    $('e-text').classList.toggle('show', Boolean(textBad));
    if (textBad) $('e-text').querySelector('span')!.textContent = textBad;

    if (noRating) { document.querySelector<HTMLInputElement>('input[name="rating"]')?.focus(); return; }
    if (textBad) { textarea.focus(); return; }

    const btn = document.querySelector<HTMLButtonElement>('[data-review-submit]')!;
    btn.disabled = true;
    btn.textContent = 'Bhej rahe hain…';

    try {
      await createReview(uid, target.uid, { rating, text, parentName });
      document.querySelector<HTMLElement>('[data-review-ok]')!.hidden = false;
      btn.hidden = true;

      const card = root.querySelector<HTMLElement>(`[data-review-for-uid="${target.uid}"]`);
      if (card) card.outerHTML = reviewedPill('pending');
    } catch (err) {
      errBox.querySelector('span')!.textContent = firestoreError(err);
      errBox.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Review bhejein';
    }
  });

  const reviewedPill = (status: string) =>
    `<span class="reviewed-pill">${svg('check-circle', { size: 15 })}${
      status === 'approved' ? 'Aap ka review live hai' : 'Review team ke paas hai'
    }</span>`;

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-review-for-uid]');
    if (btn) openReview(btn.dataset.reviewForUid!, btn.dataset.tutorName ?? 'Ye tutor');
  });

  getSession('parent').then(async (session) => {
    if (!session) return;
    uid = session.user.uid;
    parentName = session.profile?.name ?? 'Parent';

    try {
      const connections = await listMyConnections(uid);

      if (connections.length === 0) {
        q('[data-loading]').hidden = true;
        q('[data-list]').innerHTML = `<div class="empty">
          ${svg('bookmark')}
          <h3>Abhi kisi tutor ka contact nahi khola</h3>
          <p>Jab aap kisi tutor ka contact kholenge, wo yahan mehfooz ho jayega — aur aap us ke baare mein review bhi likh sakenge.</p>
          <a class="btn btn-primary" href="${url('/find-tutor')}">Tutors dekhein</a>
        </div>`;
        q('[data-list]').hidden = false;
        return;
      }

      const [tutors, reviews] = await Promise.all([
        Promise.all(connections.map((c) => getTutorById(c.tutorUid).catch(() => null))),
        Promise.all(connections.map((c) => getMyReview(uid, c.tutorUid).catch(() => null))),
      ]);

      const rows = tutors
        .map((t, i) => ({ tutor: t, review: reviews[i] }))
        .filter((r): r is { tutor: Tutor; review: typeof reviews[number] } => Boolean(r.tutor));

      q('[data-list]').innerHTML = `
        <div class="tutors">
          ${rows.map(({ tutor, review }) => `
            <div class="saved-item">
              ${tutorCardHtml(tutor)}
              <div class="saved-review">
                ${review
                  ? reviewedPill(review.status)
                  : `<button type="button" class="btn btn-outline btn-sm btn-block"
                       data-review-for-uid="${esc(tutor.id)}" data-tutor-name="${esc(tutor.name)}">
                       ${svg('star-outline', { size: 16 })}Review likhein
                     </button>`}
              </div>
            </div>`).join('')}
        </div>`;

      q('[data-loading]').hidden = true;
      q('[data-list]').hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
