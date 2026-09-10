import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
const roles = { m: 'onsite-mechanic', t: 'towing-company', s: 'shop-owner' };
const paths = { m: 'users/m/providerProfile/profile', t: 'users/t/towingCompanyProfile/profile', s: 'providers/s' };
const admin = () => env.authenticatedContext('admin-user', { admin: true }).firestore();
const review = (state = 'VERIFIED', extra = {}) => ({ verificationStatus: state, reviewedAt: serverTimestamp(), reviewedBy: 'admin-user', rejectionReason: state === 'REJECTED' ? 'Certificate is unreadable.' : '', ...extra });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with firebase emulators:exec; never run rules tests against production.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-veresc-admin', firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid, role] of Object.entries(roles)) {
      await setDoc(doc(db, 'users', uid), { uid, role, displayName: 'Test Applicant' });
      await setDoc(doc(db, paths[uid]), { uid, role, ...(uid === 's' ? { verified: false, businessName: 'Test Shop', phone: '123', address: 'Test address', latitude: 14, longitude: 121, status: 'closed', rating: 0 } : { verificationStatus: 'PENDING', personal: { fullName: 'Applicant' } }) });
    }
  });
});
after(async () => { await env?.cleanup(); });

test('admin can query both pending collection groups and shop profiles', async () => {
  const db = admin();
  for (const name of ['providerProfile', 'towingCompanyProfile']) {
    const result = await assertSucceeds(getDocs(query(collectionGroup(db, name), where('verificationStatus', '==', 'PENDING'))));
    assert.equal(result.size, 1);
  }
  assert.equal((await assertSucceeds(getDocs(query(collection(db, 'providers'), where('role', '==', 'shop-owner'))))).size, 1);
  await assertFails(getDocs(collection(db, 'users')));
  await assertFails(getDocs(collection(db, 'bookings')));
});
test('all three provider roles can be approved and rejected with metadata', async () => {
  for (const [uid, path] of Object.entries(paths)) {
    const state = uid === 't' ? 'REJECTED' : 'VERIFIED';
    await assertSucceeds(updateDoc(doc(admin(), path), review(state, uid === 's' ? { verified: true } : {})));
    const data = (await getDoc(doc(admin(), path))).data();
    assert.equal(data.verificationStatus, state);
    assert.equal(data.reviewedBy, 'admin-user');
    assert.ok(data.reviewedAt);
    if (uid === 't') assert.equal(data.rejectionReason, 'Certificate is unreadable.');
    await assertFails(updateDoc(doc(admin(), path), review('REJECTED')));
  }
});
test('shop rejection preserves mobile boolean and removes shop from undecided state', async () => {
  await assertSucceeds(updateDoc(doc(admin(), paths.s), review('REJECTED', { verified: false })));
  const data = (await getDoc(doc(admin(), paths.s))).data();
  assert.equal(data.verified, false);
  assert.equal(data.verificationStatus, 'REJECTED');
});
test('unauthenticated, ordinary, self-approving, and string-claim users cannot decide', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('ordinary').firestore(), env.authenticatedContext('m').firestore(), env.authenticatedContext('fake', { admin: 'true' }).firestore()]) {
    await assertFails(updateDoc(doc(db, paths.m), review()));
    await assertFails(updateDoc(doc(db, paths.t), review('REJECTED')));
    await assertFails(updateDoc(doc(db, paths.s), review('VERIFIED', { verified: true })));
    await assertFails(getDocs(query(collectionGroup(db, 'providerProfile'), where('verificationStatus', '==', 'PENDING'))));
  }
});
test('admin role document alone never grants review privileges', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', 'fake-admin'), { uid: 'fake-admin', role: 'admin' }));
  await assertFails(updateDoc(doc(env.authenticatedContext('fake-admin').firestore(), paths.m), review()));
});
test('rules reject unrelated field edits, forged reviewer/time, empty reason and incomplete shop', async () => {
  const ref = doc(admin(), paths.m);
  await assertFails(updateDoc(ref, review('VERIFIED', { personal: { fullName: 'Overwritten' } })));
  await assertFails(updateDoc(ref, review('VERIFIED', { reviewedBy: 'other' })));
  await assertFails(updateDoc(ref, review('VERIFIED', { reviewedAt: new Date(0) })));
  await assertFails(updateDoc(ref, review('REJECTED', { rejectionReason: '' })));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), paths.s), { latitude: 0, longitude: 0 }));
  await assertFails(updateDoc(doc(admin(), paths.s), review('VERIFIED', { verified: true })));
});
test('existing listing must be hidden atomically; unrelated public fields survive', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings/m'), { providerId: 'm', role: 'onsite-mechanic', visibility: 'active', businessName: 'Preserve me', location: { latitude: 14, longitude: 121 }, ratingSummary: { average: 4.5, count: 8 } }));
  const db = admin();
  await assertFails(updateDoc(doc(db, paths.m), review('REJECTED')));
  await assertFails(updateDoc(doc(db, 'providerListings/m'), { visibility: 'inactive' }));
  const batch = writeBatch(db);
  batch.update(doc(db, paths.m), review('REJECTED'));
  batch.update(doc(db, 'providerListings/m'), { visibility: 'inactive' });
  await assertSucceeds(batch.commit());
  const listing = (await getDoc(doc(db, 'providerListings/m'))).data();
  assert.equal(listing.visibility, 'inactive');
  assert.equal(listing.businessName, 'Preserve me');
  assert.equal(listing.ratingSummary.count, 8);
  await assertFails(getDoc(doc(env.authenticatedContext('customer').firestore(), 'providerListings/m')));
});
test('approval grants no broad public listing or account write permissions', async () => {
  await assertFails(setDoc(doc(admin(), 'providerListings/new'), { visibility: 'active' }));
  await assertFails(updateDoc(doc(admin(), 'users/m'), { role: 'admin' }));
});
test('existing mobile private reads and pending resubmission still work', async () => {
  const db = env.authenticatedContext('m').firestore();
  await assertSucceeds(getDoc(doc(db, paths.m)));
  await assertSucceeds(setDoc(doc(db, paths.m), { uid: 'm', role: 'onsite-mechanic', verificationStatus: 'PENDING', personal: { fullName: 'Updated' } }));
  await assertFails(getDoc(doc(db, paths.t)));
});

