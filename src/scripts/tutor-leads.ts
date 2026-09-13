import { getSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import { getMyTutorProfile, listMyLeads, respondToLead, type Lead } from '../lib/queries';
import { classLabel, modeLabel } from '../lib/taxonomy';
import { track } from '../lib/analytics';

const root = document.getElementById('leads');

if (root) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const loading = q('[data-loading]');
  const list = q('[data-list]');
  const errorBox = q('[data-error]');
  const filters = q('[data-filters]');

  let uid = '';
  let city = '';
  let active: Lead['status'] = 'new';

  const esc = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const fail = (msg: string) => {
    loading.hidden = true;
    errorBox.querySelector('span')!.textContent = msg;
    errorBox.hidden = false;
  };

  const when = (ts: Lead['createdAt']) => {
    if (!ts) return '';
    const d = ts.toDate();
    const days = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (days === 0) return 'Aaj';
    if (days === 1) return 'Kal';
    if (days < 7) return `${days} din pehle`;
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };

  const EMPTY: Record<Lead['status'], { title: string; body: string }> = {
    new: {
      title: 'Abhi koi nayi lead nahi',
      body: 'Jab aap ke area aur subjects ki koi request aayegi, wo yahan nazar aayegi. Profile mein zyada areas aur subjects add karne se zyada leads aati hain.',
    },
    interested: {
      title: 'Abhi tak kisi lead par interested nahi kiya',
      body: '"Nayi" tab mein jo requests hain, unmein se jo aap ke liye theek hon un par Interested karein.',
    },
    declined: {
      title: 'Koi declined lead nahi',
      body: 'Jo requests aap ne mana ki hongi wo yahan nazar aayengi.',
    },
  };

  function card(lead: Lead): string {
    const responded = lead.status !== 'new';
    return `
      <article class="lead" data-lead-id="${esc(lead.id)}">
        <header class="lead-head">
          <div>
            <h3>${esc(lead.subject)}</h3>
            <p class="lead-class">${esc(classLabel(lead.classLevel))}</p>
          </div>
          <span class="lead-when">${esc(when(lead.createdAt))}</span>
        </header>

        <dl class="lead-facts">
          <div><dt>Area</dt><dd>${esc(lead.area)}</dd></div>
          <div><dt>Mode</dt><dd>${esc(modeLabel(lead.mode).split(' (')[0])}</dd></div>
          <div><dt>Budget</dt><dd>Rs. ${Number(lead.budgetMax).toLocaleString('en-PK')} tak</dd></div>
          <div><dt>Timing</dt><dd>${esc(lead.timing || '—')}</dd></div>
        </dl>

        ${responded ? `
          <p class="state ${lead.status === 'interested' ? 'state-success' : 'state-info'} lead-state">
            ${lead.status === 'interested'
              ? 'Parent ko bata diya gaya hai. Agar unhe aap ki profile pasand aayi to wo aap se rabta karenge.'
              : 'Aap ne is request ko mana kar diya tha.'}
          </p>`
        : `
          <div class="lead-actions">
            <button type="button" class="btn btn-primary btn-sm" data-act="interested">I'm Interested</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="declined">Available nahi hoon</button>
          </div>
          <p class="state state-error lead-error" hidden><span></span></p>`}
      </article>`;
  }

  async function render() {
    loading.hidden = false;
    list.hidden = true;
    errorBox.hidden = true;

    try {
      const leads = await listMyLeads(uid, active);

      list.innerHTML = leads.length
        ? `<div class="lead-grid">${leads.map(card).join('')}</div>`
        : `<div class="empty">
             <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>
             </svg>
             <h3>${EMPTY[active].title}</h3>
             <p>${EMPTY[active].body}</p>
             <a class="btn btn-outline" href="/tutor/profile">Profile behtar karein</a>
           </div>`;

      loading.hidden = true;
      list.hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  }

  // ---- Filter tabs, poore keyboard support ke saath ----
  const tabs = Array.from(filters.querySelectorAll<HTMLButtonElement>('.filter'));

  function selectTab(tab: HTMLButtonElement) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    active = tab.dataset.filter as Lead['status'];
    render();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      let next: HTMLButtonElement | undefined;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next); next.focus(); }
    });
  });

  // ---- Lead par jawab ----
  list.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;

    const article = btn.closest<HTMLElement>('[data-lead-id]')!;
    const leadId = article.dataset.leadId!;
    const status = btn.dataset.act as 'interested' | 'declined';
    const errEl = article.querySelector<HTMLElement>('.lead-error')!;
    const buttons = article.querySelectorAll<HTMLButtonElement>('[data-act]');

    errEl.hidden = true;
    buttons.forEach((b) => { b.disabled = true; });
    btn.textContent = 'Bhej rahe hain…';

    try {
      await respondToLead(leadId, status);
      if (status === 'interested') {
        track('tutor_lead_interested', { city, subject: article.querySelector('h3')?.textContent ?? '' });
      }
      // Ab ye lead is filter mein nahi rehni chahiye.
      await render();
    } catch (err) {
      errEl.querySelector('span')!.textContent = firestoreError(err);
      errEl.hidden = false;
      buttons.forEach((b) => { b.disabled = false; });
      btn.textContent = status === 'interested' ? "I'm Interested" : 'Available nahi hoon';
    }
  });

  getSession('tutor').then(async (session) => {
    if (!session) return;
    uid = session.user.uid;

    try {
      const tutor = await getMyTutorProfile(uid);

      if (!tutor || tutor.status !== 'approved') {
        loading.hidden = true;
        q('[data-not-approved]').hidden = false;
        return;
      }

      city = tutor.city;
      filters.hidden = false;
      q('[data-filters-note]').hidden = false;
      await render();
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
