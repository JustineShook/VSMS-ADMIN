export type ProviderRole = 'onsite-mechanic' | 'shop-owner' | 'towing-company';
export type ProfileData = Record<string, unknown>;
export interface Application {
  path: string;
  uid: string;
  role: ProviderRole;
  name: string;
  submitted: string;
  legacy: boolean;
  data: ProfileData;
}
