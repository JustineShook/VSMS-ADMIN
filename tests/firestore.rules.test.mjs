import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
const roles = { m: 'onsite-mechanic', t: 'towing-company', s: 'shop-owner', o: 'owner' };
const paths = { m: 'users/m/providerProfile/profile', t: 'users/t/towingCompanyProfile/profile', s: 'providers/s', o: 'users/o/ownerProfile/profile' };
const admin = () => env.authenticatedContext('admin-user', { admin: true }).firestore();
const profileData = (uid, role) => ({ uid, role, ...(uid === 's'
  ? { verified: false, businessName: 'Test Shop', phone: '123', address: 'Test address', latitude: 14, longitude: 121, status: 'closed', rating: 0 }
  : { verificationStatus: 'PENDING', personal: { fullName: 'Applicant' } }) });

async function assertDeniedWithoutExpressionLimit(action, label) {
  let failure;
  try { await action(); } catch (error) { failure = error; }
  assert.ok(failure, `${label} unexpectedly succeeded`);
  assert.doesNotMatch(String(failure), /maximum of 1000 expressions|evaluation limit/i, `${label} was denied by an evaluation limit`);
  assert.match(String(failure), /PERMISSION_DENIED|permission-denied/, `${label} did not fail with a Firestore permission denial`);
}

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
  if (withListing) {
    const listingRef = doc(db, 'providerListings', uid);
    const listing = await getDoc(listingRef);
    batch.update(listingRef, { visibility: 'inactive' });
  }
  await batch.commit();
}

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with firebase emulators:exec; never run rules tests against production.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-veresc-admin', firestore: { host, port: Number(port), rules: await readFile(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8') } });
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

