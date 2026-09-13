import { getSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { listLeadsForRequest, listMyConnections, listMyRequests } from '../lib/queries';
import { classLabel } from '../lib/taxonomy';
import { svg } from '../lib/icons';

const root = document.getElementById('parent-dash');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  getSession('parent').then(async (session) => {
    if (!session) return;

    try {
      const [requests, connections] = await Promise.all([
        listMyRequests(session.user.uid),
        listMyConnections(session.user.uid),
      ]);

      const open = requests.filter((r) => r.status === 'open');

      // Interested tutors sirf open requests ke liye ginte hain — band requests
      // par query chalana bekaar reads kharch karta hai.
      const interestedCounts = await Promise.all(
        open.slice(0, 5).map((r) => listLeadsForRequest(r.id).then((l) => l.length).catch(() => 0))
      );
      const interested = interestedCounts.reduce((a, b) => a + b, 0);

      q('[data-stat-requests]').textContent = String(open.length);
      q('[data-stat-interested]').textContent = String(interested);
      q('[data-stat-saved]').textContent = String(connections.length);

      q('[data-requests]').innerHTML = requests.length
        ? `<div class="req-list">${requests.slice(0, 3).map((r) => `
            <a class="req-row" href="${url(`/parent/requests?id=${encodeURIComponent(r.id)}`)}">
              <div>
                <b>${esc(r.subject)} — ${esc(classLabel(r.classLevel))}</b>
                <span>${esc(r.area)} · Rs. ${Number(r.budgetMax).toLocaleString('en-PK')} tak</span>
              </div>
              <span class="req-status" data-status="${esc(r.status)}">${r.status === 'open' ? 'Open' : r.status === 'matched' ? 'Matched' : 'Band'}</span>
            </a>`).join('')}</div>`
        : `<div class="empty">
             ${svg('file-text')}
             <h3>Abhi koi request nahi</h3>
             <p>Apni requirement post kar dein — hum aap ke area ke matching tutors tak pohancha denge.</p>
             <a class="btn btn-primary" href="${url('/request-tutor')}">Request post karein</a>
           </div>`;

      q('[data-loading]').hidden = true;
      q('[data-content]').hidden = false;
    } catch (err) {
      q('[data-loading]').hidden = true;
      q('[data-error]').querySelector('span')!.textContent = firestoreError(err);
      q('[data-error]').hidden = false;
    }
  });
}
