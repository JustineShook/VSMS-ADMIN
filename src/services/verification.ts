import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import { applicationFrom, approvalProblem, sameSubmission } from '../lib/verification';
import type { Application } from '../types/verification';

export type Cursors = Partial<Record<'mechanic' | 'towing' | 'shop' | 'shopSubmission' | 'homegarage' | 'owner', QueryDocumentSnapshot | null>>;
async function requireAdmin() {
  const user = auth?.currentUser;
  // Avoid forcing a token-change event on every load: the shared auth provider
  // rechecks the route on token changes. Firebase renews expired tokens here.
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) throw new Error('Administrator access could not be verified. Sign in again.');
  return user.uid;
}
export async function loadApplications(cursors: Cursors = {}) {
  await requireAdmin();
  const { collection, doc, getDocFromServer, getDocsFromServer, limit, query, startAfter, where } = await import('firebase/firestore');
  const db = await getDb();
  const accountSources = [
    ['mechanic', 'onsite-mechanic', 'providerProfile'],
    ['towing', 'towing-company', 'towingCompanyProfile'],
    ['owner', 'owner', 'ownerProfile'],
    ['shopSubmission', 'shop-owner', 'shopVerification'],
    ['homegarage', 'homegarage', 'homeGarageVerification'],
  ] as const;
  const accountBatches = await Promise.all(accountSources.map(async ([key, role, profileCollection]) => {
    if (cursors[key] === null) return { key, applications: [], cursor: null };
    const after = cursors[key];
    const result = await getDocsFromServer(query(collection(db, 'users'), where('role', '==', role), ...(after ? [startAfter(after)] : []), limit(50)));
    const applications = (await Promise.all(result.docs.map(async account => {
      const profile = await getDocFromServer(doc(db, 'users', account.id, profileCollection, 'profile'));
      if (!profile.exists()) return [];
      const application = applicationFrom(profile.ref.path, profile.data());
      return application ? [application] : [];
    }))).flat();
    return { key, applications, cursor: result.size === 50 && result.docs.length ? result.docs[result.docs.length - 1] : null };
  }));
  // Legacy shops have no submission status. Scan that collection in bounded
  // pages, include unverified/undecided records and label them honestly.
  const shopAfter = cursors.shop;
  const shopResult = shopAfter === null ? null : await getDocsFromServer(query(collection(db, 'providers'), where('role', '==', 'shop-owner'), ...(shopAfter ? [startAfter(shopAfter)] : []), limit(50)));
  const shopApplications = shopResult?.docs.flatMap(snapshot => {
    const application = applicationFrom(snapshot.ref.path, snapshot.data());
    return application ? [application] : [];
  }) ?? [];
  const shopCursor = shopResult && shopResult.size === 50 && shopResult.docs.length ? shopResult.docs[shopResult.docs.length - 1] : null;
  const batches = [...accountBatches, { key: 'shop' as const, applications: shopApplications, cursor: shopCursor }];
  return { applications: batches.flatMap(batch => batch.applications), cursors: Object.fromEntries(batches.map(batch => [batch.key, batch.cursor])) as Cursors };
}
export async function reviewApplication(application: Application, decision: 'VERIFIED' | 'REJECTED', reason: string) {
  const adminUid = await requireAdmin();
  const { collection, doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const rejectionReason = reason.trim();
  if (decision === 'REJECTED' && (rejectionReason.length < 5 || rejectionReason.length > 500)) throw new Error('Enter a rejection reason of 5–500 characters.');
  if (decision === 'VERIFIED' && rejectionReason.length > 500) throw new Error('Admin notes must be 500 characters or fewer.');
  const db = await getDb();
  await runTransaction(db, async transaction => {
    const profileRef = doc(db, application.path);
    const profile = await transaction.get(profileRef);
    const account = await transaction.get(doc(db, 'users', application.uid));
    const shopRef = doc(db, 'providers', application.uid);
    const listingRef = doc(db, 'providerListings', application.uid);
    const listing = await transaction.get(listingRef);
    const shop = application.role === 'shop-owner' && application.path.includes('/shopVerification/')
      ? await transaction.get(shopRef)
      : null;
    const historyRef = doc(collection(db, 'providerVerificationHistory'));
    const notificationRef = doc(db, 'users', application.uid, 'accountStatusNotifications', historyRef.id);
    const current = profile.exists() ? applicationFrom(profile.ref.path, profile.data()) : null;
    if (!current || !sameSubmission(current.data, application.data)) throw new Error('This application changed or was already reviewed. Close details and refresh before reviewing again.');
    if (account.data()?.role !== current.role) throw new Error('The account role does not match this application. Approval stopped.');
    if (decision === 'VERIFIED') {
      const problem = approvalProblem(current);
      if (problem) throw new Error(problem);
    }
    transaction.update(profileRef, {
      verificationStatus: decision, reviewedAt: serverTimestamp(), reviewedBy: adminUid,
      rejectionReason: decision === 'REJECTED' ? rejectionReason : '',
      lastStatusNotificationId: historyRef.id,
      ...(current.role === 'shop-owner' && !application.path.includes('/shopVerification/') ? { verified: decision === 'VERIFIED' } : {}),
    });
    if (shop?.exists()) transaction.update(shopRef, {
      verificationStatus: decision,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      rejectionReason: decision === 'REJECTED' ? rejectionReason : '',
      lastStatusNotificationId: historyRef.id,
      verified: decision === 'VERIFIED',
    });
    transaction.set(historyRef, {
      providerId: application.uid,
      providerName: application.name,
      role: current.role,
      decision,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    });
    const title = decision === 'VERIFIED' ? 'Provider verified' : 'Verification rejected';
    const message = decision === 'VERIFIED'
      ? 'Your provider account has been verified.'
      : 'Your verification was not approved.';
    transaction.set(notificationRef, {
      notificationId: historyRef.id,
      providerId: application.uid,
      providerRole: current.role,
      status: decision,
      title,
      message: rejectionReason ? `${message} Reason: ${rejectionReason}` : message,
      reason: rejectionReason || null,
      isRead: false,
      readAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Do not auto-publish private submission data. A stale existing listing is
    // hidden atomically; approved providers publish via the existing mobile form.
    if (current.role !== 'owner' && listing.exists()) transaction.update(listingRef, { visibility: 'inactive' });
  });
}
export async function loadApplicantName(uid: string): Promise<string> {
  await requireAdmin();
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const snapshot = await getDocFromServer(doc(await getDb(), 'users', uid));
  const name = snapshot.data()?.displayName;
  return typeof name === 'string' && name.trim() ? name : 'Not provided';
}
export function verificationError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return 'Verification access was denied. Check your admin claim and deploy the reviewed Firestore rules.';
  if (code === 'failed-precondition') return 'Firestore needs the collection-group indexes. Deploy firestore.indexes.json and wait for indexes to finish building.';
  if (code === 'unavailable') return 'Could not reach Firestore. Check your connection and retry.';
  return error instanceof Error && !code ? error.message : 'The verification request failed. Refresh and try again.';
}
