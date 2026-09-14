// =============================================================================
// tests/firestore-rules.test.ts
//
// firestore.rules is project ka BACKEND hai — Cloud Functions Spark plan par
// available nahi. Isliye ye tests optional nahi hain: agar inmein se ek bhi ❗
// wala fail ho jaye to poora trust system bekaar hai.
//
// Test list docs/04-DEPLOY.md §1 se. Har ❗ wale test ka naam mein ❗ likha hai.
//
// Chalane ka tareeqa:  npm run test:rules
// =============================================================================

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';

import {
  ADMIN_UID, PARENT2_UID, PARENT_UID, PENDING_TUTOR_UID, REQUEST_ID, TUTOR_UID,
  anonDb, db, giveConnection, newTutorDoc, seed, seedDoc, setupEnv, testEnv,
} from './helpers';

beforeAll(async () => { await setupEnv(); });
afterAll(async () => { await testEnv().cleanup(); });
beforeEach(async () => { await seed(); });

// =============================================================================
// tutors — public profile
// =============================================================================

describe('tutors/{id} — public profile', () => {
  it('logged-out banda approved tutor padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(anonDb(), `tutors/${TUTOR_UID}`)));
  });

  it('logged-out banda PENDING tutor read nahi kar sakta', async () => {
    await assertFails(getDoc(doc(anonDb(), `tutors/${PENDING_TUTOR_UID}`)));
  });

  it('tutor apni pending profile khud padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(db(PENDING_TUTOR_UID), `tutors/${PENDING_TUTOR_UID}`)));
  });

  it('admin pending tutor padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN_UID), `tutors/${PENDING_TUTOR_UID}`)));
  });

  it('naya tutor apni profile pending status ke saath bana sakta hai', async () => {
    const uid = 'brand-new-tutor';
    await assertSucceeds(
      setDoc(doc(db(uid), `tutors/${uid}`), { ...newTutorDoc(), createdAt: serverTimestamp() })
    );
  });

  it('tutor apni profile approved status ke saath nahi bana sakta ❗', async () => {
    const uid = 'sneaky-new-tutor';
    await assertFails(
      setDoc(doc(db(uid), `tutors/${uid}`), {
        ...newTutorDoc({ status: 'approved' }), createdAt: serverTimestamp(),
      })
    );
  });

  it('tutor apni profile badges true ke saath nahi bana sakta ❗', async () => {
    const uid = 'sneaky-badge-tutor';
    await assertFails(
      setDoc(doc(db(uid), `tutors/${uid}`), {
        ...newTutorDoc({ badges: { phoneChecked: true, idChecked: true, qualChecked: true } }),
        createdAt: serverTimestamp(),
      })
    );
  });

  it('tutor ke public doc mein phone number nahi ja sakta ❗', async () => {
    const uid = 'phone-leak-tutor';
    await assertFails(
      setDoc(doc(db(uid), `tutors/${uid}`), {
        ...newTutorDoc(), phone: '+923001234567', createdAt: serverTimestamp(),
      })
    );
  });

  it('doosra banda kisi aur ke naam par tutor profile nahi bana sakta', async () => {
    await assertFails(
      setDoc(doc(db(PARENT_UID), 'tutors/someone-else'), {
        ...newTutorDoc(), createdAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna bio aur fee edit kar sakta hai', async () => {
    await assertSucceeds(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        bio: 'Naya bio — 10 saal ka tajurba.', feeMin: 4000, feeMax: 8000,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna badges.idChecked true nahi kar sakta ❗', async () => {
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        badges: { phoneChecked: false, idChecked: true, qualChecked: false },
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('pending tutor khud ko approved nahi kar sakta ❗', async () => {
    // Ye asal escalation hai: pending profile wala banda khud ko live kar de.
    await assertFails(
      updateDoc(doc(db(PENDING_TUTOR_UID), `tutors/${PENDING_TUTOR_UID}`), {
        status: 'approved', updatedAt: serverTimestamp(),
      })
    );
  });

  it('approved tutor apna status badal nahi sakta ❗', async () => {
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        status: 'suspended', updatedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna featuredUntil set nahi kar sakta ❗', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        featuredUntil: future, updatedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna ratingAvg nahi badal sakta ❗', async () => {
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        ratingAvg: 5, ratingCount: 99, updatedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna photoUrl khud set nahi kar sakta (admin approve karta hai) ❗', async () => {
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        photoUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apna slug nahi badal sakta (SEO links toot jate)', async () => {
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`), {
        slug: 'naya-slug', updatedAt: serverTimestamp(),
      })
    );
  });

  it('admin badges set kar sakta hai', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), `tutors/${TUTOR_UID}`), {
        badges: { phoneChecked: true, idChecked: true, qualChecked: true },
        verifiedBy: ADMIN_UID, verifiedAt: serverTimestamp(),
      })
    );
  });

  it('admin tutor approve kar sakta hai', async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN_UID), `tutors/${PENDING_TUTOR_UID}`), {
        status: 'approved', reviewedAt: serverTimestamp(),
      })
    );
  });

  it('tutor apni profile delete nahi kar sakta (sirf admin)', async () => {
    await assertFails(deleteDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}`)));
  });
});

// =============================================================================
// tutors list — scraping cap
// =============================================================================

describe('tutors list — query cap', () => {
  it('approved tutors ki limit-30 query chalti hai', async () => {
    await assertSucceeds(
      getDocs(query(collection(anonDb(), 'tutors'), where('status', '==', 'approved'), limit(30)))
    );
  });

  it('100-doc limit wali query reject hoti hai (cap 30 hai)', async () => {
    await assertFails(
      getDocs(query(collection(anonDb(), 'tutors'), where('status', '==', 'approved'), limit(100)))
    );
  });

  it('bina limit wali query reject hoti hai', async () => {
    await assertFails(
      getDocs(query(collection(anonDb(), 'tutors'), where('status', '==', 'approved')))
    );
  });

  it('status filter ke bagair query reject hoti hai (pending leak nahi ho sakta)', async () => {
    await assertFails(getDocs(query(collection(anonDb(), 'tutors'), limit(30))));
  });
});

// =============================================================================
// tutors/{id}/private/contact — phone number ka darwaza
// =============================================================================

describe('tutors/{id}/private/contact — gated phone', () => {
  it('logged-out banda contact read nahi kar sakta', async () => {
    await assertFails(getDoc(doc(anonDb(), `tutors/${TUTOR_UID}/private/contact`)));
  });

  it('parent bina connections doc ke contact read nahi kar sakta ❗', async () => {
    await assertFails(getDoc(doc(db(PARENT_UID), `tutors/${TUTOR_UID}/private/contact`)));
  });

  it('connections doc banne ke baad parent contact read kar sakta hai', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertSucceeds(getDoc(doc(db(PARENT_UID), `tutors/${TUTOR_UID}/private/contact`)));
  });

  it('ek parent ka connection doosre parent ko access nahi deta ❗', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertFails(getDoc(doc(db(PARENT2_UID), `tutors/${TUTOR_UID}/private/contact`)));
  });

  it('tutor apna contact khud padh aur likh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/contact`)));
    await assertSucceeds(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/contact`), {
        phone: '+923111234567', whatsapp: '+923111234567', email: 'new@example.com',
      })
    );
  });

  it('ghalat format wala phone number reject hota hai', async () => {
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/contact`), {
        phone: '03001234567', whatsapp: '03001234567', email: 'x@example.com',
      })
    );
  });

  it('admin kisi bhi tutor ka contact padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN_UID), `tutors/${TUTOR_UID}/private/contact`)));
  });
});

