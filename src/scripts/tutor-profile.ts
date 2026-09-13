// src/scripts/tutor-profile.ts — profile edit
//
// ★ Update mein sirf wo fields bhejte hain jo tutor badal sakta hai. `status`,
//   `badges`, `ratingAvg`, `ratingCount`, `featuredUntil`, `photoUrl`, `slug`
//   aur `createdAt` bhejna hi nahi — rules unhe reject kar deti hain aur poora
//   update fail ho jata hai.

import { getSession } from '../lib/auth';
import { url } from '../lib/site';
import { firestoreError } from '../lib/firebase';
import { getMyContact, getMyPhotoSubmission, getMyTutorProfile, setMyContact, updateTutorProfile } from '../lib/queries';
import { statusLabel } from '../lib/queries';
import { isFeatured, isFullyVerified, type Mode, type Tutor } from '../lib/types';

const root = document.getElementById('profile-page');

if (root) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const form = $<HTMLFormElement>('edit-form');
  const loading = q('[data-loading]');
  const errorBox = q('[data-error]');
  const cityAreas: Record<string, string[]> = JSON.parse(root.dataset.cityAreas || '{}');

  let tutor: Tutor | null = null;
  let uid = '';
  let email = '';

  const PHONE_RE = /^3\d{9}$/;

  const esc = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const fail = (msg: string) => {
    loading.hidden = true;
    errorBox.querySelector('span')!.textContent = msg;
    errorBox.hidden = false;
  };

  const checkedValues = (name: string) =>
    Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((i) => i.value);

  const setChecked = (name: string, values: string[]) =>
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((i) => {
      i.checked = values.includes(i.value);
    });

  function renderAreas(selected: string[]) {
    const city = $<HTMLSelectElement>('city').value;
    const areas = cityAreas[city] ?? [];
    const box = $('areas-box');

    box.innerHTML = areas.length
      ? areas.map((a) => `<label class="pick"><input type="checkbox" name="areas" value="${esc(a)}"><span>${esc(a)}</span></label>`).join('')
      : '<p class="hint">Is ilaqe ke mohallay abhi set nahi hue.</p>';

    setChecked('areas', selected.filter((a) => areas.includes(a)));
    capAreas();
  }

  function capAreas() {
    const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="areas"]'));
    const count = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => { b.disabled = !b.checked && count >= 6; });
  }

  function capSubjects() {
    const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="subjects"]'));
    const count = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => { b.disabled = !b.checked && count >= 8; });
  }

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

  /** Read-only trust fields — har ek ke saath wajah. */
  function renderLocked(t: Tutor, photoPending: boolean) {
    q('[data-f-status]').textContent = statusLabel[t.status] ?? t.status;

    q('[data-f-rating]').textContent =
      t.ratingCount > 0
        ? `${t.ratingAvg.toFixed(1)} (${t.ratingCount} reviews)`
        : 'Abhi koi review nahi';

    const badgeBits = [
      t.badges?.phoneChecked ? 'Phone' : null,
      t.badges?.idChecked ? 'Identity' : null,
      t.badges?.qualChecked ? 'Qualification' : null,
    ].filter(Boolean);

    q('[data-f-badges]').textContent = isFullyVerified(t)
      ? 'ApnaTutor Verified (teeno checks)'
      : badgeBits.length
        ? `${badgeBits.join(', ')} checked`
        : 'Abhi koi check nahi hua';

    q('[data-f-photo]').textContent = t.photoUrl
      ? 'Live hai'
      : photoPending
        ? 'Upload ho gayi — approve hone ka intezaar'
        : 'Koi photo nahi';

    q('[data-f-slug]').innerHTML = t.status === 'approved'
      ? `<a href="${url(`/teacher/${encodeURIComponent(t.slug)}`)}">/teacher/${esc(t.slug)}</a>`
      : `${esc(url(`/teacher/${t.slug}`))} <small>(approve hone par live)</small>`;

    q('[data-f-featured]').textContent = isFeatured(t) ? 'Chal raha hai' : 'Nahi';
  }

  function validate(): boolean {
    const bad: string[] = [];
    const check = (id: string, msg: string | null) => { setErr(id, msg); if (msg) bad.push(id); };

    const name = $<HTMLInputElement>('name').value.trim();
    const areas = checkedValues('areas');
    const subjects = checkedValues('subjects');
    const min = Number($<HTMLInputElement>('feeMin').value);
    const max = Number($<HTMLInputElement>('feeMax').value);
    const years = Number($<HTMLInputElement>('experienceYears').value);
    const phone = $<HTMLInputElement>('phone').value.replace(/\D/g, '');
    const whatsapp = $<HTMLInputElement>('whatsapp').value.replace(/\D/g, '');

    check('name', name.length < 3 ? 'Naam kam az kam 3 characters ka hona chahiye' : null);
    check('city', !$<HTMLSelectElement>('city').value ? 'Ilaqa select karein' : null);
    check('areas', areas.length === 0 ? 'Kam az kam ek area' : areas.length > 6 ? 'Zyada se zyada 6 areas' : null);
    check('subjects', subjects.length === 0 ? 'Kam az kam ek subject' : subjects.length > 8 ? 'Zyada se zyada 8 subjects' : null);
    check('classes', checkedValues('classes').length === 0 ? 'Kam az kam ek class' : null);
    check('boards', checkedValues('boards').length === 0 ? 'Kam az kam ek board' : null);
    check('modes', checkedValues('modes').length === 0 ? 'Kam az kam ek teaching mode' : null);
    check('qualification', !$<HTMLInputElement>('qualification').value.trim() ? 'Qualification likhein' : null);
    check('experienceYears', !Number.isInteger(years) || years < 0 || years > 50 ? '0 se 50 saal ke darmiyan' : null);
    check('bio', $<HTMLTextAreaElement>('bio').value.length > 600 ? '600 characters se zyada nahi' : null);
    check('feeMin', !Number.isInteger(min) || min < 500 ? 'Kam az kam Rs. 500' : null);
    check('feeMax', !Number.isInteger(max) || max > 200000 ? 'Zyada se zyada Rs. 200,000' : max < min ? 'Kam az kam fee se kam nahi' : null);
    check('availability', !$<HTMLInputElement>('availability').value.trim() ? 'Availability likhein' : null);
    check('phone', !PHONE_RE.test(phone) ? '10 digits, 3 se shuru' : null);
    check('whatsapp', !PHONE_RE.test(whatsapp) ? '10 digits, 3 se shuru' : null);

    if (bad.length) {
      document.getElementById(bad[0])?.focus();
      $(`e-${bad[0]}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // ---- Events ----
  $<HTMLSelectElement>('city').addEventListener('change', () => renderAreas([]));
  $<HTMLTextAreaElement>('bio').addEventListener('input', () => {
    $('bio-count').textContent = String($<HTMLTextAreaElement>('bio').value.length);
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'areas') capAreas();
    if (t.name === 'subjects') capSubjects();
  });
  ['phone', 'whatsapp'].forEach((id) =>
    $<HTMLInputElement>(id).addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      el.value = el.value.replace(/\D/g, '').slice(0, 10);
    })
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saved = q('[data-saved]');
    const saveError = q('[data-save-error]');
    saved.hidden = true;
    saveError.hidden = true;

    if (!validate()) return;

    const btn = $<HTMLButtonElement>('save');
    btn.disabled = true;
    btn.textContent = 'Save ho raha hai…';

    try {
      await updateTutorProfile(uid, {
        name: $<HTMLInputElement>('name').value.trim(),
        city: $<HTMLSelectElement>('city').value,
        areas: checkedValues('areas'),
        subjects: checkedValues('subjects'),
        classes: checkedValues('classes'),
        boards: checkedValues('boards'),
        modes: checkedValues('modes') as Mode[],
        qualification: $<HTMLInputElement>('qualification').value.trim(),
        experienceYears: Number($<HTMLInputElement>('experienceYears').value),
        bio: $<HTMLTextAreaElement>('bio').value,
        feeMin: Number($<HTMLInputElement>('feeMin').value),
        feeMax: Number($<HTMLInputElement>('feeMax').value),
        availability: $<HTMLInputElement>('availability').value.trim(),
      });

      // Rules: contact doc mein sirf phone/whatsapp/email — aur kuch nahi.
      await setMyContact(uid, {
        phone: `+92${$<HTMLInputElement>('phone').value.replace(/\D/g, '')}`,
        whatsapp: `+92${$<HTMLInputElement>('whatsapp').value.replace(/\D/g, '')}`,
        email,
      });

      saved.hidden = false;
      window.setTimeout(() => { saved.hidden = true; }, 4000);
    } catch (err) {
      saveError.querySelector('span')!.textContent = firestoreError(err);
      saveError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Tabdeeli save karein';
    }
  });

  // ---- Boot ----
  getSession('tutor').then(async (session) => {
    if (!session) return;
    uid = session.user.uid;
    email = session.user.email ?? '';

    try {
      tutor = await getMyTutorProfile(uid);

      if (!tutor) {
        loading.hidden = true;
        q('[data-no-profile]').hidden = false;
        return;
      }

      const [contact, photo] = await Promise.all([getMyContact(uid), getMyPhotoSubmission(uid)]);

      renderLocked(tutor, Boolean(photo));

      $<HTMLInputElement>('name').value = tutor.name;
      $<HTMLSelectElement>('city').value = tutor.city;
      renderAreas(tutor.areas ?? []);
      setChecked('subjects', tutor.subjects ?? []);
      setChecked('classes', tutor.classes ?? []);
      setChecked('boards', tutor.boards ?? []);
      setChecked('modes', tutor.modes ?? []);
      $<HTMLInputElement>('qualification').value = tutor.qualification ?? '';
      $<HTMLInputElement>('experienceYears').value = String(tutor.experienceYears ?? '');
      $<HTMLTextAreaElement>('bio').value = tutor.bio ?? '';
      $('bio-count').textContent = String((tutor.bio ?? '').length);
      $<HTMLInputElement>('feeMin').value = String(tutor.feeMin ?? '');
      $<HTMLInputElement>('feeMax').value = String(tutor.feeMax ?? '');
      $<HTMLInputElement>('availability').value = tutor.availability ?? '';
      $<HTMLInputElement>('phone').value = (contact?.phone ?? '').replace(/^\+92/, '');
      $<HTMLInputElement>('whatsapp').value = (contact?.whatsapp ?? '').replace(/^\+92/, '');

      capSubjects();

      loading.hidden = true;
      form.hidden = false;
    } catch (err) {
      fail(firestoreError(err));
    }
  });
}
