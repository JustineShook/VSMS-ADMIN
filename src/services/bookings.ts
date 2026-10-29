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
  listingVisibility: 'active' | 'inactive' | 'missing';
}
export type RiskEventType = 'owner_cancel_after_acceptance' | 'provider_decline';
export interface ActionRiskEvent {
  bookingId: string;
  eventType: RiskEventType;
  eventAt: Date;
  actorId: string;
  actorName: string;
  role: ProviderDirectoryRole;
  service: string;
  status: string;
  reason: string;
}
export interface ActionRiskCase {
  id: string;
  name: string;
  role: ProviderDirectoryRole;
  eventType: RiskEventType;
  accountStatus: 'active' | 'suspended';
  count: number;
  events: ActionRiskEvent[];
  account: ProviderListing | null;
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

/** Groups distinct bookings by account and action type for the rolling review window. */
export function groupActionRiskEvents(events: ActionRiskEvent[]): Omit<ActionRiskCase, 'account' | 'accountStatus'>[] {
  const groups = new Map<string, { id: string; name: string; role: ProviderDirectoryRole; eventType: RiskEventType; events: Map<string, ActionRiskEvent> }>();
  for (const event of events) {
    const key = `${event.actorId}:${event.eventType}`;
    let group = groups.get(key);
    if (!group) {
      group = { id: event.actorId, name: event.actorName, role: event.role, eventType: event.eventType, events: new Map() };
      groups.set(key, group);
    }
    group.events.set(event.bookingId, event);
  }
  return Array.from(groups.values()).map(group => ({
    id: group.id,
    name: group.name,
    role: group.role,
    eventType: group.eventType,
    count: group.events.size,
    events: Array.from(group.events.values()).sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime()),
  })).filter(group => group.count >= 4).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function loadActionRiskQueue(now = new Date()): Promise<ActionRiskCase[]> {
  const admin = auth?.currentUser;
  if (!admin || !hasAdminClaim((await admin.getIdTokenResult()).claims) || auth?.currentUser?.uid !== admin.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, doc, getDocFromServer, getDocsFromServer, orderBy, query, Timestamp, where } = await import('firebase/firestore');
  const db = await getDb();
  const cutoff = Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const bookingCollection = collection(db, 'bookings');
  const rows = await Promise.all((['owner_cancel_after_acceptance', 'provider_decline'] as const).map(async eventType => {
    const snapshot = await getDocsFromServer(query(bookingCollection,
      where('riskEventType', '==', eventType), where('riskEventAt', '>=', cutoff), orderBy('riskEventAt', 'desc')));
    return snapshot.docs.flatMap(document => {
      const data = document.data();
      const actorId = eventType === 'owner_cancel_after_acceptance' ? data.customerId : data.providerId;
      const role: ProviderDirectoryRole | 'unknown' = eventType === 'owner_cancel_after_acceptance' ? 'owner'
        : ['onsite-mechanic', 'shop-owner', 'towing-company', 'homegarage'].includes(data.bookingType) ? data.bookingType as ProviderDirectoryRole : 'unknown';
      const eventAt = data.riskEventAt && typeof data.riskEventAt === 'object' && 'toDate' in data.riskEventAt && typeof data.riskEventAt.toDate === 'function'
        ? data.riskEventAt.toDate() as Date : null;
      if (typeof actorId !== 'string' || !eventAt || role === 'unknown') return [];
      const rawReason = eventType === 'owner_cancel_after_acceptance' ? data.cancellationReason : data.declineReason;
      return [{
        bookingId: document.id,
        eventType,
        eventAt,
        actorId,
        actorName: stringValue(eventType === 'owner_cancel_after_acceptance' ? data.customerName : data.providerName, 'Account name unavailable'),
        role,
        service: serviceLabel(data.bookingType),
        status: stringValue(data.status, 'Unknown'),
        reason: typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim() : 'No reason was saved.',
      } satisfies ActionRiskEvent];
    });
  })).then(groups => groups.flat());

  const cases = groupActionRiskEvents(rows);
  return Promise.all(cases.map(async item => {
    const [accountSnapshot, listingSnapshot] = await Promise.all([
      getDocFromServer(doc(db, 'users', item.id)),
      item.role === 'owner' ? Promise.resolve(null) : getDocFromServer(doc(db, 'providerListings', item.id)),
    ]);
    const accountData: Record<string, unknown> = accountSnapshot.exists() ? accountSnapshot.data() : {};
    const listingData: Record<string, unknown> = listingSnapshot?.exists() ? listingSnapshot.data() : {};
    const name = stringValue(accountData.displayName, stringValue(accountData.name, stringValue(accountData.email, item.name)));
    const account: ProviderListing | null = accountSnapshot.exists() ? {
      id: item.id,
      name,
      role: item.role,
      availability: stringValue(listingData.availability, 'Not applicable'),
      serviceArea: stringValue(listingData.serviceAreaLabel, 'Not provided'),
      services: Array.isArray(listingData.services) ? listingData.services.filter((service): service is string => typeof service === 'string') : [],
      accountStatus: accountData.accountStatus === 'suspended' ? 'suspended' : 'active',
      listingVisibility: listingSnapshot?.exists() ? (listingData.visibility === 'active' ? 'active' : 'inactive') : 'missing',
      ...(typeof listingData.contactPhone === 'string' ? { phone: listingData.contactPhone } : {}),
    } : null;
    return { ...item, name, accountStatus: account?.accountStatus ?? 'active', account };
  }));
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
        ...(typeof data.contactPhone === 'string' ? { phone: data.contactPhone } : {}),
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
      const source = listing.data();
      return { account, verification: verification.data(), listing: source };
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
        listingVisibility: listing ? (listing.visibility === 'active' ? 'active' as const : 'inactive' as const) : 'missing' as const,

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

      ...(typeof data.contactPhone === 'string' ? { phone: data.contactPhone } : {}),
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

export interface ProviderAccountStatusResult {
  listingVisibility: 'active' | 'inactive' | 'missing' | 'not_applicable';
  listingCanBePublished: boolean;
  listingRestored: boolean;
}

function providerVerificationPath(provider: ProviderListing): string {
  return provider.role === 'shop-owner'
    ? `users/${provider.id}/shopVerification/profile`
    : `users/${provider.id}/${provider.role === 'onsite-mechanic' ? 'providerProfile' : provider.role === 'towing-company' ? 'towingCompanyProfile' : 'homeGarageVerification'}/profile`;
}

function providerMeetsPublishingRequirements(
  provider: ProviderListing,
  listing: Record<string, unknown> | undefined,
  verification: Record<string, unknown> | undefined,
  shopProfile: Record<string, unknown> | undefined,
): boolean {
  if (!listing || !verification || verification.uid !== provider.id || verification.role !== provider.role
    || verification.verificationStatus !== 'VERIFIED') return false;
  const expectedCategory = provider.role === 'onsite-mechanic' ? 'Onsite Mechanics'
    : provider.role === 'towing-company' ? 'Towing'
      : provider.role === 'homegarage' ? 'Parking Lots' : 'Auto Shops';
  const location = listing.location as { latitude?: unknown; longitude?: unknown } | undefined;
  if (listing.providerId !== provider.id || listing.role !== provider.role || listing.category !== expectedCategory
    || typeof listing.businessName !== 'string' || !listing.businessName.trim()
    || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number'
    || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90
    || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180
    || !Array.isArray(listing.services) || !listing.services.length
    || !Array.isArray(listing.vehicleTypes) || !listing.vehicleTypes.length
    || typeof listing.serviceAreaLabel !== 'string' || !listing.serviceAreaLabel.trim()
    || ((provider.role === 'shop-owner' || provider.role === 'homegarage')
      && (typeof listing.description !== 'string' || !listing.description.trim()))
    || typeof listing.operatingHours !== 'string' || !listing.operatingHours.trim()
    || !(provider.role === 'onsite-mechanic' || provider.role === 'towing-company'
      ? ['available', 'busy', 'offline'].includes(String(listing.availability))
      : ['available', 'offline'].includes(String(listing.availability)))) return false;
  if (provider.role === 'homegarage') {
    const business = verification.business as { name?: unknown } | undefined;
    return typeof business?.name === 'string' && !!business.name.trim();
  }
  if (provider.role === 'shop-owner') {
    return shopProfile?.uid === provider.id && shopProfile.role === 'shop-owner' && shopProfile.verified === true
      && ((shopProfile.status === 'open' && listing.availability === 'available')
        || (shopProfile.status === 'closed' && listing.availability === 'offline'));
  }
  return true;
}

export async function updateProviderAccountStatus(provider: ProviderListing, nextStatus: 'active' | 'suspended', reason = ''): Promise<ProviderAccountStatusResult> {
  const admin = auth?.currentUser;
  if (!admin || !hasAdminClaim((await admin.getIdTokenResult()).claims) || auth?.currentUser?.uid !== admin.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, doc, runTransaction, serverTimestamp, updateDoc } = await import('firebase/firestore');
  const db = await getDb();
  const userRef = doc(db, 'users', provider.id);
  const listingRef = doc(db, 'providerListings', provider.id);
  const historyRef = doc(collection(db, 'providerStatusHistory'));
  const notificationRef = doc(db, 'users', provider.id, 'accountStatusNotifications', historyRef.id);
  let shouldRestoreListing = false;
  let previousSuspensionWasPublic = false;
  const cleanReason = reason.trim().slice(0, 500);
  const initialResult = await runTransaction(db, async transaction => {
    const [userSnapshot, listingSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(listingRef)]);
    if (!userSnapshot.exists() || (!listingSnapshot.exists() && provider.role !== 'owner' && provider.role !== 'shop-owner')) throw new Error('The provider account or listing no longer exists. Refresh the page.');
    if (userSnapshot.data().role !== provider.role || (listingSnapshot.exists() && listingSnapshot.data().role !== provider.role)) throw new Error('The provider role changed. Refresh the page and retry.');
    const previousStatus = userSnapshot.data().accountStatus === 'suspended' ? 'suspended' : 'active';
    const beforeListingVisibility: ProviderAccountStatusResult['listingVisibility'] = provider.role === 'owner'
      ? 'not_applicable'
      : !listingSnapshot.exists() ? 'missing'
        : listingSnapshot.data().visibility === 'active' ? 'active' : 'inactive';
    if (previousStatus === nextStatus) {
      return {
        listingVisibility: beforeListingVisibility,

        listingCanBePublished: provider.role !== 'owner',
        listingRestored: false,
      };
    }

    let listingCanBePublished = provider.role !== 'owner';
    let listingRestored = false;
    let listingVisibility = beforeListingVisibility;
    let previousSuspensionData: Record<string, unknown> | undefined;
    let verificationData: Record<string, unknown> | undefined;
    let shopProfileData: Record<string, unknown> | undefined;
    if (nextStatus === 'active' && provider.role !== 'owner') {
      const previousHistoryId = userSnapshot.data().accountStatusNotificationId;
      const verificationRef = doc(db, providerVerificationPath(provider));
      const shopProfileRef = provider.role === 'shop-owner' ? doc(db, 'providers', provider.id) : null;
      const [historySnapshot, verificationSnapshot, shopProfileSnapshot] = await Promise.all([
        typeof previousHistoryId === 'string'
          ? transaction.get(doc(db, 'providerStatusHistory', previousHistoryId))
          : Promise.resolve(null),
        transaction.get(verificationRef),
        shopProfileRef ? transaction.get(shopProfileRef) : Promise.resolve(null),
      ]);
      previousSuspensionData = historySnapshot?.exists() ? historySnapshot.data() : undefined;
      verificationData = verificationSnapshot.exists() ? verificationSnapshot.data() : undefined;
      shopProfileData = shopProfileSnapshot?.exists() ? shopProfileSnapshot.data() : undefined;
      listingCanBePublished = providerMeetsPublishingRequirements(
        provider,
        listingSnapshot.exists() ? listingSnapshot.data() : undefined,
        verificationData,
        shopProfileData,
      );
      const wasPublicBeforeSuspension = previousSuspensionData?.providerId === provider.id
        && previousSuspensionData.role === provider.role
        && previousSuspensionData.newStatus === 'suspended'
        && previousSuspensionData.listingVisibilityBeforeSuspension === 'active';
      previousSuspensionWasPublic = wasPublicBeforeSuspension;
      if (wasPublicBeforeSuspension && listingCanBePublished && listingSnapshot.exists()
        && listingSnapshot.data().visibility === 'inactive') {
        shouldRestoreListing = true;
      } else if (listingSnapshot.exists() && listingSnapshot.data().visibility === 'active') {
        listingVisibility = 'active';
      }
    }
    transaction.update(userRef, {
      accountStatus: nextStatus,
      accountStatusUpdatedAt: serverTimestamp(),
      accountStatusUpdatedBy: admin.uid,
      accountStatusNotificationId: historyRef.id,
    });
    if (nextStatus === 'suspended' && listingSnapshot.exists()) {
      if (listingSnapshot.data().visibility === 'active') transaction.update(listingRef, { visibility: 'inactive' });
    }
    transaction.set(historyRef, {
      providerId: provider.id,
      role: provider.role,
      previousStatus,
      newStatus: nextStatus,
      changedAt: serverTimestamp(),
      changedBy: admin.uid,
      ...(nextStatus === 'suspended' && provider.role !== 'owner'
        ? { listingVisibilityBeforeSuspension: beforeListingVisibility }
        : {}),
      ...(nextStatus === 'active' && provider.role !== 'owner'
        ? { listingRestored: false, ...(typeof userSnapshot.data().accountStatusNotificationId === 'string'
          ? { previousStatusNotificationId: userSnapshot.data().accountStatusNotificationId }
          : {}) }
        : nextStatus === 'active' ? { listingRestored } : {}),
    });
    const status = nextStatus === 'suspended' ? 'SUSPENDED' : 'ACTIVE';
    const message = nextStatus === 'suspended'
      ? provider.role === 'owner'
        ? 'Your vehicle owner account has been suspended.'
        : beforeListingVisibility === 'active'
          ? 'Your provider account has been suspended, and your public listing has been hidden.'
          : beforeListingVisibility === 'inactive'
            ? 'Your provider account has been suspended. Your public listing was already hidden and remains inactive.'
            : 'Your provider account has been suspended. No public listing was published.'
      : provider.role === 'owner'
        ? 'Your vehicle owner account has been reactivated.'
        : shouldRestoreListing
          ? 'Your provider account has been reactivated. Your previously public listing remains hidden while it is being restored.'
        : listingVisibility === 'active'
          ? 'Your provider account has been reactivated, and your public listing is visible to customers again.'
          : listingSnapshot.exists() && !listingCanBePublished
            ? 'Your provider account has been reactivated, but your public listing remains hidden because your current verification or listing details do not meet publishing requirements.'
            : listingSnapshot.exists()
              ? 'Your provider account has been reactivated. Your public listing remains hidden; open Public Listing and publish it when ready.'
              : 'Your provider account has been reactivated. You do not have a public listing yet.';
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
    return { listingVisibility, listingCanBePublished, listingRestored, previousSuspensionWasPublic };
  });
  if (!shouldRestoreListing || nextStatus !== 'active' || provider.role === 'owner') return initialResult;

  try {
    const restoreResult = await runTransaction(db, async transaction => {
      const verificationRef = doc(db, providerVerificationPath(provider));
      const shopProfileRef = provider.role === 'shop-owner' ? doc(db, 'providers', provider.id) : null;
      const [userSnapshot, listingSnapshot, historySnapshot, verificationSnapshot, shopProfileSnapshot] = await Promise.all([
        transaction.get(userRef), transaction.get(listingRef), transaction.get(historyRef),
        transaction.get(verificationRef), shopProfileRef ? transaction.get(shopProfileRef) : Promise.resolve(null),
      ]);
      if (!userSnapshot.exists() || !listingSnapshot.exists() || !historySnapshot.exists()) return {
        ...initialResult,
        finalize: false,
        finalMessage: 'Your provider account has been reactivated, but your public listing remains hidden.',
      };
      const listingCanBePublishedNow = providerMeetsPublishingRequirements(
        provider,
        listingSnapshot.data(),
        verificationSnapshot.exists() ? verificationSnapshot.data() : undefined,
        shopProfileSnapshot?.exists() ? shopProfileSnapshot.data() : undefined,
      );
      const priorSuspensionId = historySnapshot.data().previousStatusNotificationId;
      const suspensionSnapshot = typeof priorSuspensionId === 'string'
        ? await transaction.get(doc(db, 'providerStatusHistory', priorSuspensionId))
        : null;
      const priorSuspension = suspensionSnapshot?.exists() ? suspensionSnapshot.data() : undefined;
      const previouslyPublic = priorSuspension?.providerId === provider.id
        && priorSuspension.role === provider.role
        && priorSuspension.newStatus === 'suspended'
        && priorSuspension.listingVisibilityBeforeSuspension === 'active';
      if (userSnapshot.data().accountStatus === 'active'
        && userSnapshot.data().accountStatusNotificationId === historyRef.id
        && historySnapshot.data().listingRestored === false
        && listingSnapshot.data().visibility === 'inactive'
        && previouslyPublic && listingCanBePublishedNow) {
        transaction.update(listingRef, { visibility: 'active' });
        return {
          listingVisibility: 'active' as const,

          listingCanBePublished: true,
          listingRestored: false,
          finalize: true,
          finalMessage: 'Your provider account has been reactivated, and your public listing is visible to customers again.',
        };
      }

      const actualVisibility = listingSnapshot.data().visibility === 'active' ? 'active' as const : 'inactive' as const;
      const finalMessage = actualVisibility === 'active'
        ? 'Your provider account has been reactivated, and your public listing is visible to customers again.'
        : !listingCanBePublishedNow
          ? 'Your provider account has been reactivated, but your public listing remains hidden because your current verification or listing details do not meet publishing requirements.'
          : listingSnapshot.data().visibility === 'inactive'
            ? 'Your provider account has been reactivated. Your public listing remains hidden; open Public Listing and publish it when ready.'
            : 'Your provider account has been reactivated. You do not have a public listing yet.';
      return {
        listingVisibility: listingSnapshot.data().visibility === 'active' ? 'active' as const : 'inactive' as const,

        listingCanBePublished: listingCanBePublishedNow,
        listingRestored: false,
        finalize: false,
        finalMessage,
      };
    });
    if (!restoreResult.finalize) {
      const { finalize: _finalize, finalMessage, ...result } = restoreResult;
      await updateDoc(notificationRef, {
        message: cleanReason ? `${finalMessage} Reason: ${cleanReason}` : finalMessage,
        updatedAt: serverTimestamp(),
      });
      return result;
    }
    await updateDoc(historyRef, { listingRestored: true });    await updateDoc(notificationRef, {
      message: cleanReason ? `${restoreResult.finalMessage} Reason: ${cleanReason}` : restoreResult.finalMessage,
      updatedAt: serverTimestamp(),
    });
    return { listingVisibility: 'active', listingCanBePublished: true, listingRestored: true };
  } catch {
    const finalMessage = previousSuspensionWasPublic
      ? 'Your provider account has been reactivated, but your listing could not be restored automatically. It remains hidden; open Public Listing to publish it when ready.'
      : 'Your provider account has been reactivated, but your listing remains hidden.';
    try {
      await updateDoc(notificationRef, { message: cleanReason ? `${finalMessage} Reason: ${cleanReason}` : finalMessage, updatedAt: serverTimestamp() });
    } catch { /* The initial notification still truthfully says the listing remains hidden during restoration. */ }
    return { ...initialResult, listingVisibility: 'inactive', listingRestored: false };
  }
}

export function bookingError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return 'Admin data access was denied. Deploy the latest Firestore rules and confirm your admin claim.';
  if (code === 'failed-precondition') return 'Firestore could not run this query. Check the Firebase console for a required index.';
  if (code === 'unavailable') return 'Could not reach Firestore. Check your connection and retry.';
  return error instanceof Error && !code ? error.message : 'Could not load recent bookings. Refresh and try again.';
}