// =============================================================================
// tutors/{id}/private/photoSubmission — tutor upload karta hai, admin approve
// =============================================================================

describe('tutors/{id}/private/photoSubmission', () => {
  // Photo Firestore mein base64 ke taur par jati hai — na Cloud Storage, na
  // koi bahar ki service. Client 600x600 tak simat kar bhejta hai.
  const jpeg = (chars: number) => 'data:image/jpeg;base64,' + 'A'.repeat(chars);
  const good = { dataUrl: jpeg(2000), thumbUrl: jpeg(400) };

  it('tutor apni photo submit kar sakta hai', async () => {
    await assertSucceeds(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/photoSubmission`), {
        ...good, submittedAt: serverTimestamp(),
      })
    );
  });

  it('bahar ka URL reject hota hai ❗', async () => {
    // Warna koi bhi link yahan aa sakta tha — kisi aur ki image ya phishing.
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/photoSubmission`), {
        dataUrl: 'https://evil.example.com/x.jpg', thumbUrl: jpeg(400),
        submittedAt: serverTimestamp(),
      })
    );
  });

  it('SVG data URI reject hota hai ❗', async () => {
    // SVG ke andar script ho sakti hai — isliye sirf JPEG.
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/photoSubmission`), {
        dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', thumbUrl: jpeg(400),
        submittedAt: serverTimestamp(),
      })
    );
  });

  it('hadd se bari photo reject hoti hai ❗', async () => {
    // 1 MiB document cap se pehle ye rule rok deta hai.
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/photoSubmission`), {
        dataUrl: jpeg(300_001), thumbUrl: jpeg(400), submittedAt: serverTimestamp(),
      })
    );
  });

  it('hadd se bara thumbnail reject hota hai', async () => {
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `tutors/${TUTOR_UID}/private/photoSubmission`), {
        dataUrl: jpeg(2000), thumbUrl: jpeg(30_001), submittedAt: serverTimestamp(),
      })
    );
  });

  it('doosra banda kisi aur ki photo submission nahi padh sakta', async () => {
    await seedDoc(`tutors/${TUTOR_UID}/private/photoSubmission`, { ...good, submittedAt: new Date() });
    await assertFails(getDoc(doc(db(PARENT_UID), `tutors/${TUTOR_UID}/private/photoSubmission`)));
  });

  it('admin photo submission padh sakta hai (approve karne ke liye)', async () => {
    await seedDoc(`tutors/${TUTOR_UID}/private/photoSubmission`, { ...good, submittedAt: new Date() });
    await assertSucceeds(getDoc(doc(db(ADMIN_UID), `tutors/${TUTOR_UID}/private/photoSubmission`)));
  });
});

