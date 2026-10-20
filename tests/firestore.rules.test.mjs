import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
const roles = { m: 'onsite-mechanic', t: 'towing-company', s: 'shop-owner', o: 'owner' };
const paths = { m: 'users/m/providerProfile/profile', t: 'users/t/towingCompanyProfile/profile', s: 'providers/s', o: 'users/o/ownerProfile/profile' };
const admin = () => env.authenticatedContext('admin-user', { admin: true }).firestore();
const profileData = (uid, role) => ({ uid, role, ...(uid === 's'
  ? { verified: false, businessName: 'Test Shop', phone: '123', address: 'Test address', latitude: 14, longitude: 121, status: 'closed', rating: 0 }
  : { verificationStatus: 'PENDING', personal: { fullName: 'Applicant' } }) });

async function decide(db, uid, state, { withListing = false, extra = {} } = {}) {
  const path = paths[uid];
  const role = roles[uid];
  const notificationId = `review-${uid}-${state}`;
  const reason = state === 'REJECTED' ? 'Certificate is unreadable.' : '';
  const batch = writeBatch(db);
  batch.update(doc(db, path), {
    verificationStatus: state,
    reviewedAt: serverTimestamp(),
    reviewedBy: 'admin-user',
    rejectionReason: reason,
    lastStatusNotificationId: notificationId,
    ...(uid === 's' ? { verified: state === 'VERIFIED' } : {}),
    ...extra,
  });
  batch.set(doc(db, 'users', uid, 'accountStatusNotifications', notificationId), {
    notificationId, providerId: uid, providerRole: role, status: state,
    title: state === 'VERIFIED' ? 'Provider verified' : 'Verification rejected',
    message: state === 'VERIFIED' ? 'Your provider account has been verified.' : `Your verification was not approved. Reason: ${reason}`,
    reason: reason || null, isRead: false, readAt: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'providerVerificationHistory', notificationId), {
    providerId: uid, providerName: 'Applicant', role, decision: state,
    reviewedAt: serverTimestamp(), reviewedBy: 'admin-user',
  });
  if (withListing) batch.update(doc(db, 'providerListings', uid), { visibility: 'inactive' });
  await batch.commit();
}

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
      await setDoc(doc(db, 'users', uid), { uid, role, displayName: 'Applicant' });
      await setDoc(doc(db, paths[uid]), profileData(uid, role));
    }
    await setDoc(doc(db, 'users/s/shopVerification/profile'), {
      uid: 's', role: 'shop-owner', verificationStatus: 'PENDING',
      business: { name: 'Test Shop', phone: '123', address: 'Test address', latitude: 14, longitude: 121 },
    });
  });
});
after(async () => { await env?.cleanup(); });

test('admins can query each pending verification group and shops; ordinary users cannot', async () => {
  const db = admin();
  for (const name of ['providerProfile', 'towingCompanyProfile', 'ownerProfile']) {
    const result = await assertSucceeds(getDocs(query(collectionGroup(db, name), where('verificationStatus', '==', 'PENDING'))));
    assert.equal(result.size, 1);
  }
  assert.equal((await assertSucceeds(getDocs(query(collection(db, 'providers'), where('role', '==', 'shop-owner'))))).size, 1);
  await assertFails(getDocs(collection(env.authenticatedContext('ordinary').firestore(), 'users')));
  await assertFails(getDocs(query(collectionGroup(env.authenticatedContext('ordinary').firestore(), 'ownerProfile'), where('verificationStatus', '==', 'PENDING'))));
});

test('admins can approve/reject all provider roles and vehicle owners with history and notifications', async () => {
  for (const [uid, state] of [['m', 'VERIFIED'], ['t', 'REJECTED'], ['s', 'VERIFIED'], ['o', 'VERIFIED']]) {
    await assertSucceeds(decide(admin(), uid, state, { extra: uid === 's' ? { verified: true } : {} }));
    const data = (await getDoc(doc(admin(), paths[uid]))).data();
    assert.equal(data.verificationStatus, state);
    assert.equal(data.reviewedBy, 'admin-user');
    assert.ok(data.reviewedAt);
    assert.ok(data.lastStatusNotificationId);
    assert.equal((await getDoc(doc(admin(), 'providerVerificationHistory', `review-${uid}-${state}`))).exists(), true);
  }
});

test('direct admin profile updates and incomplete review transactions are denied', async () => {
  await assertFails(updateDoc(doc(admin(), paths.m), { verificationStatus: 'VERIFIED' }));
  await assertFails(updateDoc(doc(admin(), paths.o), { verificationStatus: 'VERIFIED' }));
  await assertFails(setDoc(doc(admin(), 'users/o/accountStatusNotifications/forged'), { status: 'VERIFIED' }));
  await assertFails(updateDoc(doc(env.authenticatedContext('ordinary').firestore(), paths.o), { verificationStatus: 'VERIFIED' }));
});

