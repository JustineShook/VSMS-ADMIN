import type { Application, ProfileData, ProviderRole } from '../types/verification';

export const roleLabels: Record<ProviderRole, string> = {
  'onsite-mechanic': 'Onsite mechanic', 'shop-owner': 'Auto shop', 'towing-company': 'Towing company', homegarage: 'Home Garage', owner: 'Vehicle owner',
};
export function field(data: ProfileData, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as ProfileData)[key] : undefined, data);
}
export function display(value: unknown): string {
  if (typeof value === 'string') return value.trim() || 'Not provided';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join(', ') || 'Not provided';
  return 'Not provided';
}
export function dateLabel(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toLocaleString();
  }
  return 'Not recorded';
}
export function applicationFrom(path: string, data: ProfileData): Application | null {
  const pieces = path.split('/');
  const legacyShopPath = pieces.length === 2 && pieces[0] === 'providers';
  const role = legacyShopPath ? 'shop-owner'
    : pieces.length === 4 && pieces[0] === 'users' && pieces[3] === 'profile'
      ? pieces[2] === 'providerProfile' ? 'onsite-mechanic' : pieces[2] === 'towingCompanyProfile' ? 'towing-company' : pieces[2] === 'ownerProfile' ? 'owner' : pieces[2] === 'shopVerification' ? 'shop-owner' : pieces[2] === 'homeGarageVerification' ? 'homegarage' : null
      : null;
  if (!role || data.role !== role || data.uid !== pieces[1]) return null;
  const legacy = legacyShopPath && data.verificationStatus === undefined;
  if (legacyShopPath && data.verified !== false) return null;
  if (data.verificationStatus !== 'PENDING' && !legacy) return null;
  const name = role === 'shop-owner' || role === 'homegarage' ? data.businessName ?? field(data, 'personal.fullName') ?? data.name ?? data.displayName
    : role === 'towing-company' ? field(data, 'company.companyName')
      : role === 'owner' ? field(data, 'personal.fullName') ?? data.fullName ?? data.name ?? data.displayName
        : field(data, 'personal.fullName');
  return { path, uid: pieces[1], role, name: display(name), submitted: dateLabel(data.submittedAt), legacy, data };
}
export function sameSubmission(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
// Existing mobile uploads use Cloudinary HTTPS URLs. Older Firebase download URLs
// also work; never render arbitrary schemes or silently send documents to a viewer.
export function documentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'res.cloudinary.com' || url.hostname === 'firebasestorage.googleapis.com') return url.href;
  } catch { /* A missing or unsupported reference is shown as unavailable. */ }
  return null;
}
export function approvalProblem(application: Application): string | null {
  if (application.role !== 'shop-owner') return null;
  const data = application.data;
  if (!['businessName', 'phone', 'address'].every(key => typeof data[key] === 'string' && (data[key] as string).trim())) return 'The shop must complete its business name, phone, and address first.';
  if (data.businessName === 'Unnamed Auto Shop') return 'The shop must replace its registration placeholder name first.';
  const { latitude, longitude } = data;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return 'The shop must save a valid location in its mobile profile first.';
  return null;
}