// =============================================================================
// photos/{tutorUid} — approve ho chuki photo (public)
// =============================================================================

describe('photos/{tutorUid}', () => {
  const jpeg = (chars: number) => 'data:image/jpeg;base64,' + 'A'.repeat(chars);
  const photo = { dataUrl: jpeg(2000), thumbUrl: jpeg(400) };

  it('approve ho chuki photo duniya dekh sakti hai', async () => {
    await seedDoc(`photos/${TUTOR_UID}`, { ...photo, updatedAt: new Date() });
    await assertSucceeds(getDoc(doc(anonDb(), `photos/${TUTOR_UID}`)));
  });

  it('tutor apni photo KHUD live nahi kar sakta ❗', async () => {
    // Warna admin approval ka koi matlab hi na rehta — koi bhi kuch bhi apni
    // public profile par laga sakta tha.
    await assertFails(
      setDoc(doc(db(TUTOR_UID), `photos/${TUTOR_UID}`), { ...photo, updatedAt: serverTimestamp() })
    );
  });

  it('admin photo live kar sakta hai', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), `photos/${TUTOR_UID}`), { ...photo, updatedAt: serverTimestamp() })
    );
  });
});

// =============================================================================
// connections — contact unlock record
// =============================================================================

describe('connections/{parentUid}_{tutorUid}', () => {
  it('parent approved tutor ka connection bana sakta hai', async () => {
    await assertSucceeds(
      setDoc(doc(db(PARENT_UID), `connections/${PARENT_UID}_${TUTOR_UID}`), {
        parentUid: PARENT_UID, tutorUid: TUTOR_UID, source: 'search',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('parent doosre parent ke naam par connection nahi bana sakta ❗', async () => {
    await assertFails(
      setDoc(doc(db(PARENT_UID), `connections/${PARENT2_UID}_${TUTOR_UID}`), {
        parentUid: PARENT2_UID, tutorUid: TUTOR_UID, source: 'search',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('pending tutor ka connection nahi ban sakta', async () => {
    await assertFails(
      setDoc(doc(db(PARENT_UID), `connections/${PARENT_UID}_${PENDING_TUTOR_UID}`), {
        parentUid: PARENT_UID, tutorUid: PENDING_TUTOR_UID, source: 'search',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('connection banne ke baad badla nahi ja sakta', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertFails(
      updateDoc(doc(db(PARENT_UID), `connections/${PARENT_UID}_${TUTOR_UID}`), { source: 'lead' })
    );
  });
});

// =============================================================================
// requests — parent ki tuition request
// =============================================================================

describe('requests/{id}', () => {
  const validRequest = (parentUid: string) => ({
    parentUid,
    parentPhone: '+923009876543',
    classLevel: '10', subject: 'physics', city: 'risalpur', area: 'risalpur-cantt',
    mode: 'home', genderPref: 'any', budgetMax: 5000, timing: '5-7 PM', notes: 'Beta matric mein hai.',
    status: 'open', createdAt: serverTimestamp(),
  });

  it('parent apni request bana sakta hai', async () => {
    await assertSucceeds(
      addDoc(collection(db(PARENT_UID), 'requests'), validRequest(PARENT_UID))
    );
  });

  it('parent doosre parent ke naam par request nahi bana sakta', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'requests'), validRequest(PARENT2_UID))
    );
  });

  it('"tutor ke ghar" wala mode qabool hota hai', async () => {
    // Gaon mein bachay teacher ke ghar parhne jate hain — ye teesra mode
    // rules mein bhi hona chahiye, warna asli request reject ho jati.
    await assertSucceeds(
      addDoc(collection(db(PARENT_UID), 'requests'), {
        ...validRequest(PARENT_UID), mode: 'tutorhome',
      })
    );
  });

  it('bana hua mode reject hota hai', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'requests'), {
        ...validRequest(PARENT_UID), mode: 'academy',
      })
    );
  });

  it('ghalat phone format wali request reject hoti hai', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'requests'), {
        ...validRequest(PARENT_UID), parentPhone: '0300-1234567',
      })
    );
  });

  it('doosra parent kisi aur ki request nahi padh sakta ❗', async () => {
    await assertFails(getDoc(doc(db(PARENT2_UID), `requests/${REQUEST_ID}`)));
  });

  it('logged-out banda koi request nahi padh sakta', async () => {
    await assertFails(getDoc(doc(anonDb(), `requests/${REQUEST_ID}`)));
  });

  it('parent apni request padh sakta hai', async () => {
    await assertSucceeds(getDoc(doc(db(PARENT_UID), `requests/${REQUEST_ID}`)));
  });
});

// =============================================================================
// leads — fan-out parent ke browser se
// =============================================================================

describe('leads/{id}', () => {
  const validLead = (parentUid: string, requestId = REQUEST_ID) => ({
    requestId, parentUid, tutorUid: TUTOR_UID,
    classLevel: '9', subject: 'mathematics', area: 'risalpur-cantt',
    mode: 'home', budgetMax: 6000, timing: '4-6 PM',
    status: 'new', createdAt: serverTimestamp(),
  });

  it('parent apni request ka lead fan-out kar sakta hai', async () => {
    await assertSucceeds(addDoc(collection(db(PARENT_UID), 'leads'), validLead(PARENT_UID)));
  });

  // ---------------------------------------------------------------------
  // Parent apne interested tutors kaise parhta hai
  //
  // ★ Ye do test ek asli bug ki wajah se hain. Parent apni hi request khol
  //   kar "Aapko is kaam ki ijazat nahi hai" dekhta tha, aur tutor ke
  //   "Interested" karne ke baad bhi usay kuch nazar nahi aata tha.
  //
  //   Wajah: query sirf requestId + status par filter karti thi. Firestore ki
  //   list rules har document par alag nahi chaltin — wo POORI QUERY dekh kar
  //   faisla karti hain ke kya ye sirf wahi documents maang rahi hai jo rule
  //   ijazat deta hai. Rule `parentUid == uid()` kehta hai, is liye query mein
  //   bhi parentUid ka filter hona LAZMI hai — chahe requestId se natija wahi
  //   aata ho.
  // ---------------------------------------------------------------------

  it('parent apne leads parh sakta hai — jab query mein parentUid ho', async () => {
    await assertSucceeds(
      getDocs(query(
        collection(db(PARENT_UID), 'leads'),
        where('parentUid', '==', PARENT_UID),
        where('requestId', '==', REQUEST_ID),
        where('status', '==', 'interested'),
        limit(50)
      ))
    );
  });

  it('parentUid ke bagair wahi query reject hoti hai ❗', async () => {
    await assertFails(
      getDocs(query(
        collection(db(PARENT_UID), 'leads'),
        where('requestId', '==', REQUEST_ID),
        where('status', '==', 'interested'),
        limit(50)
      ))
    );
  });

  it('tutor apne leads tutorUid se parh sakta hai', async () => {
    await assertSucceeds(
      getDocs(query(
        collection(db(TUTOR_UID), 'leads'),
        where('tutorUid', '==', TUTOR_UID),
        orderBy('createdAt', 'desc'),
        limit(50)
      ))
    );
  });

  it('doosre parent ke leads nahi parhe ja sakte ❗', async () => {
    await assertFails(
      getDocs(query(
        collection(db(PARENT2_UID), 'leads'),
        where('parentUid', '==', PARENT_UID),
        limit(50)
      ))
    );
  });

  it('parent doosre parent ki request ka lead fan-out nahi kar sakta ❗', async () => {
    await assertFails(addDoc(collection(db(PARENT2_UID), 'leads'), validLead(PARENT2_UID)));
  });

  it('parentPhone wala lead create nahi ho sakta ❗', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'leads'), {
        ...validLead(PARENT_UID), parentPhone: '+923009876543',
      })
    );
  });

  it('parentAddress wala lead create nahi ho sakta ❗', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'leads'), {
        ...validLead(PARENT_UID), parentAddress: 'House 5, Street 2, Risalpur',
      })
    );
  });

  it('pending tutor ka lead nahi ban sakta', async () => {
    await assertFails(
      addDoc(collection(db(PARENT_UID), 'leads'), {
        ...validLead(PARENT_UID), tutorUid: PENDING_TUTOR_UID,
      })
    );
  });

  it('tutor lead ko interested mark kar sakta hai', async () => {
    await seedDoc('leads/lead-1', {
      ...validLead(PARENT_UID), createdAt: new Date(), respondedAt: null,
    });
    await assertSucceeds(
      updateDoc(doc(db(TUTOR_UID), 'leads/lead-1'), {
        status: 'interested', respondedAt: serverTimestamp(),
      })
    );
  });

  it('tutor lead ka subject field nahi badal sakta (sirf status)', async () => {
    await seedDoc('leads/lead-2', {
      ...validLead(PARENT_UID), createdAt: new Date(), respondedAt: null,
    });
    await assertFails(
      updateDoc(doc(db(TUTOR_UID), 'leads/lead-2'), {
        status: 'interested', subject: 'chemistry', respondedAt: serverTimestamp(),
      })
    );
  });

  it('doosra tutor kisi aur ka lead nahi padh sakta ❗', async () => {
    await seedDoc('leads/lead-3', {
      ...validLead(PARENT_UID), createdAt: new Date(), respondedAt: null,
    });
    await assertFails(getDoc(doc(db('random-tutor-uid'), 'leads/lead-3')));
  });
});