test('review decisions require trusted admin claims and valid rejection reasons', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('ordinary').firestore(), env.authenticatedContext('fake', { admin: 'true' }).firestore()]) {
    await assertFails(decide(db, 'm', 'VERIFIED'));
    await assertFails(getDocs(query(collectionGroup(db, 'ownerProfile'), where('verificationStatus', '==', 'PENDING'))));
  }
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings/m'), { providerId: 'm', role: roles.m, visibility: 'active' }));
  const adminDb = admin();
  const batch = writeBatch(adminDb);
  batch.update(doc(adminDb, paths.m), { verificationStatus: 'REJECTED', reviewedAt: serverTimestamp(), reviewedBy: 'admin-user', rejectionReason: 'No', lastStatusNotificationId: 'bad-reason' });
  await assertFails(batch.commit());
});

test('review hides existing listing atomically and preserves its other fields', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings/m'), { providerId: 'm', role: roles.m, visibility: 'active', businessName: 'Preserved' }));
  await assertFails(decide(admin(), 'm', 'REJECTED'));
  await assertFails(updateDoc(doc(admin(), 'providerListings/m'), { visibility: 'inactive' }));
  await assertSucceeds(decide(admin(), 'm', 'REJECTED', { withListing: true }));
  const listing = (await getDoc(doc(admin(), 'providerListings/m'))).data();
  assert.equal(listing.visibility, 'inactive');
  assert.equal(listing.businessName, 'Preserved');
  await assertFails(getDoc(doc(env.authenticatedContext('customer').firestore(), 'providerListings/m')));
});

test('review history, user accounts, and public listings reject unrelated admin writes', async () => {
  await assertFails(setDoc(doc(admin(), 'providerListings/new'), { visibility: 'active' }));
  await assertFails(updateDoc(doc(admin(), 'users/m'), { role: 'admin' }));
  await assertFails(updateDoc(doc(admin(), 'providerVerificationHistory/event'), { decision: 'VERIFIED' }));
});

test('vehicle owner can read and resubmit only their own pending profile', async () => {
  const owner = env.authenticatedContext('o').firestore();
  await assertSucceeds(getDoc(doc(owner, paths.o)));
  await assertSucceeds(setDoc(doc(owner, paths.o), { uid: 'o', role: 'owner', verificationStatus: 'PENDING', personal: { fullName: 'Updated' } }));
  await assertFails(getDoc(doc(env.authenticatedContext('m').firestore(), paths.o)));
});

test('verified mobile provider can republish an inactive listing; unverified provider cannot', async () => {
  const listing = { providerId: 'm', role: roles.m, category: 'Onsite Mechanics', businessName: 'Test Service', location: { latitude: 14, longitude: 121 }, availability: 'available', visibility: 'inactive', ratingSummary: { average: 0, count: 0 }, services: ['Brake Repair'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', description: 'Mobile vehicle repair service.', operatingHours: '9 AM - 5 PM', startingPrice: 500, emergencyServiceAvailable: true };
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'providerListings/m'), listing));
  const mobileRef = doc(env.authenticatedContext('m').firestore(), 'providerListings/m');
  await assertFails(setDoc(mobileRef, { ...listing, visibility: 'active' }));
  await assertSucceeds(decide(admin(), 'm', 'VERIFIED'));
  await assertSucceeds(setDoc(mobileRef, { ...listing, visibility: 'active' }));
});

test('admins can read Home Garage parking spaces, including hidden listings', async () => {
  const listing = {
    providerId: 'h', role: 'homegarage', category: 'Parking Lots',
    businessName: 'Test Parking', location: { latitude: 14, longitude: 121 },
    availability: 'available', visibility: 'inactive', ratingSummary: { average: 0, count: 0 },
    services: ['Parking'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', description: 'Secure parking spaces.',
    operatingHours: '24 hours', startingPrice: 100, emergencyServiceAvailable: false,
    totalSlots: 12, availableSlots: 7,
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'h'), { uid: 'h', role: 'homegarage', accountStatus: 'active' });
    await setDoc(doc(db, 'users', 'h', 'homeGarageVerification', 'profile'), {
      uid: 'h', role: 'homegarage', verificationStatus: 'VERIFIED',
      business: { name: 'Test Parking' },
    });
    await setDoc(doc(db, 'providerListings', 'h'), listing);
  });

  const adminDb = admin();
  const result = await assertSucceeds(getDocs(query(
    collection(adminDb, 'providerListings'), where('role', '==', 'homegarage'),
  )));
  assert.equal(result.size, 1);
  assert.equal(result.docs[0].data().totalSlots, 12);
  assert.equal(result.docs[0].data().availableSlots, 7);
  await assertFails(getDocs(query(
    collection(env.authenticatedContext('ordinary').firestore(), 'providerListings'),
    where('role', '==', 'homegarage'),
  )));
});

