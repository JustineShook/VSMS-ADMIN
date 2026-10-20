import type { DocumentData, Query, QuerySnapshot } from 'firebase/firestore';
import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import { applicationFrom, roleLabels } from '../lib/verification';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  href: string;
}
const toDate = (value: unknown): Date | null => value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? (value.toDate() as Date) : null;

export function subscribeAdminNotifications(onChange: (items: AdminNotification[]) => void, onError: (message: string) => void): () => void {
  let stopped = false;
  const unsubscribers: (() => void)[] = [];
  const groups = new Map<string, AdminNotification[]>();
  const publish = () => onChange([...groups.values()].flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  const fail = () => onError('Could not load admin notifications. Check Firestore access and refresh the page.');

  void (async () => {
    const admin = auth?.currentUser;
    if (!admin || !hasAdminClaim((await admin.getIdTokenResult()).claims) || auth?.currentUser?.uid !== admin.uid) throw new Error('admin access required');
    const { collection, collectionGroup, limit, onSnapshot, orderBy, query, where } = await import('firebase/firestore');
    const db = await getDb();
    if (stopped) return;
    const watch = (key: string, source: Query<DocumentData>, adapt: (snapshot: QuerySnapshot<DocumentData>) => AdminNotification[]) => {
      unsubscribers.push(onSnapshot(source, snapshot => { groups.set(key, adapt(snapshot)); publish(); }, fail));
    };

    watch('mechanics', query(collectionGroup(db, 'providerProfile'), where('verificationStatus', '==', 'PENDING'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const app = applicationFrom(item.ref.path, item.data());
      const createdAt = toDate(item.data().submittedAt);
      return app && !app.legacy && createdAt ? [{ id: `application:${app.path}`, title: 'Provider verification submitted', message: `${app.name} · ${roleLabels[app.role]}`, createdAt, href: '/admin#provider-verification' }] : [];
    }));
    watch('towing', query(collectionGroup(db, 'towingCompanyProfile'), where('verificationStatus', '==', 'PENDING'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const app = applicationFrom(item.ref.path, item.data());
      const createdAt = toDate(item.data().submittedAt);
      return app && !app.legacy && createdAt ? [{ id: `application:${app.path}`, title: 'Provider verification submitted', message: `${app.name} · ${roleLabels[app.role]}`, createdAt, href: '/admin#provider-verification' }] : [];
    }));
    watch('shops', query(collection(db, 'providers'), where('role', '==', 'shop-owner'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const app = applicationFrom(item.ref.path, item.data());
      const createdAt = toDate(item.data().submittedAt);
      return app && !app.legacy && createdAt ? [{ id: `application:${app.path}`, title: 'Provider verification submitted', message: `${app.name} · ${roleLabels[app.role]}`, createdAt, href: '/admin#provider-verification' }] : [];
    }));
    watch('bookings', query(collection(db, 'bookings'), orderBy('updatedAt', 'desc'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const data = item.data();
      const createdAt = toDate(data.createdAt);
      const updatedAt = toDate(data.updatedAt);
      if (!createdAt || !updatedAt) return [];
      const isNew = Math.abs(updatedAt.getTime() - createdAt.getTime()) < 1000;
      const status = typeof data.status === 'string' ? data.status.replaceAll('_', ' ') : 'unknown';
      return [{ id: isNew ? `booking:new:${item.id}` : `booking:update:${item.id}:${updatedAt.getTime()}`, title: isNew ? 'New booking received' : 'Booking status updated', message: `#${item.id} · ${status}`, createdAt: updatedAt, href: '/admin/bookings' }];
    }));
    watch('decisions', query(collection(db, 'providerVerificationHistory'), orderBy('reviewedAt', 'desc'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const data = item.data();
      const createdAt = toDate(data.reviewedAt);
      if (!createdAt) return [];
      const decision = data.decision === 'VERIFIED' ? 'approved' : 'rejected';
      return [{ id: `decision:${item.id}`, title: `Provider ${decision}`, message: `${String(data.providerName ?? 'Provider')} · ${String(data.role ?? '')}`, createdAt, href: '/admin#provider-verification' }];
    }));
    watch('account-status', query(collection(db, 'providerStatusHistory'), orderBy('changedAt', 'desc'), limit(50)), snapshot => snapshot.docs.flatMap(item => {
      const data = item.data();
      const createdAt = toDate(data.changedAt);
      if (!createdAt) return [];
      const status = data.newStatus === 'suspended' ? 'suspended' : 'restored';
      return [{ id: `account-status:${item.id}`, title: `Provider account ${status}`, message: `${String(data.providerId ?? '')} · ${String(data.role ?? '')}`, createdAt, href: data.role === 'onsite-mechanic' ? '/admin/mechanics' : data.role === 'shop-owner' ? '/admin/auto-shops' : '/admin/towing' }];
    }));
  })().catch(fail);

  return () => { stopped = true; unsubscribers.forEach(unsubscribe => unsubscribe()); };
}