test('all booking roles accept legacy declines and updated event writes while rejecting invalid events and repeat declines', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/hg'), { uid: 'hg', role: 'homegarage' });
    await setDoc(doc(db, 'users/hg/homeGarageVerification/profile'), { uid: 'hg', role: 'homegarage', verificationStatus: 'VERIFIED' });
    for (const [id, role] of [['m', roles.m], ['t', roles.t], ['s', roles.s], ['hg', 'homegarage']]) {
      await setDoc(doc(db, `bookings/legacy-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'pending', timingMode: 'now' });
      await setDoc(doc(db, `bookings/updated-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'pending', timingMode: 'now' });
      await setDoc(doc(db, `bookings/invalid-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'pending', timingMode: 'now' });
      await setDoc(doc(db, `bookings/repeat-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'pending', timingMode: 'now' });
    }
  });
  for (const id of ['m', 't', 's', 'hg']) {
    const providerDb = env.authenticatedContext(id).firestore();
    await assertSucceeds(updateDoc(doc(providerDb, 'bookings', `legacy-${id}`), { status: 'rejected', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(providerDb, 'bookings', `updated-${id}`), { status: 'rejected', declineReason: 'No availability today.', riskEventType: 'provider_decline', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(providerDb, 'bookings', `invalid-${id}`), { status: 'rejected', declineReason: '   ', riskEventType: 'provider_decline', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(providerDb, 'bookings', `repeat-${id}`), { status: 'rejected', declineReason: 'Valid reason.', riskEventType: 'provider_decline', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(providerDb, 'bookings', `repeat-${id}`), { status: 'rejected', declineReason: 'Valid reason.', riskEventType: 'provider_decline', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  }
});

test('all booking roles accept legacy pending cancellations and count valid accepted cancellations once', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/hg'), { uid: 'hg', role: 'homegarage' });
    await setDoc(doc(db, 'users/hg/homeGarageVerification/profile'), { uid: 'hg', role: 'homegarage', verificationStatus: 'VERIFIED' });
    for (const [id, role] of [['m', roles.m], ['t', roles.t], ['s', roles.s], ['hg', 'homegarage']]) {
      await setDoc(doc(db, `bookings/accepted-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'accepted', timingMode: 'now' });
      await setDoc(doc(db, `bookings/pending-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'pending', timingMode: 'now' });
      await setDoc(doc(db, `bookings/blank-${id}`), { bookingType: role, customerId: 'o', providerId: id, status: 'accepted', timingMode: 'now' });
    }
  });
  const ownerDb = env.authenticatedContext('o').firestore();
  for (const id of ['m', 't', 's', 'hg']) {
    await assertSucceeds(updateDoc(doc(ownerDb, 'bookings', `accepted-${id}`), {
      status: 'cancelled', cancellationReason: 'I no longer need this request.',
      riskEventType: 'owner_cancel_after_acceptance', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(ownerDb, 'bookings', `pending-${id}`), { status: 'cancelled', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ownerDb, 'bookings', `blank-${id}`), {
      status: 'cancelled', cancellationReason: '   ', riskEventType: 'owner_cancel_after_acceptance',
      riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(ownerDb, 'bookings', `accepted-${id}`), {
      status: 'cancelled', cancellationReason: 'I no longer need this request.',
      riskEventType: 'owner_cancel_after_acceptance', riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }
});

test('suspended providers cannot update bookings and hidden listings do not break active-listing queries', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/m'), { uid: 'm', role: roles.m, accountStatus: 'suspended' });
    await setDoc(doc(db, 'bookings/existing-accepted'), { bookingType: roles.m, customerId: 'o', providerId: 'm', status: 'accepted', timingMode: 'now' });
    await setDoc(doc(db, 'providerListings/m'), { providerId: 'm', role: roles.m, visibility: 'inactive', availability: 'available' });
    await setDoc(doc(db, 'providerListings/hidden-suspended'), { providerId: 'hidden-suspended', role: roles.m, visibility: 'inactive', availability: 'available' });
    await setDoc(doc(db, 'providerListings/visible-active'), { providerId: 'visible-active', role: roles.m, visibility: 'active', availability: 'available' });
  });
  const providerDb = env.authenticatedContext('m').firestore();
  await assertFails(updateDoc(doc(providerDb, 'bookings/existing-accepted'), { status: 'en_route', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(providerDb, 'providerListings/m'), { visibility: 'active' }));
  const ownerDb = env.authenticatedContext('o').firestore();
  const listings = await assertSucceeds(getDocs(query(collection(ownerDb, 'providerListings'), where('visibility', '==', 'active'), where('availability', '==', 'available'))));
  assert.deepEqual(listings.docs.map(item => item.id), ['visible-active']);
});

test('admin suspension updates the account, status history, notification, and provider listing atomically', async () => {
  for (const [uid, role] of [['m', roles.m], ['o', roles.o]]) {
    const notificationId = `suspension-${uid}`;
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', uid), { uid, role, accountStatus: 'active' });
      if (uid === 'm') await setDoc(doc(db, 'providerListings', uid), { providerId: uid, role, visibility: 'active', availability: 'available' });
    });
    const db = admin();
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      accountStatus: 'suspended', accountStatusUpdatedAt: serverTimestamp(),
      accountStatusUpdatedBy: 'admin-user', accountStatusNotificationId: notificationId,
    });
    if (uid === 'm') batch.update(doc(db, 'providerListings', uid), { visibility: 'inactive' });
    batch.set(doc(db, 'providerStatusHistory', notificationId), {
      providerId: uid, role, previousStatus: 'active', newStatus: 'suspended',
      changedAt: serverTimestamp(), changedBy: 'admin-user',
    });
    batch.set(doc(db, 'users', uid, 'accountStatusNotifications', notificationId), {
      notificationId, providerId: uid, providerRole: role, status: 'SUSPENDED',
      title: 'Account suspended', message: 'Your account was suspended. Reason: Review needed.',
      reason: 'Review needed.', isRead: false, readAt: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    const recipientDb = env.authenticatedContext(uid).firestore();
    assert.equal((await getDoc(doc(recipientDb, 'users', uid))).data().accountStatus, 'suspended');
    assert.equal((await getDoc(doc(db, 'providerStatusHistory', notificationId))).exists(), true);
    assert.equal((await getDoc(doc(recipientDb, 'users', uid, 'accountStatusNotifications', notificationId))).data().reason, 'Review needed.');
    if (uid === 'm') assert.equal((await getDoc(doc(db, 'providerListings', uid))).data().visibility, 'inactive');
    await assertFails(updateDoc(doc(env.authenticatedContext(uid).firestore(), 'users', uid), { accountStatus: 'active' }));
  }
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
    services: ['Oil change'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', description: 'Home Garage repair services.',
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
    services: ['Oil change'], vehicleTypes: ['Car'], serviceAreaLabel: 'Test City', description: 'Home Garage repair services.',
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

test('exact Auto Shop save passes without visibility; protected fields and suspended publishing stay denied', async () => {
  const uid = 'GD7wHEGfuRPeVgFciUq0JoInu3g1';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weeklyHours = days.map(day => ({ day, open: true, openingTime: '8:00 AM', closingTime: '6:00 PM' }));
  const photos = [
    'https://res.cloudinary.com/rfhd9sez/image/upload/v1792398632/ym0ezcrfqqh22lxwko2w.jpg',
    'https://res.cloudinary.com/rfhd9sez/image/upload/v1792662122/ftef6jlwv5kzzmwmrhy5.jpg',
    'https://res.cloudinary.com/rfhd9sez/image/upload/v1792662120/h04lv6vjv7isxrkzzjz6.jpg',
  ];
  const payload = {
    businessName: 'LIBIOS AUTOSHOP',
    location: { latitude: 10.268323119032482, longitude: 123.84366619817413 },
    availability: 'available',
    serviceAreaLabel: 'Talisay, Central Visayas',
    description: 'We offer reliable vehicle repairs and maintenance, from oil change to engine and brake services.',
    contactPhone: '09224238091',
    services: ['Preventive maintenance', 'Tire service', 'Battery service', 'Oil change', 'Engine repair'],
    vehicleTypes: ['Motorcycle', 'Car', 'SUV', 'Pickup Truck'],
    operatingHours: 'Open 24/7',
    startingPrice: null,
    emergencyServiceAvailable: true,
    acceptsScheduledBookings: true,
    visibility: 'active',
    photoUrls: photos,
    hoursType: '24_7',
    is24Hours: true,
    weeklyHours,
  };
  const existing = {
    providerId: uid, role: 'shop-owner', category: 'Auto Shops', businessName: 'LIBIOS AUTOSHOP',
    location: { latitude: 10.2, longitude: 123.8 }, availability: 'available',
    ratingSummary: { average: 4.8, count: 12 }, services: payload.services, vehicleTypes: payload.vehicleTypes,
    serviceAreaLabel: 'Talisay, Central Visayas', description: 'Existing listing', contactPhone: '09224238091',
    startingPrice: null, operatingHours: 'Open 24/7', emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, photoUrls: photos, hoursType: '24_7', is24Hours: true, weeklyHours, legacyImported: true,
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', uid), { uid, role: 'shop-owner', accountStatus: 'active' });
    await setDoc(doc(db, 'users', uid, 'shopVerification', 'profile'), {
      uid, role: 'shop-owner', verificationStatus: 'VERIFIED',
      business: { name: 'LIBIOS AUTOSHOP', phone: '09224238091', address: 'Talisay, Central Visayas' },
    });
    await setDoc(doc(db, 'providers', uid), { uid, role: 'shop-owner', verified: true, status: 'open' });
    // Deliberately omit visibility, matching the existing listing that failed.
    await setDoc(doc(db, 'providerListings', uid), existing);
  });
  const listingRef = doc(env.authenticatedContext(uid).firestore(), 'providerListings', uid);
  await assertSucceeds(updateDoc(listingRef, payload));
  const savedExistingShop = (await getDoc(listingRef)).data();
  assert.deepEqual(savedExistingShop?.ratingSummary, existing.ratingSummary);
  assert.equal(savedExistingShop?.legacyImported, true);
  for (const [field, value] of [
    ['providerId', 'attacker'],
    ['role', 'homegarage'],
    ['category', 'Parking Lots'],
    ['ratingSummary', { average: 5, count: 99 }],
  ]) {
    await assertDeniedWithoutExpressionLimit(
      () => updateDoc(listingRef, { [field]: value }),
      `Auto Shop cannot change protected ${field}`,
    );
  }

  const suspendedUid = 'suspended-exact-shop-owner';
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', suspendedUid), { uid: suspendedUid, role: 'shop-owner', accountStatus: 'suspended' });
    await setDoc(doc(db, 'providers', suspendedUid), { uid: suspendedUid, role: 'shop-owner', verified: true, status: 'open' });
    await setDoc(doc(db, 'providerListings', suspendedUid), { ...existing, providerId: suspendedUid, visibility: 'inactive' });
  });
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(env.authenticatedContext(suspendedUid).firestore(), 'providerListings', suspendedUid), payload),
    'suspended Auto Shop cannot publish its listing',
  );
});

test('Home Garage saves new and existing repair listings with form services; invalid or ineligible writes are denied', async () => {
  const uid = 'home-garage-listing-save';
  const repairServices = ['Oil change', 'Brake service', 'Engine repair', 'Battery service', 'Tire service', 'Air-conditioning service'];
  const listingPayload = {
    providerId: uid, role: 'homegarage', category: 'Parking Lots', businessName: 'Home Garage Repairs',
    location: { latitude: 10.2683, longitude: 123.8437 }, availability: 'available', visibility: 'active',
    ratingSummary: { average: 0, count: 0 }, services: repairServices, vehicleTypes: ['Car', 'SUV'],
    serviceAreaLabel: 'Talisay, Central Visayas', description: 'Home vehicle repairs and maintenance.',
    startingPrice: null, operatingHours: 'Open 24/7',
    emergencyServiceAvailable: true, acceptsScheduledBookings: true,
    photoUrls: ['https://example.invalid/home-garage.jpg'],
  };
  await env.withSecurityRulesDisabled(async context => {
    const seedDb = context.firestore();
    await setDoc(doc(seedDb, 'users', uid), { uid, role: 'homegarage', accountStatus: 'active' });
    await setDoc(doc(seedDb, 'users', uid, 'homeGarageVerification', 'profile'), {
      uid, role: 'homegarage', verificationStatus: 'VERIFIED', business: { name: 'Home Garage Repairs' },
    });
  });  const db = env.authenticatedContext(uid).firestore();
  const listingRef = doc(db, 'providerListings', uid);
  await assertSucceeds(setDoc(listingRef, listingPayload));
  assert.deepEqual((await getDoc(listingRef)).data()?.services, repairServices);
  await assertSucceeds(setDoc(listingRef, { ...listingPayload, description: 'Updated Home Garage repair listing.' }));
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { services: ['Parking'] }),
    'Home Garage cannot publish a parking-only service instead of repair services',
  );

  const unverifiedUid = 'unverified-home-garage-listing';
  await env.withSecurityRulesDisabled(async context => {
    const seedDb = context.firestore();
    await setDoc(doc(seedDb, 'users', unverifiedUid), { uid: unverifiedUid, role: 'homegarage', accountStatus: 'active' });
    await setDoc(doc(seedDb, 'users', unverifiedUid, 'homeGarageVerification', 'profile'), {
      uid: unverifiedUid, role: 'homegarage', verificationStatus: 'PENDING', business: { name: 'Unverified Garage' },
    });
  });
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(env.authenticatedContext(unverifiedUid).firestore(), 'providerListings', unverifiedUid), { ...listingPayload, providerId: unverifiedUid }),
    'unverified Home Garage cannot create a repair listing',
  );

  const suspendedUid = 'suspended-home-garage-listing';
  await env.withSecurityRulesDisabled(async context => {
    const seedDb = context.firestore();
    await setDoc(doc(seedDb, 'users', suspendedUid), { uid: suspendedUid, role: 'homegarage', accountStatus: 'suspended' });
    await setDoc(doc(seedDb, 'users', suspendedUid, 'homeGarageVerification', 'profile'), {
      uid: suspendedUid, role: 'homegarage', verificationStatus: 'VERIFIED', business: { name: 'Suspended Garage' },
    });
    await setDoc(doc(seedDb, 'providerListings', suspendedUid), { ...listingPayload, providerId: suspendedUid, visibility: 'inactive' });
  });
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(env.authenticatedContext(suspendedUid).firestore(), 'providerListings', suspendedUid), { ...listingPayload, providerId: suspendedUid }),
    'suspended Home Garage cannot publish its repair listing',
  );
});

