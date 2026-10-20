import type { Query, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';

export type BookingStatus = 'pending' | 'accepted' | 'vehicle_arrived' | 'diagnosing' | 'repairing' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'unknown';
export interface RecentBooking {
  id: string;
  customer: string;
  provider: string;
  service: string;
  category: ProviderDirectoryRole | 'unknown';
  status: BookingStatus;
  createdAt: Date | null;
}
export interface BookingPage { bookings: RecentBooking[]; cursor: QueryDocumentSnapshot | null }
export interface BookingActivityDay { date: Date; count: number }
export interface DashboardMetrics {
  totalUsers: number;
  pendingVerifications: number;
  activeProviders: number;
  totalBookings: number;
  providersByType: { role: string; count: number }[];
}
export type ProviderDirectoryRole = 'onsite-mechanic' | 'shop-owner' | 'towing-company' | 'homegarage' | 'owner';
export interface ProviderListing {
  id: string;
  name: string;
  role: ProviderDirectoryRole;
  availability: string;
  serviceArea: string;
  services: string[];
  phone?: string;
  accountStatus: 'active' | 'suspended';
  listingVisibility: 'active' | 'inactive';
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function serviceLabel(value: unknown): string {
  const role = stringValue(value, '');
  if (role === 'onsite-mechanic') return 'Onsite mechanic';
  if (role === 'shop-owner') return 'Auto shop';
  if (role === 'towing-company') return 'Towing';
  if (role === 'homegarage') return 'Home Garage';
  if (role === 'owner') return 'Vehicle owner';
  return role || 'Service not specified';
}

function mapBookingDocuments(snapshot: { docs: QueryDocumentSnapshot[] }): RecentBooking[] {
  return snapshot.docs.map(document => {
    const data = document.data();
    const rawStatus = typeof data.status === 'string' ? data.status.toLowerCase() : 'unknown';
    const validStatuses: BookingStatus[] = ['pending', 'accepted', 'vehicle_arrived', 'diagnosing', 'repairing', 'en_route', 'arrived', 'in_progress', 'completed', 'rejected', 'cancelled'];
    const createdAt = data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt && typeof data.createdAt.toDate === 'function'
      ? (data.createdAt.toDate() as Date) : null;
    const rawCategory = typeof data.bookingType === 'string' ? data.bookingType : '';
    const category: RecentBooking['category'] = ['onsite-mechanic', 'shop-owner', 'towing-company', 'homegarage', 'owner'].includes(rawCategory)
      ? rawCategory as ProviderDirectoryRole
      : 'unknown';
    return {
      id: document.id,
      customer: stringValue(data.customerName, 'Customer not provided'),
      provider: stringValue(data.providerName, 'Provider not provided'),
      service: serviceLabel(data.bookingType),
      category,
      status: validStatuses.includes(rawStatus as BookingStatus) ? rawStatus as BookingStatus : 'unknown',
      createdAt,
    };
  });
}

export async function loadRecentBookings(): Promise<RecentBooking[]> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, getDocsFromServer, limit, orderBy, query } = await import('firebase/firestore');
  const snapshot = await getDocsFromServer(query(collection(await getDb(), 'bookings'), orderBy('createdAt', 'desc'), limit(7)));
  return mapBookingDocuments(snapshot);
}

export async function loadBookingsPage(cursor: QueryDocumentSnapshot | null = null): Promise<BookingPage> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, getDocsFromServer, limit, orderBy, query, startAfter } = await import('firebase/firestore');
  const db = await getDb();
  const pageSize = 25;
  const result = await getDocsFromServer(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)));
  return { bookings: mapBookingDocuments(result), cursor: result.size === pageSize ? result.docs[result.docs.length - 1] : null };
}

export async function loadBookingDetails(bookingId: string): Promise<Record<string, unknown>> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const snapshot = await getDocFromServer(doc(await getDb(), 'bookings', bookingId));
  if (!snapshot.exists()) throw new Error('This booking no longer exists. Refresh the list.');
  return snapshot.data();
}

export async function loadBookingActivity(now = new Date()): Promise<BookingActivityDay[]> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, getCountFromServer, query, where } = await import('firebase/firestore');
  const db = await getDb();
  const bookings = collection(db, 'bookings');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index));
  return Promise.all(days.map(async date => {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const snapshot = await getCountFromServer(query(bookings, where('createdAt', '>=', date), where('createdAt', '<', nextDate)));
    return { date, count: snapshot.data().count };
  }));
}

