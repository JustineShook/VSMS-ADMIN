import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import type { Firestore } from 'firebase/firestore';

export const providerRoles = ['onsite-mechanic', 'shop-owner', 'towing-company', 'homegarage'] as const;

/** Active means an existing published listing; reporting does not determine eligibility. */
export async function loadPublishedProviderCounts(db: Firestore): Promise<number[]> {
  const { collection, getCountFromServer, query, where } = await import('firebase/firestore');
  return Promise.all(providerRoles.map(async role => (await getCountFromServer(query(
    collection(db, 'providerListings'), where('visibility', '==', 'active'), where('role', '==', role),
  ))).data().count));
}

export type ReportRange = '7 days' | '30 days' | '90 days';
interface ReportRow { id: string; data: Record<string, unknown> }
export interface ActivityReport {
  period: string;
  bookings: number;
  completed: number;
  activeProviders: number;
  averageRating: number | null;
  reviewCount: number;
  labels: string[];
  intervals: string[];
  trend: number[];
  categories: { label: string; value: number; color: string }[];
}
const dayMs = 86400000;
const offset = 8 * 3600000;
const dateFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
const shortDateFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/** Includes today and the preceding calendar days in Philippine time. */
export function reportWindow(range: ReportRange, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid report date.');
  const days = range === '7 days' ? 7 : range === '30 days' ? 30 : 90;
  const today = Math.floor((now.getTime() + offset) / dayMs) * dayMs - offset;
  return { start: new Date(today - (days - 1) * dayMs), end: now, days };
}

export function completionPercent(report: Pick<ActivityReport, 'bookings' | 'completed'>): number {
  return report.bookings ? Math.round(report.completed / report.bookings * 100) : 0;
}

export function formatReportRating(rating: number | null): string {
  return rating === null ? 'No reviews' : rating.toFixed(1);
}

export function reportCsvRows(report: ActivityReport): string[][] {
  return [
    ['VeResc activity report', report.period],
    ['Metric', 'Value'],
    ['Bookings', String(report.bookings)],
    ['Completed bookings', String(report.completed)],
    ['Completion rate', report.bookings ? `${completionPercent(report)}%` : 'No bookings'],
    ['Active providers (current)', String(report.activeProviders)],
    ['Active provider definition', 'Published listings (visibility: active) for mechanics, shops, towing, and Home Garage; independent of report dates.'],
    ['Average rating (reviews submitted in period)', formatReportRating(report.averageRating)],
    ['Review count', String(report.reviewCount)],
    ['Scope', 'Service bookings created in period, using current status. Parking sessions excluded by current Admin permissions. Reviews use submission dates, including reviews of older bookings and parking sessions.'],
    [],
    ['Provider category', 'Bookings'],
    ...report.categories.map(item => [item.label, String(item.value)]),
    [],
    ['Booking interval (Philippine time)', 'Bookings'],
    ...report.intervals.map((label, index) => [label, String(report.trend[index])]),
  ];
}

export function reportCsv(report: ActivityReport): string {
  return reportCsvRows(report).map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

function timestamp(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
  const date: unknown = value.toDate();
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
}

export function summarizeReport(range: ReportRange, bookings: ReportRow[], reviews: ReportRow[], activeProviders: number, now = new Date()): ActivityReport {
  const { start, end, days } = reportWindow(range, now);
  const bucketDays = range === '7 days' ? 1 : range === '30 days' ? 5 : 15;
  const bucketCount = Math.ceil(days / bucketDays);
  const categories = [
    { role: 'onsite-mechanic', label: 'Onsite Mechanics', value: 0, color: 'bg-brand' },
    { role: 'shop-owner', label: 'Auto Shops', value: 0, color: 'bg-red-300' },
    { role: 'towing-company', label: 'Towing Companies', value: 0, color: 'bg-slate-400' },
    { role: 'homegarage', label: 'Home Garages', value: 0, color: 'bg-amber-400' },
    { role: 'unknown', label: 'Other / unspecified', value: 0, color: 'bg-slate-300' },
  ];
  const trend = Array<number>(bucketCount).fill(0);
  const seen = new Set<string>();
  let completed = 0;
  for (const row of bookings) {
    const createdAt = timestamp(row.data.createdAt);
    if (seen.has(row.id) || createdAt === null || createdAt < start.getTime() || createdAt > end.getTime()) continue;
    seen.add(row.id);
    if (row.data.status === 'completed') completed++;
    const index = Math.floor((createdAt - start.getTime()) / dayMs / bucketDays);
    trend[index]++;
    const category = categories.find(item => item.role === row.data.bookingType) ?? categories[categories.length - 1];
    category.value++;
  }
  const ratings = new Map<string, number>();
  for (const row of reviews) {
    const createdAt = timestamp(row.data.createdAt);
    const rating = row.data.rating;
    if (createdAt !== null && createdAt >= start.getTime() && createdAt <= end.getTime()
      && typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5) ratings.set(row.id, rating);
  }
  const intervals = Array.from({ length: bucketCount }, (_, index) => {
    const first = new Date(start.getTime() + index * bucketDays * dayMs);
    const last = new Date(Math.min(first.getTime() + (bucketDays - 1) * dayMs, end.getTime()));
    return bucketDays === 1 ? dateFormat.format(first) : `${dateFormat.format(first)} – ${dateFormat.format(last)}`;
  });
  return {
    period: `${dateFormat.format(start)} – ${dateFormat.format(end)} · Philippine time`,
    bookings: seen.size, completed, activeProviders,
    averageRating: ratings.size ? Array.from(ratings.values()).reduce((sum, rating) => sum + rating, 0) / ratings.size : null,
    reviewCount: ratings.size,
    labels: Array.from({ length: bucketCount }, (_, index) => shortDateFormat.format(new Date(start.getTime() + index * bucketDays * dayMs))),
    intervals, trend, categories,
  };
}

export async function loadActivityReport(range: ReportRange): Promise<ActivityReport> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }
  const { collection, getDocsFromServer, query, where } = await import('firebase/firestore');
  const db = await getDb();
  const now = new Date();
  const { start, end } = reportWindow(range, now);
  const [bookings, reviews, providers] = await Promise.all([
    getDocsFromServer(query(collection(db, 'bookings'), where('createdAt', '>=', start), where('createdAt', '<=', end))),
    getDocsFromServer(query(collection(db, 'providerReviews'), where('createdAt', '>=', start), where('createdAt', '<=', end))),
    loadPublishedProviderCounts(db),
  ]);
  if (auth?.currentUser?.uid !== user.uid) throw new Error('Administrator session changed. Sign in again.');
  const rows = (snapshot: typeof bookings) => snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
  return summarizeReport(range, rows(bookings), rows(reviews), providers.reduce((sum, count) => sum + count, 0), now);
}