test('Home Garage listings require valid parking space counts', async () => {
  const listing = {
    providerId: 'h', role: 'homegarage', category: 'Parking Lots',
    businessName: 'Test Parking', location: { latitude: 14, longitude: 121 },
    availability: 'available', visibility: 'active', ratingSummary: { average: 0, count: 0 },
    services: ['Parking'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', description: 'Secure parking spaces.',
    operatingHours: '24 hours', startingPrice: 100, emergencyServiceAvailable: false,
    totalSlots: 12, availableSlots: 7,
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'h'), { uid: 'h', role: 'homegarage' });
    await setDoc(doc(db, 'users', 'h', 'homeGarageVerification', 'profile'), {
      uid: 'h', role: 'homegarage', verificationStatus: 'VERIFIED',
      business: { name: 'Test Parking' },
    });
  });
  const providerDb = env.authenticatedContext('h').firestore();
  await assertSucceeds(setDoc(doc(providerDb, 'providerListings/h'), listing));
  await assertFails(setDoc(doc(providerDb, 'providerListings/h'), {
    ...listing, availableSlots: 13,
  }));
  await assertFails(setDoc(doc(providerDb, 'providerListings/h'), {
    ...listing, totalSlots: -1,
  }));
});

test('parking booking and slot reservation must be committed together', async () => {
  const provider = 'h';
  const customer = env.authenticatedContext('o').firestore();
  const listing = {
    providerId: provider, role: 'homegarage', category: 'Parking Lots', businessName: 'Test Parking',
    location: { latitude: 14, longitude: 121 }, availability: 'available', visibility: 'active',
    ratingSummary: { average: 0, count: 0 }, services: ['Parking'], vehicleTypes: ['Car'],
    serviceAreaLabel: 'Test City', description: 'Secure parking.', operatingHours: '24 hours',
    startingPrice: 100, emergencyServiceAvailable: false, totalSlots: 2, availableSlots: 1,
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/o'), { uid: 'o', role: 'owner' });
    await setDoc(doc(db, 'users/o/ownerProfile/profile'), { uid: 'o', role: 'owner', verificationStatus: 'VERIFIED' });
    await setDoc(doc(db, 'users/h'), { uid: 'h', role: 'homegarage' });
    await setDoc(doc(db, 'users/h/homeGarageVerification/profile'), {
      uid: 'h', role: 'homegarage', verificationStatus: 'VERIFIED', business: { name: 'Test Parking' },
    });
    await setDoc(doc(db, 'providerListings/h'), listing);
    await setDoc(doc(db, 'parkingSlots/slot-1'), {
      providerId: 'h', slotNumber: 1, status: 'available', customerId: null, bookingId: null,
    });
  });

  const booking = {
    providerId: 'h', providerName: 'Test Parking', customerId: 'o', customerName: 'Applicant',
    vehicleId: 'vehicle-1', vehicle: 'Toyota Corolla', vehiclePlate: 'ABC123', vehicleType: 'Car',
    slotId: 'slot-1', slotNumber: 1, notes: '', status: 'reserved',
    bookedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(customer, 'parkingBookings/booking-1'), booking));
  const batch = writeBatch(customer);
  batch.set(doc(customer, 'parkingBookings/booking-1'), booking);
  batch.update(doc(customer, 'parkingSlots/slot-1'), {
    status: 'reserved', customerId: 'o', bookingId: 'booking-1', updatedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

test('customer and provider notification collections stay private to their account', async () => {
  const owner = env.authenticatedContext('o').firestore();
  const mechanic = env.authenticatedContext('m').firestore();
  const towing = env.authenticatedContext('t').firestore();
  const shop = env.authenticatedContext('s').firestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/o/notifications/n'), { customerId: 'o' });
    await setDoc(doc(db, 'users/m/mechanicNotifications/n'), { providerId: 'm' });
    await setDoc(doc(db, 'users/t/towingNotifications/n'), { providerId: 't' });
    await setDoc(doc(db, 'users/s/shopNotifications/n'), { providerId: 's' });
  });
  await assertSucceeds(getDoc(doc(owner, 'users/o/notifications/n')));
  await assertSucceeds(getDoc(doc(mechanic, 'users/m/mechanicNotifications/n')));
  await assertSucceeds(getDoc(doc(towing, 'users/t/towingNotifications/n')));
  await assertSucceeds(getDoc(doc(shop, 'users/s/shopNotifications/n')));
  await assertFails(getDoc(doc(mechanic, 'users/o/notifications/n')));
  await assertFails(getDoc(doc(owner, 'users/m/mechanicNotifications/n')));
  await assertFails(getDoc(doc(owner, 'users/t/towingNotifications/n')));
  await assertFails(getDoc(doc(owner, 'users/s/shopNotifications/n')));
});
