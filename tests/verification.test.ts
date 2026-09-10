import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationFrom, approvalProblem, documentUrl, sameSubmission } from '../src/lib/verification.ts';

test('applications follow exact existing paths, roles and states', () => {
  assert.ok(applicationFrom('users/m/providerProfile/profile', { uid: 'm', role: 'onsite-mechanic', verificationStatus: 'PENDING' }));
  assert.ok(applicationFrom('users/t/towingCompanyProfile/profile', { uid: 't', role: 'towing-company', verificationStatus: 'PENDING' }));
  assert.equal(applicationFrom('users/m/providerProfile/profile', { uid: 'someone-else', role: 'onsite-mechanic', verificationStatus: 'PENDING' }), null);
  assert.equal(applicationFrom('unrelated/m/providerProfile/profile', { uid: 'm', role: 'onsite-mechanic', verificationStatus: 'PENDING' }), null);
  assert.equal(applicationFrom('users/m/providerProfile/profile', { uid: 'm', role: 'onsite-mechanic', verificationStatus: 'VERIFIED' }), null);
});
test('legacy shops are honest unverified candidates, and decided shops leave queue', () => {
  const data = { uid: 's', role: 'shop-owner', verified: false };
  const candidate = applicationFrom('providers/s', data)!;
  assert.equal(candidate.legacy, true);
  assert.equal(candidate.submitted, 'Not recorded');
  assert.ok(approvalProblem(candidate));
  assert.equal(applicationFrom('providers/s', { ...data, verificationStatus: 'REJECTED' }), null);
  assert.equal(applicationFrom('providers/s', { ...data, verified: true }), null);
  assert.equal(approvalProblem({ ...candidate, data: { ...data, businessName: 'Real Shop', phone: '123', address: 'Address', latitude: 14, longitude: 121 } }), null);
});
test('document links accept existing hosts and reject executable or deceptive URLs', () => {
  assert.ok(documentUrl('https://res.cloudinary.com/example/image/upload/cert.png'));
  assert.ok(documentUrl('https://firebasestorage.googleapis.com/v0/b/example/o/file?alt=media&token=test'));
  for (const value of ['javascript:alert(1)', 'https://res.cloudinary.com.evil.test/file', 'http://res.cloudinary.com/file', 'https://user:pass@res.cloudinary.com/file', 'file:///secret', null]) assert.equal(documentUrl(value), null);
});
test('stale submission check ignores property ordering, detects nested and timestamp changes', () => {
  assert.ok(sameSubmission({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }));
  assert.equal(sameSubmission({ personal: { phone: '1' } }, { personal: { phone: '2' } }), false);
  assert.equal(sameSubmission({ submittedAt: { seconds: 1 } }, { submittedAt: { seconds: 2 } }), false);
});
