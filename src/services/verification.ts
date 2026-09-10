import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import { applicationFrom, approvalProblem, sameSubmission } from '../lib/verification';
import type { Application } from '../types/verification';

export type Cursors = Partial<Record<'mechanic' | 'towing' | 'shop', QueryDocumentSnapshot | null>>;
async function requireAdmin() {
  const user = auth?.currentUser;
  // Avoid forcing a token-change event on every load: the shared auth provider
  // rechecks the route on token changes. Firebase renews expired tokens here.
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) throw new Error('Administrator access could not be verified. Sign in again.');
  return user.uid;
}
export async function loadApplications(cursors: Cursors = {}) {
  await requireAdmin();
  const { collection, collectionGroup, getDocsFromServer, limit, query, startAfter, where } = await import('firebase/firestore');
  const db = await getDb();
  const sources = [
    ['mechanic', collectionGroup(db, 'providerProfile'), where('verificationStatus', '==', 'PENDING')],
    ['towing', collectionGroup(db, 'towingCompanyProfile'), where('verificationStatus', '==', 'PENDING')],
    // Legacy shops have no submission status. Scan the role in bounded pages,
    // include only unverified/undecided records, and label them honestly in UI.
    ['shop', collection(db, 'providers'), where('role', '==', 'shop-owner')],
  ] as const;
  const batches = await Promise.all(sources.map(async ([key, source, filter]) => {
    if (cursors[key] === null) return { key, applications: [], cursor: null };
    const after = cursors[key];
    const result = await getDocsFromServer(query(source, filter, ...(after ? [startAfter(after)] : []), limit(50)));
    return { key, applications: result.docs.flatMap(snapshot => {
      const application = applicationFrom(snapshot.ref.path, snapshot.data());
      return application ? [application] : [];
    }), cursor: result.size === 50 ? result.docs[result.docs.length - 1] : null };
  }));
  return { applications: batches.flatMap(batch => batch.applications), cursors: Object.fromEntries(batches.map(batch => [batch.key, batch.cursor])) as Cursors };
}
export async function reviewApplication(application: Application, decision: 'VERIFIED' | 'REJECTED', reason: string) {
  const adminUid = await requireAdmin();
  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const rejectionReason = reason.trim();
  if (decision === 'REJECTED' && (rejectionReason.length < 5 || rejectionReason.length > 500)) throw new Error('Enter a rejection reason of 5–500 characters.');
  const db = await getDb();
  await runTransaction(db, async transaction => {
    const profileRef = doc(db, application.path);
    const profile = await transaction.get(profileRef);
    const account = await transaction.get(doc(db, 'users', application.uid));
    const listingRef = doc(db, 'providerListings', application.uid);
    const listing = await transaction.get(listingRef);
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
      ...(current.role === 'shop-owner' ? { verified: decision === 'VERIFIED' } : {}),
    });
    // Do not auto-publish private submission data. A stale existing listing is
    // hidden atomically; approved providers publish via the existing mobile form.
    if (listing.exists()) transaction.update(listingRef, { visibility: 'inactive' });
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