test('Stage 1 denies new parking reservations but lets an existing session complete and release its slot', async () => {
  const customer = env.authenticatedContext('o').firestore();
  const provider = 'h';
  const bookingId = 'parking-stage-one-existing';
  const listing = {
    providerId: provider, role: 'homegarage', category: 'Parking Lots', businessName: 'Test Garage',
    location: { latitude: 14, longitude: 121 }, availability: 'available', visibility: 'active',
    ratingSummary: { average: 0, count: 0 }, services: ['Oil change'], vehicleTypes: ['Car'],
    serviceAreaLabel: 'Test City', description: 'Home Garage repair service.', operatingHours: '24 hours',
    startingPrice: 100, emergencyServiceAvailable: true,
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'providerListings/h'), listing);
    await setDoc(doc(db, 'parkingSlots/available-slot'), {
      providerId: provider, slotNumber: 1, status: 'available', customerId: null, bookingId: null,
    });
    await setDoc(doc(db, `parkingBookings/${bookingId}`), {
      providerId: provider, providerName: 'Test Garage', customerId: 'o', customerName: 'Applicant',
      vehicleId: 'vehicle-1', vehicle: 'Toyota Corolla', vehiclePlate: 'ABC123', vehicleType: 'Car',
      slotId: 'active-slot', slotNumber: 2, notes: '', status: 'reserved',
      bookedAt: new Date(), updatedAt: new Date(),
    });
    await setDoc(doc(db, 'parkingSlots/active-slot'), {
      providerId: provider, slotNumber: 2, status: 'reserved', customerId: 'o', bookingId,
    });
  });

  const newBooking = {
    providerId: provider, providerName: 'Test Garage', customerId: 'o', customerName: 'Applicant',
    vehicleId: 'vehicle-1', vehicle: 'Toyota Corolla', vehiclePlate: 'ABC123', vehicleType: 'Car',
    slotId: 'available-slot', slotNumber: 1, notes: '', status: 'reserved',
    bookedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(customer, 'parkingBookings/parking-stage-one-new'), newBooking));
  await assertFails(updateDoc(doc(customer, 'parkingSlots/available-slot'), {
    status: 'reserved', customerId: 'o', bookingId: 'parking-stage-one-new', updatedAt: serverTimestamp(),
  }));

  const bookingRef = doc(customer, `parkingBookings/${bookingId}`);
  const slotRef = doc(customer, 'parkingSlots/active-slot');
  await assertSucceeds(getDoc(bookingRef));
  await assertSucceeds(getDoc(slotRef));
  await assertSucceeds(updateDoc(bookingRef, { status: 'active', parkingStartedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  const batch = writeBatch(customer);
  batch.update(bookingRef, { status: 'completed', parkingEndedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(slotRef, { status: 'available', customerId: null, bookingId: null, updatedAt: serverTimestamp() });
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

test('Towing listing saves preserve ratings and legacy fields; availability toggles only the narrow field', async () => {
  const uid = 'towing-save-and-toggle';
  const listing = {
    providerId: uid, role: 'towing-company', category: 'Towing', businessName: 'Tow Service',
    location: { latitude: 14.6, longitude: 121.0 }, availability: 'offline', visibility: 'active',
    ratingSummary: { average: 4.6, count: 11 }, services: ['Flatbed Towing'], vehicleTypes: ['Car'],
    serviceAreaLabel: 'Quezon City', description: 'Roadside towing support.', contactPhone: '09123456789',
    startingPrice: null, operatingHours: 'Open daily', emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, legacyImported: 'keep-me',
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', uid), { uid, role: 'towing-company', accountStatus: 'active' });
    await setDoc(doc(db, 'users', uid, 'towingCompanyProfile', 'profile'), { uid, role: 'towing-company', verificationStatus: 'VERIFIED' });
    await setDoc(doc(db, 'providerListings', uid), listing);
  });
  const listingRef = doc(env.authenticatedContext(uid).firestore(), 'providerListings', uid);
  await assertSucceeds(updateDoc(listingRef, {
    businessName: 'Updated Tow Service', location: listing.location, availability: 'offline', visibility: 'active',
    serviceAreaLabel: listing.serviceAreaLabel, description: 'Updated roadside towing support.',
    contactPhone: listing.contactPhone, services: listing.services, vehicleTypes: listing.vehicleTypes,
    operatingHours: listing.operatingHours, startingPrice: null, emergencyServiceAvailable: true,
    acceptsScheduledBookings: true,
  }));
  let saved = (await getDoc(listingRef)).data();
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyImported, listing.legacyImported);
  await assertSucceeds(updateDoc(listingRef, { availability: 'available' }));
  await assertSucceeds(updateDoc(listingRef, { availability: 'offline' }));
  saved = (await getDoc(listingRef)).data();
  assert.equal(saved?.availability, 'offline');
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyImported, listing.legacyImported);
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { ratingSummary: { average: 5, count: 99 } }),
    'Towing provider cannot change system ratings',
  );
});
test('Mechanic full saves and both availability directions preserve nonzero ratings and legacy fields', async () => {
  const uid = 'm';
  const listing = {
    providerId: uid, role: 'onsite-mechanic', category: 'Onsite Mechanics', businessName: 'Test Mechanic',
    location: { latitude: 14.6, longitude: 121.0 }, availability: 'available', visibility: 'active',
    ratingSummary: { average: 4.3, count: 9 }, services: ['Brake Repair'], vehicleTypes: ['Car'],
    serviceAreaLabel: 'Quezon City', description: 'Mobile repairs.', contactPhone: '09123456789',
    startingPrice: 500, operatingHours: 'Daily', emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, legacyImported: 'keep-me',
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', uid), { uid, role: 'onsite-mechanic', accountStatus: 'active' });
    await setDoc(doc(db, 'users', uid, 'providerProfile', 'profile'), { uid, role: 'onsite-mechanic', verificationStatus: 'VERIFIED' });
    await setDoc(doc(db, 'providerListings', uid), listing);
  });
  const listingRef = doc(env.authenticatedContext(uid).firestore(), 'providerListings', uid);
  await assertSucceeds(updateDoc(listingRef, {
    businessName: 'Updated Mechanic', location: listing.location, availability: 'available', visibility: 'active',
    serviceAreaLabel: listing.serviceAreaLabel, description: 'Updated mobile repairs.', contactPhone: listing.contactPhone,
    services: listing.services, vehicleTypes: listing.vehicleTypes, operatingHours: listing.operatingHours,
    startingPrice: 600, emergencyServiceAvailable: true, acceptsScheduledBookings: true,
  }));
  await assertSucceeds(updateDoc(listingRef, { availability: 'offline' }));
  await assertSucceeds(updateDoc(listingRef, { availability: 'available' }));
  const saved = (await getDoc(listingRef)).data();
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyImported, listing.legacyImported);
});
test('admin cannot restore a hidden provider listing without guarded suspension history', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'providerListings/m'), {
      providerId: 'm', role: 'onsite-mechanic', category: 'Onsite Mechanics', visibility: 'inactive', availability: 'offline',
    });
  });
  await assertFails(updateDoc(doc(admin(), 'providerListings', 'm'), { visibility: 'active' }));
});

