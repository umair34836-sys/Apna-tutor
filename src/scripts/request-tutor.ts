// src/scripts/request-tutor.ts
//
// ★ Fan-out parent ke browser se hota hai (server nahi hai). Rules do cheezein
//   rokti hain: parent doosre ki request ka fan-out nahi kar sakta, aur lead
//   mein parentPhone/parentAddress/parentEmail nahi ja sakta.

import { currentUser } from '../lib/firebase';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { getProfile } from '../lib/auth';
import { createRequest, fanOutLeads, type RequestInput } from '../lib/queries';
import { track } from '../lib/analytics';

const DRAFT_KEY = 'apnatutor:request-draft:v1';

const root = document.getElementById('request-page');

if (root && root.dataset.ready === '1') {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = $<HTMLFormElement>('request-form');
  const cityAreas: Record<string, string[]> = JSON.parse(root.dataset.cityAreas || '{}');

  const FIELDS = ['classLevel', 'subject', 'city', 'area', 'mode', 'genderPref', 'budgetMax', 'timing', 'notes', 'phone'];

  // -------------------------------------------------------------------------
  // Draft — login ke liye bhejne par form khali na mile
  // -------------------------------------------------------------------------

  function saveDraft() {
    try {
      const data: Record<string, string> = {};
      FIELDS.forEach((id) => { data[id] = ($(id) as HTMLInputElement).value; });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch { /* storage band — khamoshi se aage */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, string>;
      if (data.city) { ($('city') as HTMLSelectElement).value = data.city; renderAreas(); }
      FIELDS.forEach((id) => {
        if (data[id] !== undefined && id !== 'city') ($(id) as HTMLInputElement).value = data[id];
      });
    } catch { /* ignore */ }
  }

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  // URL se prefill (homepage ke request tab se aane par)
  function prefillFromUrl() {
    const p = new URLSearchParams(window.location.search);
    (['notes', 'mode', 'genderPref', 'subject', 'city'] as const).forEach((key) => {
      const v = p.get(key);
      if (!v) return;
      const el = $(key) as HTMLInputElement | HTMLSelectElement;
      if (el) el.value = v;
    });
    if (p.get('city')) renderAreas();
  }

  function renderAreas() {
    const city = ($('city') as HTMLSelectElement).value;
    const select = $('area') as HTMLSelectElement;
    const areas = cityAreas[city] ?? [];

    select.disabled = areas.length === 0;
    select.innerHTML = areas.length
      ? `<option value="">Select karein</option>${areas.map((a) => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`).join('')}`
      : '<option value="">Pehle sheher select karein</option>';
  }

  // -------------------------------------------------------------------------
  // Validation — hadden firestore.rules se match karti hain
  // -------------------------------------------------------------------------

  function setErr(id: string, msg: string | null) {
    const err = $(`e-${id}`);
    err.classList.toggle('show', Boolean(msg));
    if (msg) err.querySelector('span')!.textContent = msg;
    $(id).closest('.field')?.classList.toggle('invalid', Boolean(msg));
    if (msg) {
      $(id).setAttribute('aria-invalid', 'true');
      $(id).setAttribute('aria-describedby', `e-${id}`);
    } else {
      $(id).removeAttribute('aria-invalid');
    }
  }

  const PHONE_RE = /^3\d{9}$/;

  function validate(): boolean {
    const bad: string[] = [];
    const check = (id: string, msg: string | null) => { setErr(id, msg); if (msg) bad.push(id); };

    const val = (id: string) => ($(id) as HTMLInputElement).value.trim();
    const budget = Number(val('budgetMax'));

    check('classLevel', !val('classLevel') ? 'Class select karein' : null);
    check('subject', !val('subject') ? 'Subject select karein' : null);
    check('city', !val('city') ? 'Sheher select karein' : null);
    check('area', !val('area') ? 'Area select karein' : null);
    check('budgetMax',
      !val('budgetMax') ? 'Budget likhein'
      : !Number.isInteger(budget) || budget <= 0 ? 'Budget theek nahi lag raha' : null);
    check('timing', !val('timing') ? 'Waqt likhein' : null);
    check('notes', val('notes').length > 1000 ? '1000 characters se zyada nahi' : null);
    check('phone', !PHONE_RE.test(val('phone').replace(/\D/g, '')) ? '10 digits, 3 se shuru — misal: 3001234567' : null);

    if (bad.length) {
      $(bad[0]).focus();
      $(`e-${bad[0]}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  $('city').addEventListener('change', () => { renderAreas(); saveDraft(); });
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  $<HTMLInputElement>('phone').addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    el.value = el.value.replace(/\D/g, '').slice(0, 10);
  });

  FIELDS.forEach((id) =>
    $(id).addEventListener('input', () => {
      if (($(id) as HTMLInputElement).value) setErr(id, null);
    })
  );

  // Form khulte hi ek baar — ye batata hai log form kholte hain magar bharte nahi.
  track('request_start', { entry_point: 'request_page' });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errBox = $('submit-error');
    errBox.hidden = true;
    $('login-note').hidden = true;

    if (!validate()) return;

    const val = (id: string) => ($(id) as HTMLInputElement).value.trim();

    const input: RequestInput = {
      parentPhone: `+92${val('phone').replace(/\D/g, '')}`,
      classLevel: val('classLevel'),
      subject: val('subject'),
      city: val('city'),
      area: val('area'),
      mode: val('mode') as RequestInput['mode'],
      genderPref: val('genderPref') as RequestInput['genderPref'],
      budgetMax: Number(val('budgetMax')),
      timing: val('timing'),
      notes: val('notes'),
    };

    const user = await currentUser();
    if (!user) {
      // Draft mehfooz hai — login ke baad seedha yahin wapas.
      saveDraft();
      $('login-note').hidden = false;
      const next = encodeURIComponent(url('/request-tutor'));
      window.location.href = url(`/login?next=${next}`);
      return;
    }

    const submit = $<HTMLButtonElement>('submit');
    submit.disabled = true;
    submit.textContent = 'Bhej rahe hain…';

    try {
      const requestId = await createRequest(user.uid, input);

      // Fan-out fail ho jaye to bhi request mehfooz hai — admin manually
      // match kar sakta hai. Isliye ye alag try mein hai.
      let reached = 0;
      try {
        reached = await fanOutLeads(user.uid, requestId, input);
      } catch (err) {
        console.error('[fan-out]', err);
      }

      track('request_submit', {
        city: input.city,
        subject: input.subject,
        class_level: input.classLevel,
        budget_max: input.budgetMax,
        mode: input.mode,
      });

      if (reached === 0) {
        track('zero_results', { city: input.city, subject: input.subject, class_level: input.classLevel });
      }

      clearDraft();

      $('done-body').textContent =
        reached > 0
          ? `Aap ki request ${reached} matching ${reached === 1 ? 'tutor' : 'tutors'} tak pohanch gayi hai.`
          : 'Abhi is area aur subject mein koi matching tutor nahi mila. Aap ki request hamare paas mehfooz hai — jaise hi koi tutor aayega, hum aap ko bata denge.';

      form.hidden = true;
      $('done').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      errBox.querySelector('span')!.textContent = firestoreError(err);
      errBox.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Request bhejein';
    }
  });

  // ---- Boot ----
  loadDraft();
  prefillFromUrl();

  // Naam maloom ho to kuch na kuch pehle se bhar dein.
  currentUser().then(async (user) => {
    if (!user) return;
    const profile = await getProfile(user.uid);
    const citySelect = $('city') as HTMLSelectElement;
    if (profile?.city && !citySelect.value) {
      citySelect.value = profile.city;
      renderAreas();
    }
  });
}
