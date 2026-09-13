import { getSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { closeRequest, getRequest, getTutorById, listLeadsForRequest, listMyRequests, type TuitionRequest } from '../lib/queries';
import { classLabel, modeLabel } from '../lib/taxonomy';
import { tutorCardHtml } from '../lib/tutor-card';
import { svg } from '../lib/icons';

const root = document.getElementById('requests-page');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const fail = (msg: string) => {
    q('[data-loading]').hidden = true;
    q('[data-error]').querySelector('span')!.textContent = msg;
    q('[data-error]').hidden = false;
  };

  const statusText = (s: TuitionRequest['status']) =>
    s === 'open' ? 'Open' : s === 'matched' ? 'Matched' : 'Band';

  async function renderList(uid: string) {
    const requests = await listMyRequests(uid);

    q('[data-requests]').innerHTML = requests.length
      ? `<div class="req-list">${requests.map((r) => `
          <a class="req-row" href="${url(`/parent/requests?id=${encodeURIComponent(r.id)}`)}">
            <div>
              <b>${esc(r.subject)} — ${esc(classLabel(r.classLevel))}</b>
              <span>${esc(r.area)} · Rs. ${Number(r.budgetMax).toLocaleString('en-PK')} tak</span>
            </div>
            <span class="req-status" data-status="${esc(r.status)}">${statusText(r.status)}</span>
          </a>`).join('')}</div>`
      : `<div class="empty">
           ${svg('file-text')}
           <h3>Abhi koi request nahi</h3>
           <p>Apni requirement post kar dein — hum aap ke area ke matching tutors tak pohancha denge, aur jo dilchaspi lein wo yahan nazar aayenge.</p>
           <a class="btn btn-primary" href="${url('/request-tutor')}">Request post karein</a>
         </div>`;

    q('[data-loading]').hidden = true;
    q('[data-list-view]').hidden = false;
  }

  async function renderDetail(id: string) {
    const request = await getRequest(id);

    if (!request) {
      fail('Ye request nahi mili. Ho sakta hai delete ho chuki ho.');
      return;
    }

    q('[data-req-title]').textContent = `${request.subject} — ${classLabel(request.classLevel)}`;
    const status = q('[data-req-status]');
    status.textContent = statusText(request.status);
    status.dataset.status = request.status;

    const facts: [string, string][] = [
      ['Area', request.area],
      ['Mode', modeLabel(request.mode).split(' (')[0]],
      ['Budget', `Rs. ${Number(request.budgetMax).toLocaleString('en-PK')} tak`],
      ['Timing', request.timing || '—'],
      ['Teacher gender', request.genderPref === 'any' ? 'Koi preference nahi' : request.genderPref],
    ];
    q('[data-req-facts]').innerHTML = facts
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join('');

    if (request.notes) {
      const notes = q('[data-req-notes]');
      notes.textContent = request.notes;
      notes.hidden = false;
    }

    const closeBtn = q<HTMLButtonElement>('[data-close-req]');
    if (request.status === 'open') {
      closeBtn.hidden = false;
      closeBtn.addEventListener('click', async () => {
        closeBtn.disabled = true;
        closeBtn.textContent = 'Band kar rahe hain…';
        try {
          await closeRequest(id);
          window.location.reload();
        } catch (err) {
          fail(firestoreError(err));
        }
      });
    }

    // Interested tutors — inke public profiles laate hain.
    const leads = await listLeadsForRequest(id);
    const box = q('[data-interested]');

    if (leads.length === 0) {
      box.innerHTML = `<div class="empty">
        ${svg('clock')}
        <h3>Abhi kisi tutor ne jawab nahi diya</h3>
        <p>Aap ki request matching tutors tak pohanch chuki hai. Jab koi dilchaspi lega, wo yahan nazar aayega — aap ko email nahi aayegi, isliye kabhi kabhi ye page dekh lein.</p>
        <a class="btn btn-outline" href="${url('/find-tutor')}">Khud bhi tutors dekhein</a>
      </div>`;
      return;
    }

    const tutors = (await Promise.all(leads.map((l) => getTutorById(l.tutorUid).catch(() => null))))
      .filter((t): t is NonNullable<typeof t> => Boolean(t) && t!.status === 'approved');

    box.innerHTML = tutors.length
      ? `<div class="tutors">${tutors.map(tutorCardHtml).join('')}</div>`
      : `<div class="empty">${svg('clock')}<h3>Ye tutors filhal available nahi</h3>
           <p>Jin tutors ne dilchaspi li thi unki profiles abhi live nahi hain.</p></div>`;
  }

  getSession('parent').then(async (session) => {
    if (!session) return;

    const id = new URLSearchParams(window.location.search).get('id');

    try {
      if (id) {
        await renderDetail(id);
        q('[data-loading]').hidden = true;
        q('[data-detail-view]').hidden = false;
      } else {
        await renderList(session.user.uid);
      }
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