test('phone-free guest document reads pass, but map collection queries cannot prove phone absence', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const safe = { providerId: 'contact-provider', role: 'onsite-mechanic', category: 'Onsite Mechanics', businessName: 'Mechanic', visibility: 'active', availability: 'available', acceptsScheduledBookings: true, location: { latitude: 14, longitude: 121 } };
    await setDoc(doc(db, 'users/contact-provider'), { uid: 'contact-provider', role: 'onsite-mechanic', accountStatus: 'active' });
    await setDoc(doc(db, 'providerListings/contact-provider'), safe);
    await setDoc(doc(db, 'providerListings/unsafe-phone'), { ...safe, providerId: 'unsafe-phone', contactPhone: '09123456789' });
    await setDoc(doc(db, 'providerListings/safe-scheduled'), { ...safe, providerId: 'safe-scheduled', availability: 'offline' });
    await setDoc(doc(db, 'providerListings/unsafe-scheduled'), { ...safe, providerId: 'unsafe-scheduled', availability: 'offline', contactPhone: '09123456789' });
    await setDoc(doc(db, 'providerListings/shop-safe'), { ...safe, providerId: 'shop-safe', role: 'shop-owner', category: 'Auto Shops' });
    await setDoc(doc(db, 'providerContacts/contact-provider'), { providerId: 'contact-provider', phone: '09123456789' });
    await setDoc(doc(db, 'users/contact-provider/providerProfile/profile'), {
      uid: 'contact-provider', role: 'onsite-mechanic', personal: { phone: '09123456789', address: 'Private address' },
    });
  });
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(guest, 'providerListings/contact-provider')));
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, 'providerListings/unsafe-phone')), 'guest cannot read listing containing contactPhone');
  for (const q of [
    query(collection(guest, 'providerListings'), where('visibility', '==', 'active'), where('availability', '==', 'available')),
    query(collection(guest, 'providerListings'), where('visibility', '==', 'active'), where('acceptsScheduledBookings', '==', true)),
    query(collection(guest, 'providerListings'), where('visibility', '==', 'active'), where('role', '==', 'shop-owner'), where('availability', '==', 'available')),
    query(collection(guest, 'providerListings'), where('visibility', '==', 'active'), where('role', '==', 'shop-owner'), where('acceptsScheduledBookings', '==', true)),
  ]) {
    await assertDeniedWithoutExpressionLimit(() => getDocs(q), 'guest map collection query cannot prove contactPhone is absent');
  }
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, 'providerContacts/contact-provider')), 'guest contact read denied');
  const customer = env.authenticatedContext('vehicle-owner').firestore();
  await assertSucceeds(getDoc(doc(customer, 'providerContacts/contact-provider')));
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(customer, 'users/contact-provider/providerProfile/profile')), 'customer cannot read full provider profile');
});

test('phone-field protections block new provider phones and admin lifecycle rewrites', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/phone-new'), { uid: 'phone-new', role: 'onsite-mechanic', accountStatus: 'active' });
    await setDoc(doc(db, 'providerListings/m'), { providerId: 'm', role: 'onsite-mechanic', category: 'Onsite Mechanics', visibility: 'inactive', availability: 'offline' });
  });
  const provider = env.authenticatedContext('phone-new').firestore();
  const phoneListing = {
    providerId: 'phone-new', role: 'onsite-mechanic', category: 'Onsite Mechanics', businessName: 'Mechanic',
    location: { latitude: 14, longitude: 121 }, visibility: 'active', availability: 'available',
    ratingSummary: { average: 0, count: 0 }, services: ['Engine Diagnostics'], vehicleTypes: ['Car'],
    serviceAreaLabel: 'Quezon City', description: '', contactPhone: '09123456789', operatingHours: 'Daily',
  };
  await assertDeniedWithoutExpressionLimit(() => setDoc(doc(provider, 'providerListings/phone-new'), phoneListing), 'new listing cannot contain contactPhone');
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(admin(), 'providerListings/m'), { contactPhone: '09123456789' }), 'admin cannot reintroduce contactPhone during listing lifecycle updates');
});