// =============================================================================
// src/scripts/tutor-register.ts — 7-step tutor registration ka dimagh
//
// ★ Yahan ki har validation firestore.rules ki hadd se match karti hai. Agar
//   rules badlein to YAHAN BHI badalna hoga — warna user 7 step bharne ke baad
//   "permission denied" dekhega, jo sabse bura tajurba hai.
// =============================================================================

import { getSession } from '../lib/auth';
import { firestoreError } from '../lib/firebase';
import { createTutorProfile, getMyTutorProfile, makeSlug, setMyContact, setMyPhotoSubmission } from '../lib/queries';
import { uploadPhoto, validatePhoto } from '../lib/cloudinary';
import { track } from '../lib/analytics';

const DRAFT_KEY = 'apnatutor:tutor-draft:v1';
const LAST_STEP = 7;

interface Draft {
  step: number;
  name: string;
  gender: string;
  city: string;
  areas: string[];
  subjects: string[];
  classes: string[];
  boards: string[];
  modes: string[];
  qualification: string;
  experienceYears: string;
  bio: string;
  feeMin: string;
  feeMax: string;
  availability: string;
  phone: string;
  whatsapp: string;
  sameWa: boolean;
  photoUrl: string;
  photoPublicId: string;
}

const empty = (): Draft => ({
  step: 1, name: '', gender: '', city: '', areas: [], subjects: [], classes: [],
  boards: [], modes: [], qualification: '', experienceYears: '', bio: '',
  feeMin: '', feeMax: '', availability: '', phone: '', whatsapp: '', sameWa: true,
  photoUrl: '', photoPublicId: '',
});

const wizard = document.getElementById('wizard');

