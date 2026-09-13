import { getSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { getMyTutorProfile, listMyLeads } from '../lib/queries';
import { classLabel } from '../lib/taxonomy';
import type { Tutor } from '../lib/types';

const root = document.getElementById('dash');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const loading = q('[data-loading]');
  const content = q('[data-content]');
  const noProfile = q('[data-no-profile]');
  const errorBox = q('[data-error]');

  const fail = (msg: string) => {
    loading.hidden = true;
    errorBox.querySelector('span')!.textContent = msg;
    errorBox.hidden = false;
  };

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  function renderStatus(tutor: Tutor) {
    const card = q('[data-status-card]');
    const title = q('[data-status-title]');
    const body = q('[data-status-body]');
    const actions = q('[data-status-actions]');

    const views: Record<string, { tone: string; title: string; body: string; actions: string }> = {
      pending: {
        tone: 'pending',
        title: 'Review ka intezaar',
        body: 'Aap ki profile hamare paas aa gayi hai. Hum 24–48 ghante mein check karke aap ko WhatsApp par batayenge. Us waqt tak profile search mein nazar nahi aayegi.',
        actions: `<a class="btn btn-outline btn-sm" href="${url('/tutor/profile')}">Profile dekhein</a>`,
      },
      approved: {
        tone: 'approved',
        title: 'Profile live hai',
        body: 'Aap ki profile search mein nazar aa rahi hai aur aap ke area ki leads aap tak aayengi.',
        actions: `<a class="btn btn-primary btn-sm" href="${url(`/teacher/${encodeURIComponent(tutor.slug)}`)}">Apni public profile dekhein</a>
                  <a class="btn btn-outline btn-sm" href="${url('/tutor/profile')}">Edit karein</a>`,
      },
      rejected: {
        tone: 'bad',
        title: 'Profile approve nahi hui',
        body: 'Kuch maloomat check nahi ho saki. Profile theek karke dobara bhejein, ya hum se rabta karein — hum bata denge kya kami hai.',
        actions: `<a class="btn btn-primary btn-sm" href="${url('/tutor/profile')}">Profile theek karein</a>`
          + `<a class="btn btn-outline btn-sm" href="${url('/contact')}">Rabta karein</a>`,
      },
      suspended: {
        tone: 'bad',
        title: 'Profile suspend hai',
        body: 'Ye profile filhal band hai. Wajah jaanne ke liye hum se rabta karein.',
        actions: `<a class="btn btn-primary btn-sm" href="${url('/contact')}">Rabta karein</a>`,
      },
    };

    const v = views[tutor.status] ?? views.pending;
    card.dataset.tone = v.tone;
    title.textContent = v.title;
    body.textContent = v.body;
    actions.innerHTML = v.actions;
  }

  function renderChecks(tutor: Tutor) {
    const rows: [boolean, string, string][] = [
      [Boolean(tutor.badges?.phoneChecked), 'Phone verified', 'Hum ne aap ke number par rabta kiya'],
      [Boolean(tutor.badges?.idChecked), 'Identity checked', 'Shanakhti document dekha gaya (copy nahi rakhi gayi)'],
      [Boolean(tutor.badges?.qualChecked), 'Qualification checked', 'Degree ya certificate dekha gaya'],
    ];

    q('[data-checks]').innerHTML = rows
      .map(([done, label, note]) => `
        <li>
          <svg class="icon ${done ? 'yes' : 'no'}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${done ? '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'}
          </svg>
          <span><strong>${label}</strong><small>${done ? note : 'Abhi baqi hai'}</small></span>
        </li>`)
      .join('');
  }

  function renderLeads(leads: Awaited<ReturnType<typeof listMyLeads>>) {
    const box = q('[data-leads]');

    if (leads.length === 0) {
      box.innerHTML = `
        <div class="empty">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>
          </svg>
          <h3>Abhi koi nayi lead nahi</h3>
          <p>Jab aap ke area aur subjects ki koi request aayegi, wo yahan nazar aayegi.</p>
        </div>`;
      return;
    }

    box.innerHTML = `<div class="lead-list">${leads
      .slice(0, 3)
      .map((l) => `
        <div class="lead-mini">
          <div>
            <b>${esc(l.subject)} — ${esc(classLabel(l.classLevel))}</b>
            <span>${esc(l.area)} · Rs. ${Number(l.budgetMax).toLocaleString('en-PK')} tak</span>
          </div>
          <a class="btn btn-outline btn-sm" href="${url('/tutor/leads')}">Dekhein</a>
        </div>`)
      .join('')}</div>`;
  }

  getSession('tutor').then(async (session) => {
    if (!session) return;

    try {
      const tutor = await getMyTutorProfile(session.user.uid);

      if (!tutor) {
        loading.hidden = true;
        noProfile.hidden = false;
        return;
      }

      renderStatus(tutor);
      renderChecks(tutor);

      // Leads sirf approved profiles ko aati hain — pending par query na chalao,
      // read bekaar mein kharch hoti hai.
      renderLeads(tutor.status === 'approved' ? await listMyLeads(session.user.uid, 'new') : []);

      loading.hidden = true;
      content.hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
