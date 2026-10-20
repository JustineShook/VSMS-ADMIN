import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';

export interface StaffRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status: 'PENDING' | 'MANUAL_GRANT_RECORDED' | 'REJECTED';
  requestedAt: Date | null;
  reviewedBy?: string;
  reviewedAt?: Date | null;
}

function requireSignedIn() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in before requesting staff access.');
  return user;
}

export async function loadMyStaffRequest(): Promise<StaffRequest | null> {
  const user = requireSignedIn();
  const { collection, getDocsFromServer, query, where } = await import('firebase/firestore');
  const result = await getDocsFromServer(query(collection(await getDb(), 'adminStaffRequests'), where('uid', '==', user.uid)));
  const item = result.docs.reduce((latest, candidate) => {
    const candidateTime = candidate.data().requestedAt?.toMillis?.() ?? 0;
    const latestTime = latest?.data().requestedAt?.toMillis?.() ?? -1;
    return candidateTime > latestTime ? candidate : latest;
  }, undefined as typeof result.docs[number] | undefined);
  if (!item) return null;
  const data = item.data();
  return { id: item.id, uid: user.uid, email: String(data.email || ''), displayName: String(data.displayName || ''), status: data.status, requestedAt: data.requestedAt?.toDate?.() ?? null };
}

export async function submitStaffRequest() {
  const user = requireSignedIn();
  if (hasAdminClaim((await user.getIdTokenResult()).claims)) throw new Error('This account already has administrator access.');
  const latest = await loadMyStaffRequest();
  if (latest && latest.status !== 'REJECTED') throw new Error('Your latest staff access request is already being processed or approved.');
  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
  await addDoc(collection(await getDb(), 'adminStaffRequests'), {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    status: 'PENDING',
    requestedAt: serverTimestamp(),
  });
}

async function requireAdmin() {
  const user = requireSignedIn();
  if (!hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) throw new Error('Administrator access could not be verified. Sign in again.');
  return user.uid;
}

export async function loadStaffRequests(): Promise<StaffRequest[]> {
  await requireAdmin();
  const { collection, getDocsFromServer, limit, orderBy, query } = await import('firebase/firestore');
  const snapshot = await getDocsFromServer(query(collection(await getDb(), 'adminStaffRequests'), orderBy('requestedAt', 'desc'), limit(100)));
  return snapshot.docs.map(item => {
    const data = item.data();
    return { id: item.id, uid: String(data.uid || ''), email: String(data.email || ''), displayName: String(data.displayName || ''), status: data.status, requestedAt: data.requestedAt?.toDate?.() ?? null, reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined, reviewedAt: data.reviewedAt?.toDate?.() ?? null };
  });
}

export async function reviewStaffRequest(requestId: string, decision: 'APPROVED' | 'REJECTED') {
  const adminUid = await requireAdmin();
  const { doc, getDocFromServer, serverTimestamp, updateDoc } = await import('firebase/firestore');
  const db = await getDb();
  const requestRef = doc(db, 'adminStaffRequests', requestId);
  const existing = await getDocFromServer(requestRef);
  if (!existing.exists() || existing.data().status !== 'PENDING' || existing.data().uid === adminUid) {
    throw new Error('This staff request is no longer pending or cannot be reviewed by your account. Refresh the list.');
  }
  await updateDoc(requestRef, {
    status: decision === 'APPROVED' ? 'MANUAL_GRANT_RECORDED' : 'REJECTED',
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
  });
}

export function staffDateLabel(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Date unavailable';
}