for (const uid of ['m', 't', 's']) {
  for (const state of ['VERIFIED', 'REJECTED']) {
    test(`${roles[uid]}: ${state} with an existing listing is atomic`, async () => {
      await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings', uid), { providerId: uid, role: roles[uid], visibility: 'active', businessName: 'Preserved' }));
      const db = admin();
      const batch = writeBatch(db);
      batch.update(doc(db, paths[uid]), review(state, uid === 's' ? { verified: state === 'VERIFIED' } : {}));
      batch.update(doc(db, 'providerListings', uid), { visibility: 'inactive' });
      await assertSucceeds(batch.commit());
      assert.equal((await getDoc(doc(db, paths[uid]))).data().verificationStatus, state);
      assert.equal((await getDoc(doc(db, 'providerListings', uid))).data().businessName, 'Preserved');
    });
  }
}
test('verified mobile provider can republish an inactive listing; unverified provider cannot', async () => {
  const listing = { providerId: 'm', role: 'onsite-mechanic', category: 'Onsite Mechanics', businessName: 'Test Service', location: { latitude: 14, longitude: 121 }, availability: 'available', visibility: 'inactive', ratingSummary: { average: 0, count: 0 }, services: ['Brake Repair'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', operatingHours: '9 AM - 5 PM', startingPrice: 500, emergencyServiceAvailable: true };
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings/m'), listing));
  const mobileRef = doc(env.authenticatedContext('m').firestore(), 'providerListings/m');
  await assertFails(setDoc(mobileRef, { ...listing, visibility: 'active' }));
  await assertSucceeds(updateDoc(doc(admin(), paths.m), review()));
  await assertSucceeds(setDoc(mobileRef, { ...listing, visibility: 'active' }));
});