// =============================================================================
// reviews — fake reviews ke khilaf sabse mazboot defence
// =============================================================================

describe('reviews/{parentUid}_{tutorUid}', () => {
  const validReview = (parentUid: string, tutorUid = TUTOR_UID) => ({
    tutorUid, parentUid, parentName: 'Test Parent',
    rating: 5, text: 'Bohat acha parhate hain, beta ke marks behtar hue.',
    status: 'pending', createdAt: serverTimestamp(),
  });

  it('parent bina connections doc ke review create nahi kar sakta ❗', async () => {
    await assertFails(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), validReview(PARENT_UID))
    );
  });

  it('connection ke baad parent review likh sakta hai', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertSucceeds(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), validReview(PARENT_UID))
    );
  });

  it('review approved status ke saath create nahi ho sakta ❗', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertFails(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), {
        ...validReview(PARENT_UID), status: 'approved',
      })
    );
  });

  it('ek parent ek tutor ko doosra review nahi de sakta', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await seedDoc(`reviews/${PARENT_UID}_${TUTOR_UID}`, {
      ...validReview(PARENT_UID), createdAt: new Date(), status: 'approved',
    });
    // Composite ID hi ek record enforce karta hai — dobara likhna update hai,
    // aur update sirf admin kar sakta hai.
    await assertFails(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), validReview(PARENT_UID))
    );
  });

  it('parent apna approved review baad mein edit nahi kar sakta ❗', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await seedDoc(`reviews/${PARENT_UID}_${TUTOR_UID}`, {
      ...validReview(PARENT_UID), createdAt: new Date(), status: 'approved',
    });
    await assertFails(
      updateDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), { text: 'Bura tajurba raha.' })
    );
  });

  it('parent doosre parent ke naam par review nahi likh sakta', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertFails(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT2_UID}_${TUTOR_UID}`), validReview(PARENT2_UID))
    );
  });

  it('rating 1-5 se bahar reject hoti hai', async () => {
    await giveConnection(PARENT_UID, TUTOR_UID);
    await assertFails(
      setDoc(doc(db(PARENT_UID), `reviews/${PARENT_UID}_${TUTOR_UID}`), {
        ...validReview(PARENT_UID), rating: 6,
      })
    );
  });

  it('pending review public nahi hota', async () => {
    await seedDoc(`reviews/${PARENT2_UID}_${TUTOR_UID}`, {
      ...validReview(PARENT2_UID), createdAt: new Date(),
    });
    await assertFails(getDoc(doc(anonDb(), `reviews/${PARENT2_UID}_${TUTOR_UID}`)));
  });

  it('approved review public hai', async () => {
    await seedDoc(`reviews/${PARENT2_UID}_${TUTOR_UID}`, {
      ...validReview(PARENT2_UID), createdAt: new Date(), status: 'approved',
    });
    await assertSucceeds(getDoc(doc(anonDb(), `reviews/${PARENT2_UID}_${TUTOR_UID}`)));
  });

  it('approved reviews ki limit-30 query chalti hai', async () => {
    await assertSucceeds(
      getDocs(query(
        collection(anonDb(), 'reviews'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc'),
        limit(30)
      ))
    );
  });
});

// =============================================================================
// reports — write-only for users
// =============================================================================

describe('reports/{id}', () => {
  const validReport = (uid: string) => ({
    reporterUid: uid, targetType: 'tutor', targetId: TUTOR_UID,
    reason: 'fake-profile', detail: 'Qualification ghalat lagti hai.',
    status: 'open', createdAt: serverTimestamp(),
  });

  it('logged-in banda report bana sakta hai', async () => {
    await assertSucceeds(addDoc(collection(db(PARENT_UID), 'reports'), validReport(PARENT_UID)));
  });

  it('logged-out banda report nahi bana sakta', async () => {
    await assertFails(addDoc(collection(anonDb(), 'reports'), validReport(PARENT_UID)));
  });

  it('non-admin reports read nahi kar sakta', async () => {
    await seedDoc('reports/report-1', { ...validReport(PARENT_UID), createdAt: new Date() });
    await assertFails(getDoc(doc(db(PARENT_UID), 'reports/report-1')));
  });

  it('admin reports read kar sakta hai', async () => {
    await seedDoc('reports/report-2', { ...validReport(PARENT_UID), createdAt: new Date() });
    await assertSucceeds(getDoc(doc(db(ADMIN_UID), 'reports/report-2')));
  });
});

// =============================================================================
// admins + users — role escalation
// =============================================================================

describe('admins/{uid} — role escalation', () => {
  it('koi bhi khud ko admin nahi bana sakta ❗', async () => {
    await assertFails(
      setDoc(doc(db(PARENT_UID), `admins/${PARENT_UID}`), {
        email: 'hacker@example.com', addedAt: serverTimestamp(),
      })
    );
  });

  it('admin bhi client se naya admin nahi bana sakta (sirf Console se)', async () => {
    await assertFails(
      setDoc(doc(db(ADMIN_UID), 'admins/new-admin'), {
        email: 'new@apnatutor.com', addedAt: serverTimestamp(),
      })
    );
  });

  it('non-admin admins collection nahi padh sakta', async () => {
    await assertFails(getDoc(doc(db(PARENT_UID), `admins/${ADMIN_UID}`)));
  });
});

describe('users/{uid}', () => {
  it('naya user apna account bana sakta hai', async () => {
    const uid = 'fresh-user';
    await assertSucceeds(
      setDoc(doc(db(uid), `users/${uid}`), {
        role: 'parent', name: 'Naya User', city: 'risalpur', createdAt: serverTimestamp(),
      })
    );
  });

  it('student bhi account bana sakta hai', async () => {
    // Student aur parent ek hi tarah ke account hain — dono tutor dhoondte
    // hain. Rules mein `student` na hota to student ka signup fail ho jata.
    const uid = 'fresh-student';
    await assertSucceeds(
      setDoc(doc(db(uid), `users/${uid}`), {
        role: 'student', name: 'Naya Student', city: 'gunderi-payan', createdAt: serverTimestamp(),
      })
    );
  });

  it('user role "admin" set nahi kar sakta ❗', async () => {
    const uid = 'sneaky-user';
    await assertFails(
      setDoc(doc(db(uid), `users/${uid}`), {
        role: 'admin', name: 'Sneaky', city: 'risalpur', createdAt: serverTimestamp(),
      })
    );
  });

  it('user baad mein apna role nahi badal sakta ❗', async () => {
    await assertFails(updateDoc(doc(db(PARENT_UID), `users/${PARENT_UID}`), { role: 'tutor' }));
  });

  it('user apna naam badal sakta hai', async () => {
    await assertSucceeds(updateDoc(doc(db(PARENT_UID), `users/${PARENT_UID}`), { name: 'Naya Naam' }));
  });

  it('doosra user kisi aur ka account nahi padh sakta', async () => {
    await assertFails(getDoc(doc(db(PARENT2_UID), `users/${PARENT_UID}`)));
  });
});

// =============================================================================
// SEO content + default deny
// =============================================================================

describe('cities / subjects — SEO content', () => {
  it('cities duniya padh sakti hai', async () => {
    await seedDoc('cities/risalpur', { name: 'Risalpur', areas: ['Risalpur Cantt'], intro: 'text' });
    await assertSucceeds(getDoc(doc(anonDb(), 'cities/risalpur')));
  });

  it('non-admin city content nahi likh sakta', async () => {
    await assertFails(
      setDoc(doc(db(TUTOR_UID), 'cities/peshawar'), { name: 'Peshawar', areas: [], intro: 'x' })
    );
  });

  it('admin city content likh sakta hai', async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), 'cities/peshawar'), { name: 'Peshawar', areas: [], intro: 'x' })
    );
  });
});

describe('default deny', () => {
  it('jo collection rules mein nahi hai wo bilkul band hai', async () => {
    await assertFails(getDoc(doc(db(PARENT_UID), 'secret-collection/doc-1')));
    await assertFails(setDoc(doc(db(PARENT_UID), 'secret-collection/doc-1'), { x: 1 }));
  });
});