export async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, collectionGroup, getCountFromServer, query, where } = await import('firebase/firestore');
  const db = await getDb();
  const count = async (collectionRef: Query, ...filters: QueryConstraint[]) =>
    (await getCountFromServer(query(collectionRef, ...filters))).data().count;
  const listings = collection(db, 'providerListings');
  const activeFilter = where('visibility', '==', 'active');
  const roles = ['onsite-mechanic', 'shop-owner', 'towing-company'];
  const [totalUsers, mechanicsPending, towingPending, shopsPending, totalBookings, ...providerCounts] = await Promise.all([
    count(collection(db, 'users')),
    count(collectionGroup(db, 'providerProfile'), where('verificationStatus', '==', 'PENDING')),
    count(collectionGroup(db, 'towingCompanyProfile'), where('verificationStatus', '==', 'PENDING')),
    count(collection(db, 'providers'), where('role', '==', 'shop-owner'), where('verificationStatus', '==', 'PENDING')),
    count(collection(db, 'bookings')),
    ...roles.map(role => count(listings, activeFilter, where('role', '==', role))),
  ]);
  return {
    totalUsers,
    pendingVerifications: mechanicsPending + towingPending + shopsPending,
    activeProviders: providerCounts.reduce((sum, value) => sum + value, 0),
    totalBookings,
    providersByType: roles.map((role, index) => ({ role, count: providerCounts[index] })),
  };
}

export async function loadProviderDirectory(role: ProviderDirectoryRole): Promise<ProviderListing[]> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, doc, getDocFromServer, getDocsFromServer, query, where } = await import('firebase/firestore');
  const db = await getDb();

  if (role === 'owner') {
    const accounts = await getDocsFromServer(query(collection(db, 'users'), where('role', '==', 'owner')));
    const verifiedAccounts = await Promise.all(accounts.docs.map(async account => {
      const profile = await getDocFromServer(doc(db, 'users', account.id, 'ownerProfile', 'profile'));
      return profile.exists() && profile.data().verificationStatus === 'VERIFIED' ? { account, profile: profile.data() } : null;
    }));
    return verifiedAccounts.filter((entry): entry is NonNullable<typeof entry> => entry !== null).map(({ account }) => {
      const data = account.data();
      const displayName = stringValue(data.displayName, stringValue(data.name, stringValue(data.email, 'Vehicle owner')));
      return {
        id: account.id,
        name: displayName,
        role,
        availability: 'Not applicable',
        serviceArea: 'Vehicle owner',
        services: [],
        accountStatus: data.accountStatus === 'suspended' ? 'suspended' : 'active',
        listingVisibility: 'inactive',
        ...(typeof data.phone === 'string' ? { phone: data.phone } : {}),
      };
    });
  }

  if (role === 'shop-owner') {
    const accounts = await getDocsFromServer(query(collection(db, 'users'), where('role', '==', 'shop-owner')));
    const verifiedShops = await Promise.all(accounts.docs.map(async account => {
      const [verification, listing] = await Promise.all([
        getDocFromServer(doc(db, 'users', account.id, 'shopVerification', 'profile')),
        getDocFromServer(doc(db, 'providerListings', account.id)),
      ]);
      if (!verification.exists() || verification.data().verificationStatus !== 'VERIFIED') return null;
      return { account, verification: verification.data(), listing: listing.data() };
    }));
    return verifiedShops.filter((entry): entry is NonNullable<typeof entry> => entry !== null).map(({ account, verification, listing }) => {
      const userData = account.data();
      const source = listing ?? verification;
      const services = Array.isArray(source.services) ? source.services.filter((item): item is string => typeof item === 'string') : [];
      return {
        id: account.id,
        name: stringValue(source.businessName, stringValue(userData.displayName, stringValue(userData.name, stringValue(userData.email, 'Auto shop')))),
        role,
        availability: stringValue(source.availability, stringValue(source.status, 'Unknown')),
        serviceArea: stringValue(source.serviceAreaLabel, stringValue(source.address, 'Not provided')),
        services,
        accountStatus: userData.accountStatus === 'suspended' ? 'suspended' as const : 'active' as const,
        listingVisibility: listing?.visibility === 'active' ? 'active' as const : 'inactive' as const,
        ...(typeof source.phone === 'string' ? { phone: source.phone } : {}),
      };
    });
  }

  const listings = collection(db, 'providerListings');
  const snapshot = await getDocsFromServer(query(listings, where('role', '==', role)));
  const verifiedListings = await Promise.all(snapshot.docs.map(async document => {
    const verificationPath = `users/${document.id}/${role === 'onsite-mechanic' ? 'providerProfile' : role === 'towing-company' ? 'towingCompanyProfile' : 'homeGarageVerification'}/profile`;
    const verification = await getDocFromServer(doc(db, verificationPath));
    if (!verification.exists() || verification.data().verificationStatus !== 'VERIFIED') return null;
    const data = document.data();
    const account = await getDocFromServer(doc(db, 'users', document.id));
    const services = Array.isArray(data.services) ? data.services.filter((item): item is string => typeof item === 'string') : [];
    return { id: document.id, data, account, services };
  }));
  return verifiedListings.filter((entry): entry is NonNullable<typeof entry> => entry !== null).map(({ id, data, account, services }) => {
    return {
      id,
      name: stringValue(data.businessName, 'Name not provided'),
      role,
      availability: stringValue(data.availability, 'Unknown'),
      serviceArea: stringValue(data.serviceAreaLabel, 'Not provided'),
      services,
      accountStatus: account.data()?.accountStatus === 'suspended' ? 'suspended' as const : 'active' as const,
      listingVisibility: data.visibility === 'active' ? 'active' as const : 'inactive' as const,
      ...(typeof data.phone === 'string' ? { phone: data.phone } : {}),
    };
  });
}