if (wizard) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = $<HTMLFormElement>('reg-form');
  const formArea = $('form-area');
  const cityAreas: Record<string, string[]> = JSON.parse(wizard.dataset.cityAreas || '{}');
  const contentReady = wizard.dataset.hasContent === '1';

  let draft = empty();
  let step = 1;

  // -------------------------------------------------------------------------
  // Draft — localStorage. 7-step form mein data khona sabse bari drop-off wajah.
  // -------------------------------------------------------------------------

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) draft = { ...empty(), ...JSON.parse(raw) };
    } catch {
      // Private browsing ya storage band — draft ke bagair chalao, fatal nahi.
    }
  }

  let noteTimer: number | undefined;
  function saveDraft() {
    draft.step = step;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      const note = $('draft-note');
      note.hidden = false;
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(() => { note.hidden = true; }, 1600);
    } catch { /* storage band — khamoshi se aage barho */ }
  }

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  // -------------------------------------------------------------------------
  // Form ↔ draft
  // -------------------------------------------------------------------------

  const checkedValues = (name: string) =>
    Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((i) => i.value);

  const setChecked = (name: string, values: string[]) =>
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((i) => {
      i.checked = values.includes(i.value);
    });

  function readForm() {
    draft.name = $<HTMLInputElement>('name').value.trim();
    draft.gender = (form.querySelector<HTMLInputElement>('input[name="gender"]:checked')?.value) ?? '';
    draft.city = $<HTMLSelectElement>('city').value;
    draft.areas = checkedValues('areas');
    draft.subjects = checkedValues('subjects');
    draft.classes = checkedValues('classes');
    draft.boards = checkedValues('boards');
    draft.modes = checkedValues('modes');
    draft.qualification = $<HTMLInputElement>('qualification').value.trim();
    draft.experienceYears = $<HTMLInputElement>('experienceYears').value;
    draft.bio = $<HTMLTextAreaElement>('bio').value;
    draft.feeMin = $<HTMLInputElement>('feeMin').value;
    draft.feeMax = $<HTMLInputElement>('feeMax').value;
    draft.availability = $<HTMLInputElement>('availability').value.trim();
    draft.phone = $<HTMLInputElement>('phone').value.replace(/\D/g, '');
    draft.whatsapp = $<HTMLInputElement>('whatsapp').value.replace(/\D/g, '');
    draft.sameWa = $<HTMLInputElement>('same-wa').checked;
  }

  function writeForm() {
    $<HTMLInputElement>('name').value = draft.name;
    if (draft.gender) {
      const el = form.querySelector<HTMLInputElement>(`input[name="gender"][value="${draft.gender}"]`);
      if (el) el.checked = true;
    }
    $<HTMLSelectElement>('city').value = draft.city;
    renderAreas();
    setChecked('areas', draft.areas);
    setChecked('subjects', draft.subjects);
    setChecked('classes', draft.classes);
    setChecked('boards', draft.boards);
    setChecked('modes', draft.modes);
    $<HTMLInputElement>('qualification').value = draft.qualification;
    $<HTMLInputElement>('experienceYears').value = draft.experienceYears;
    $<HTMLTextAreaElement>('bio').value = draft.bio;
    $<HTMLInputElement>('feeMin').value = draft.feeMin;
    $<HTMLInputElement>('feeMax').value = draft.feeMax;
    $<HTMLInputElement>('availability').value = draft.availability;
    $<HTMLInputElement>('phone').value = draft.phone;
    $<HTMLInputElement>('whatsapp').value = draft.whatsapp;
    $<HTMLInputElement>('same-wa').checked = draft.sameWa;
    $('wa-field').hidden = draft.sameWa;
    updateBioCount();
    if (draft.photoUrl) showPhoto(draft.photoUrl);
  }

  /** Areas sirf us sheher ke jo select hua hai. */
  function renderAreas() {
    const box = $('areas-box');
    const city = $<HTMLSelectElement>('city').value;
    const areas = cityAreas[city] ?? [];

    if (!city) { box.innerHTML = '<p class="hint">Pehle sheher select karein.</p>'; return; }
    if (areas.length === 0) { box.innerHTML = '<p class="hint">Is sheher ke areas abhi set nahi hue.</p>'; return; }

    box.innerHTML = areas
      .map((a) => {
        const safe = a.replace(/"/g, '&quot;');
        return `<label class="pick"><input type="checkbox" name="areas" value="${safe}"><span>${a}</span></label>`;
      })
      .join('');

    setChecked('areas', draft.areas.filter((a) => areas.includes(a)));
    capAreas();
  }

  /** Rules: areas 1–6. 6 ho jayein to baqi disable — error se pehle rokna behtar. */
  function capAreas() {
    const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="areas"]'));
    const count = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => { b.disabled = !b.checked && count >= 6; });
  }

  /** Rules: subjects 1–8. */
  function capSubjects() {
    const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="subjects"]'));
    const count = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => { b.disabled = !b.checked && count >= 8; });
  }

  const updateBioCount = () => { $('bio-count').textContent = String($<HTMLTextAreaElement>('bio').value.length); };

  // -------------------------------------------------------------------------
  // Validation — hadden rules se match karti hain
  // -------------------------------------------------------------------------

  function setErr(id: string, msg: string | null) {
    const err = $(`e-${id}`);
    const field = document.getElementById(id)?.closest('.field') ?? err.closest('.pickers');
    err.classList.toggle('show', Boolean(msg));
    if (msg) err.querySelector('span')!.textContent = msg;
    field?.classList.toggle('invalid', Boolean(msg));
    const input = document.getElementById(id);
    if (input) {
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `e-${id}`);
      } else {
        input.removeAttribute('aria-invalid');
      }
    }
  }

  const PHONE_RE = /^3\d{9}$/; // +92 ke baad: 3 se shuru, kul 10 digits

  function validateStep(n: number): boolean {
    readForm();
    const bad: string[] = [];
    const check = (id: string, msg: string | null) => {
      setErr(id, msg);
      if (msg) bad.push(id);
    };

    if (n === 1) {
      check('name', draft.name.length < 3 ? 'Naam kam az kam 3 characters ka hona chahiye' : null);
      check('gender', !draft.gender ? 'Gender select karna zaroori hai' : null);
      check('city', !draft.city ? 'Sheher select karna zaroori hai' : null);
      check('areas',
        draft.areas.length === 0 ? 'Kam az kam ek area select karein'
        : draft.areas.length > 6 ? 'Zyada se zyada 6 areas' : null);
    }

    if (n === 2) {
      check('subjects',
        draft.subjects.length === 0 ? 'Kam az kam ek subject select karein'
        : draft.subjects.length > 8 ? 'Zyada se zyada 8 subjects' : null);
      check('classes', draft.classes.length === 0 ? 'Kam az kam ek class select karein' : null);
      check('boards', draft.boards.length === 0 ? 'Kam az kam ek board select karein' : null);
      check('modes', draft.modes.length === 0 ? 'Kam az kam ek teaching mode select karein' : null);
    }

    if (n === 3) {
      check('qualification', !draft.qualification ? 'Qualification likhna zaroori hai' : null);
      const years = Number(draft.experienceYears);
      check('experienceYears',
        draft.experienceYears === '' ? 'Tajurba likhna zaroori hai'
        : !Number.isInteger(years) || years < 0 || years > 50 ? 'Tajurba 0 se 50 saal ke darmiyan hona chahiye' : null);
      check('bio', draft.bio.length > 600 ? '600 characters se zyada nahi' : null);
    }

    if (n === 4) {
      const min = Number(draft.feeMin);
      const max = Number(draft.feeMax);
      check('feeMin',
        draft.feeMin === '' ? 'Fee likhna zaroori hai'
        : !Number.isInteger(min) || min < 500 ? 'Kam az kam Rs. 500' : null);
      check('feeMax',
        draft.feeMax === '' ? 'Fee likhna zaroori hai'
        : !Number.isInteger(max) || max > 200000 ? 'Zyada se zyada Rs. 200,000'
        : max < min ? 'Ye kam az kam fee se kam nahi ho sakti' : null);
      check('availability', !draft.availability ? 'Availability likhna zaroori hai' : null);
    }

    if (n === 5) {
      check('phone', !PHONE_RE.test(draft.phone) ? '10 digits, 3 se shuru — misal: 3001234567' : null);
      check('whatsapp',
        !draft.sameWa && !PHONE_RE.test(draft.whatsapp) ? '10 digits, 3 se shuru — misal: 3001234567' : null);
    }

    if (bad.length > 0) {
      document.getElementById(bad[0])?.focus();
      $(`e-${bad[0]}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------------

  function showStep(n: number) {
    step = Math.min(Math.max(n, 1), LAST_STEP);

    form.querySelectorAll<HTMLElement>('.step').forEach((el) => {
      el.hidden = Number(el.dataset.step) !== step;
    });

    document.querySelectorAll<HTMLElement>('[data-step-pip]').forEach((el) => {
      const pip = Number(el.dataset.stepPip);
      el.dataset.state = pip === step ? 'current' : pip < step ? 'done' : 'todo';
    });

    $('back').hidden = step === 1;
    $('next').hidden = step === LAST_STEP;
    $('submit').hidden = step !== LAST_STEP;
    $('step-count').textContent = `Step ${step} / ${LAST_STEP}`;

    if (step === LAST_STEP) renderReview();

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    saveDraft();
  }

  function renderReview() {
    readForm();
    const label = (v: string[]) => (v.length ? v.join(', ') : '—');
    const rows: [string, string][] = [
      ['Naam', draft.name || '—'],
      ['Gender', draft.gender || '—'],
      ['Sheher', draft.city || '—'],
      ['Areas', label(draft.areas)],
      ['Subjects', label(draft.subjects)],
      ['Classes', label(draft.classes)],
      ['Boards', label(draft.boards)],
      ['Teaching mode', label(draft.modes)],
      ['Qualification', draft.qualification || '—'],
      ['Tajurba', draft.experienceYears ? `${draft.experienceYears} saal` : '—'],
      ['Monthly fee', draft.feeMin && draft.feeMax ? `Rs. ${Number(draft.feeMin).toLocaleString('en-PK')} – ${Number(draft.feeMax).toLocaleString('en-PK')}` : '—'],
      ['Availability', draft.availability || '—'],
      ['Phone (private)', draft.phone ? `+92${draft.phone}` : '—'],
      ['Photo', draft.photoUrl ? 'Upload ho gayi' : 'Nahi di'],
    ];

    $('review-list').innerHTML = rows
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`)
      .join('');
  }

  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  // -------------------------------------------------------------------------
  // Photo
  // -------------------------------------------------------------------------

  function showPhoto(url: string) {
    $('photo-preview').innerHTML = `<img src="${url}" alt="Aap ki profile photo">`;
    $('photo-remove').hidden = false;
  }

  $<HTMLInputElement>('photo').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const errBox = $('photo-error');
    const okBox = $('photo-ok');
    errBox.hidden = true;
    okBox.hidden = true;

    const problem = validatePhoto(file);
    if (problem) {
      errBox.querySelector('span')!.textContent = problem;
      errBox.hidden = false;
      return;
    }

    // Foran preview — upload ke intezaar mein khali box na dikhe.
    showPhoto(URL.createObjectURL(file));

    try {
      const { url, publicId } = await uploadPhoto(file);
      draft.photoUrl = url;
      draft.photoPublicId = publicId;
      showPhoto(url);
      okBox.hidden = false;
      saveDraft();
    } catch (err) {
      errBox.querySelector('span')!.textContent =
        err instanceof Error ? err.message : 'Photo upload nahi ho saki.';
      errBox.hidden = false;
      $('photo-preview').innerHTML = '';
      draft.photoUrl = '';
      draft.photoPublicId = '';
    }
  });

  $('photo-remove').addEventListener('click', () => {
    draft.photoUrl = '';
    draft.photoPublicId = '';
    $('photo-preview').innerHTML = '';
    $('photo-remove').hidden = true;
    $('photo-ok').hidden = true;
    $<HTMLInputElement>('photo').value = '';
    saveDraft();
  });

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  $('next').addEventListener('click', () => { if (validateStep(step)) showStep(step + 1); });
  $('back').addEventListener('click', () => { readForm(); showStep(step - 1); });

  $<HTMLSelectElement>('city').addEventListener('change', () => { draft.areas = []; renderAreas(); saveDraft(); });
  $<HTMLTextAreaElement>('bio').addEventListener('input', updateBioCount);
  $<HTMLInputElement>('same-wa').addEventListener('change', (e) => {
    $('wa-field').hidden = (e.target as HTMLInputElement).checked;
  });

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'areas') capAreas();
    if (t.name === 'subjects') capSubjects();
    readForm();
    saveDraft();
  });
  form.addEventListener('input', () => { readForm(); saveDraft(); });

  // Sirf digits — "+92" pehle se prefix mein hai.
  ['phone', 'whatsapp'].forEach((id) =>
    $<HTMLInputElement>(id).addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      el.value = el.value.replace(/\D/g, '').slice(0, 10);
    })
  );

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errBox = $('submit-error');
    errBox.hidden = true;

    // Har step dobara check — user seedha aakhri step par aa sakta hai.
    for (let n = 1; n <= 6; n += 1) {
      if (!validateStep(n)) { showStep(n); return; }
    }

    const session = await getSession('tutor');
    if (!session) return;

    if (!session.user.emailVerified) {
      $('verify-gate').hidden = false;
      $('verify-gate').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const submit = $<HTMLButtonElement>('submit');
    submit.disabled = true;
    submit.textContent = 'Bhej rahe hain…';

    try {
      const uid = session.user.uid;

      await createTutorProfile(uid, {
        slug: makeSlug(draft.name, draft.city),
        name: draft.name,
        gender: draft.gender as 'male' | 'female',
        city: draft.city,
        areas: draft.areas,
        subjects: draft.subjects,
        classes: draft.classes,
        boards: draft.boards,
        modes: draft.modes as ('home' | 'online')[],
        feeMin: Number(draft.feeMin),
        feeMax: Number(draft.feeMax),
        qualification: draft.qualification,
        experienceYears: Number(draft.experienceYears),
        availability: draft.availability,
        bio: draft.bio,
      });

      // Contact alag document mein — public profile mein kabhi nahi.
      await setMyContact(uid, {
        phone: `+92${draft.phone}`,
        whatsapp: `+92${draft.sameWa ? draft.phone : draft.whatsapp}`,
        email: session.user.email ?? '',
      });

      if (draft.photoUrl && draft.photoPublicId) {
        await setMyPhotoSubmission(uid, { url: draft.photoUrl, publicId: draft.photoPublicId });
      }

      track('tutor_register_complete', { city: draft.city, subjects_count: draft.subjects.length });

      clearDraft();
      formArea.hidden = true;
      $('done').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      errBox.querySelector('span')!.textContent = firestoreError(err);
      errBox.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Profile bhejein';
    }
  });

  $('resend').addEventListener('click', async () => {
    const btn = $('resend');
    btn.textContent = 'Bhej rahe hain…';
    try {
      const { resendVerification } = await import('../lib/auth');
      await resendVerification();
      btn.textContent = 'Bhej diya — inbox dekhein';
    } catch {
      btn.textContent = 'Nahi bhej sake, dobara koshish karein';
    }
  });

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  getSession('tutor').then(async (session) => {
    if (!session) return;

    // Pehle se profile hai? To register nahi, edit karna chahiye.
    const existing = await getMyTutorProfile(session.user.uid);
    if (existing) { $('already').hidden = false; return; }

    if (!contentReady) return;   // cities/subjects abhi Firestore mein nahi

    loadDraft();

    // Naam pehle se maloom hai — user ko dobara na likhna pare.
    if (!draft.name && session.profile?.name) draft.name = session.profile.name;
    if (!draft.city && session.profile?.city) draft.city = session.profile.city;

    writeForm();
    capAreas();
    capSubjects();
    formArea.hidden = false;
    showStep(draft.step || 1);

    if (!session.user.emailVerified) $('verify-gate').hidden = false;
  });
}
