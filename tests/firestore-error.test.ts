// =============================================================================
// tests/firestore-error.test.ts
//
// `firestoreError()` ka kaam sirf tarjuma nahi — tashkhees hai. Setup ke doran
// sab se zyada waqt isi par zaya hota hai ke error bata hi nahi raha ke kya
// karna hai. Ye test wahi zabaan pin karta hai.
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { firestoreError } from '../src/lib/firebase';

const err = (code: string, message = '') => Object.assign(new Error(message), { code });

describe('firestoreError()', () => {
  it('index na hone par index ka naam leta hai, "kuch masla hua" nahi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const msg = firestoreError(err('failed-precondition', 'The query requires an index.'));
    expect(msg).toMatch(/index/i);
    expect(msg).not.toMatch(/^Kuch masla hua/);
  });

  it('index banane ka link console par chhapta hai', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const link = 'https://console.firebase.google.com/project/apna-tutor-33bf3/firestore/indexes?create_composite=Abc123';
    firestoreError(err('failed-precondition', `The query requires an index. You can create it here: ${link}`));
    expect(spy.mock.calls[0]?.[0]).toContain(link);
  });

  it('anjaan error ke saath uska code bhi deta hai — warna report karna mumkin nahi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(firestoreError(err('internal'))).toContain('(internal)');
  });

  it('jaane pehchane errors ka message waisa hi rehta hai', () => {
    expect(firestoreError(err('unauthenticated'))).toMatch(/dobara login/i);
    expect(firestoreError(err('resource-exhausted'))).toMatch(/rush/i);
    expect(firestoreError(err('unavailable'))).toMatch(/internet/i);
  });
});
