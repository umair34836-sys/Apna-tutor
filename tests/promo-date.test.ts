// =============================================================================
// tests/promo-date.test.ts
//
// Ye tests ek ASLI bug ki wajah se likhe gaye hain, ehtiyatan nahi.
//
// Umair ne pehla ishtihaar banaya: "ApnaTutor shuru 14 September se". Us din
// 14 September hi thi — magar ad site par kahin nazar nahi aaya. Na homepage
// par, na kisi aur page par.
//
// Wajah: form tareekh ko 2026-09-14T00:00:00Z bana kar rakhta tha (UTC ki
// aadhi raat), aur page par moqabla LOCAL aadhi raat se hota tha. Pakistan
// (UTC+5) mein 14 September ki local aadhi raat 13 September 19:00Z banti
// hai — jo 14 September 00:00Z se PEHLE hai. Nateeja: "abhi waqt nahi aaya",
// aur ad apne hi pehle din chhup gaya.
//
// UTC mein test karne par ye kabhi nazar nahi aata tha — isi liye neeche har
// ahem test Karachi ke waqt par chalta hai.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { isLiveOn, todayLocal } from '../src/lib/promo-date';

/** Karachi (UTC+5) mein us waqt ka Date jo UTC par `iso` hai. */
const at = (iso: string) => new Date(iso);

describe('todayLocal()', () => {
  it('banday ke apne din ki tareekh deta hai, UTC ki nahi', () => {
    // Karachi mein 15 Sept raat 2 baje = UTC par 14 Sept 21:00.
    // Banday ke liye din 15 hai, chahe UTC 14 par khara ho.
    const d = at('2026-09-14T21:00:00Z');
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayLocal(d)).toBe(local);
  });

  it('hamesha YYYY-MM-DD ki shakal mein, ek hindsa bhi kam nahi', () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('isLiveOn()', () => {
  it('❗ apni SHURU ki tareekh par ad chalta hai (asli bug)', () => {
    // Purana data poore ISO timestamp ki shakal mein hai — wahi jo bug laya tha.
    expect(isLiveOn('2026-09-14T00:00:00.000Z', null, '2026-09-14')).toBe(true);
    // Aur nayi shakal mein bhi.
    expect(isLiveOn('2026-09-14', null, '2026-09-14')).toBe(true);
  });

  it('❗ apni AAKHRI tareekh par bhi chalta hai — poora din ginta hai', () => {
    // "20 tareekh tak" ka matlab 20 ki raat tak. 20 ko band kar dena
    // admin se wada khilafi hai.
    expect(isLiveOn(null, '2026-09-20T00:00:00.000Z', '2026-09-20')).toBe(true);
    expect(isLiveOn(null, '2026-09-20', '2026-09-20')).toBe(true);
  });

  it('shuru se pehle nahi chalta', () => {
    expect(isLiveOn('2026-09-14', null, '2026-09-13')).toBe(false);
    expect(isLiveOn('2026-09-14', null, '2026-08-31')).toBe(false);
  });

  it('aakhri tareekh guzarne ke baad nahi chalta', () => {
    expect(isLiveOn(null, '2026-09-20', '2026-09-21')).toBe(false);
  });

  it('daire ke andar chalta hai, bahar nahi', () => {
    expect(isLiveOn('2026-09-14', '2026-09-20', '2026-09-17')).toBe(true);
    expect(isLiveOn('2026-09-14', '2026-09-20', '2026-09-13')).toBe(false);
    expect(isLiveOn('2026-09-14', '2026-09-20', '2026-09-21')).toBe(false);
  });

  it('koi tareekh na ho to hamesha chalta hai', () => {
    expect(isLiveOn(null, null, '2026-09-14')).toBe(true);
    expect(isLiveOn(undefined, undefined, '2026-01-01')).toBe(true);
  });

  it('❗ har timezone mein ek jaisa jawab — yahi poori file ki wajah hai', () => {
    // Lakeeron ka moqabla timezone se mutasir nahi hota. Agar kabhi koi
    // wapis Date par le jaye to ye test foran toot jayega.
    for (const today of ['2026-09-13', '2026-09-14', '2026-09-15']) {
      expect(isLiveOn('2026-09-14T00:00:00.000Z', null, today)).toBe(today >= '2026-09-14');
    }
  });

  it('saal badalne par bhi theek rehta hai', () => {
    expect(isLiveOn('2026-12-31', '2027-01-02', '2027-01-01')).toBe(true);
    expect(isLiveOn('2026-12-31', '2027-01-02', '2026-12-30')).toBe(false);
  });
});