export async function loadProviderVerificationData(provider: ProviderListing): Promise<Record<string, unknown>> {
  const admin = auth?.currentUser;
  if (!admin || !hasAdminClaim((await admin.getIdTokenResult()).claims) || auth?.currentUser?.uid !== admin.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const db = await getDb();
  const path = provider.role === 'owner'
    ? `users/${provider.id}/ownerProfile/profile`
    : provider.role === 'shop-owner'
    ? `users/${provider.id}/shopVerification/profile`
    : `users/${provider.id}/${provider.role === 'onsite-mechanic' ? 'providerProfile' : provider.role === 'towing-company' ? 'towingCompanyProfile' : 'homeGarageVerification'}/profile`;
  const snapshot = await getDocFromServer(doc(db, path));
  if (!snapshot.exists()) throw new Error('No verification profile was found for this provider.');
  const data = snapshot.data();
  if (data.uid !== provider.id || data.role !== provider.role) throw new Error('The verification profile does not match this provider account.');
  return data;
}

export async function updateProviderAccountStatus(provider: ProviderListing, nextStatus: 'active' | 'suspended', reason = ''): Promise<void> {
  const admin = auth?.currentUser;
  if (!admin || !hasAdminClaim((await admin.getIdTokenResult()).claims) || auth?.currentUser?.uid !== admin.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const db = await getDb();
  const userRef = doc(db, 'users', provider.id);
  const listingRef = doc(db, 'providerListings', provider.id);
  const historyRef = doc(collection(db, 'providerStatusHistory'));
  const notificationRef = doc(db, 'users', provider.id, 'accountStatusNotifications', historyRef.id);
  await runTransaction(db, async transaction => {
    const [userSnapshot, listingSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(listingRef)]);
    if (!userSnapshot.exists() || (!listingSnapshot.exists() && provider.role !== 'owner' && provider.role !== 'shop-owner')) throw new Error('The provider account or listing no longer exists. Refresh the page.');
    if (userSnapshot.data().role !== provider.role || (listingSnapshot.exists() && listingSnapshot.data().role !== provider.role)) throw new Error('The provider role changed. Refresh the page and retry.');
    const previousStatus = userSnapshot.data().accountStatus === 'suspended' ? 'suspended' : 'active';
    if (previousStatus === nextStatus) return;
    transaction.update(userRef, {
      accountStatus: nextStatus,
      accountStatusUpdatedAt: serverTimestamp(),
      accountStatusUpdatedBy: admin.uid,
      accountStatusNotificationId: historyRef.id,
    });
    if (nextStatus === 'suspended' && listingSnapshot.exists() && listingSnapshot.data().visibility === 'active') {
      transaction.update(listingRef, { visibility: 'inactive' });
    }
    transaction.set(historyRef, {
      providerId: provider.id,
      role: provider.role,
      previousStatus,
      newStatus: nextStatus,
      changedAt: serverTimestamp(),
      changedBy: admin.uid,
    });
    const status = nextStatus === 'suspended' ? 'SUSPENDED' : 'ACTIVE';
    const message = nextStatus === 'suspended'
      ? 'Your provider account has been suspended.'
      : 'Your provider account has been reactivated.';
    const cleanReason = reason.trim().slice(0, 500);
    transaction.set(notificationRef, {
      notificationId: historyRef.id,
      providerId: provider.id,
      providerRole: provider.role,
      status,
      title: nextStatus === 'suspended' ? 'Account suspended' : 'Account reactivated',
      message: cleanReason ? `${message} Reason: ${cleanReason}` : message,
      reason: cleanReason || null,
      isRead: false,
      readAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function bookingError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return 'Admin data access was denied. Deploy the latest Firestore rules and confirm your admin claim.';
  if (code === 'failed-precondition') return 'Firestore could not run this query. Check the Firebase console for a required index.';
  if (code === 'unavailable') return 'Could not reach Firestore. Check your connection and retry.';
  return error instanceof Error && !code ? error.message : 'Could not load recent bookings. Refresh and try again.';
}
