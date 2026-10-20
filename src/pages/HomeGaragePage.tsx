import { useCallback, useEffect, useMemo, useState } from 'react';
import { CarFront, RefreshCw, Search } from 'lucide-react';
import { Avatar } from '../components/admin/Avatar';
import { ProviderVerificationProfile } from '../components/admin/ProviderVerificationProfile';
import { auth, getDb } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import { bookingError, updateProviderAccountStatus, type ProviderListing } from '../services/bookings';

interface HomeGarageProvider {
  id: string;
  name: string;
  serviceArea: string;
  availability: string;
  visibility: string;
  accountStatus: 'active' | 'suspended';
  totalSlots: number | null;
  availableSlots: number | null;
  details: Record<string, unknown>;
}

async function loadHomeGarages(): Promise<HomeGarageProvider[]> {
  const user = auth?.currentUser;
  if (!user || !hasAdminClaim((await user.getIdTokenResult()).claims) || auth?.currentUser?.uid !== user.uid) {
    throw new Error('Administrator access could not be verified. Sign in again.');
  }

  const { collection, doc, getDocFromServer, getDocsFromServer, query, where } = await import('firebase/firestore');
  const snapshot = await getDocsFromServer(query(
    collection(await getDb(), 'providerListings'),
    where('role', '==', 'homegarage'),
  ));

  return Promise.all(snapshot.docs.map(async document => {
    const data = document.data();
    const db = await getDb();
    const [account, verification] = await Promise.all([
      getDocFromServer(doc(db, 'users', document.id)),
      getDocFromServer(doc(db, 'users', document.id, 'homeGarageVerification', 'profile')),
    ]);
    if (!verification.exists() || verification.data().verificationStatus !== 'VERIFIED') return null;
    return {
      id: document.id,
      name: typeof data.businessName === 'string' && data.businessName.trim() ? data.businessName.trim() : 'Name not provided',
      serviceArea: typeof data.serviceAreaLabel === 'string' && data.serviceAreaLabel.trim() ? data.serviceAreaLabel.trim() : 'Not provided',
      availability: typeof data.availability === 'string' ? data.availability : 'Unknown',
      visibility: typeof data.visibility === 'string' ? data.visibility : 'Unknown',
      accountStatus: account.data()?.accountStatus === 'suspended' ? 'suspended' as const : 'active' as const,
      totalSlots: Number.isInteger(data.totalSlots) ? data.totalSlots as number : null,
      availableSlots: Number.isInteger(data.availableSlots) ? data.availableSlots as number : null,
      details: data,
    };
  })).then(providers => providers.filter((provider): provider is NonNullable<typeof provider> => provider !== null));
}

export function HomeGaragePage() {
  const [providers, setProviders] = useState<HomeGarageProvider[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<HomeGarageProvider | null>(null);
  const [statusBusy, setStatusBusy] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setProviders(await loadHomeGarages()); }
    catch (reason) { setError(bookingError(reason)); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? providers.filter(provider =>
      [provider.name, provider.id, provider.serviceArea].some(value => value.toLocaleLowerCase().includes(term)),
    ) : providers;
  }, [providers, search]);

  async function changeStatus(provider: HomeGarageProvider) {
    const nextStatus = provider.accountStatus === 'active' ? 'suspended' : 'active';
    const action = nextStatus === 'suspended' ? 'Suspend' : 'Restore';
    const reason = window.prompt(`Optional reason for ${action.toLowerCase()}ing ${provider.name}:`) ?? '';
    if (!window.confirm(`${action} ${provider.name}'s account?${nextStatus === 'suspended' ? ' Their public parking lot listing will be hidden.' : ' Their listing will remain hidden until they republish.'}`)) return;
    setStatusBusy(provider.id);
    setError('');
    try {
      const listing: ProviderListing = {
        id: provider.id,
        name: provider.name,
        role: 'homegarage',
        availability: provider.availability,
        serviceArea: provider.serviceArea,
        services: ['Parking'],
        accountStatus: provider.accountStatus,
        listingVisibility: provider.visibility === 'active' ? 'active' : 'inactive',
      };
      await updateProviderAccountStatus(listing, nextStatus, reason);
      setProviders(current => current.map(row => row.id === provider.id ? {
        ...row,
        accountStatus: nextStatus,
        visibility: nextStatus === 'suspended' ? 'inactive' : row.visibility,
      } : row));
    } catch (reason) { setError(bookingError(reason)); }
    finally { setStatusBusy(''); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">PARKING LOT DIRECTORY</p>
        <h2 className="text-2xl font-semibold tracking-tight">Home Garage</h2>
        <p className="mt-2 text-xs text-slate-500">Parking lot providers and space availability.</p>
      </div>
      <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">LIVE FIRESTORE</span>
    </div>

    <section className="admin-panel min-w-0">
      <div className="admin-section-heading">
        <div><h3>Home Garage providers</h3><p>{busy ? 'Loading parking lots…' : `${visible.length} parking lot${visible.length === 1 ? '' : 's'} found`}</p></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400"><Search size={14} /><input className="w-36 bg-transparent text-xs text-slate-700 outline-none" placeholder="Search providers" aria-label="Search Home Garage providers" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <button className="admin-icon" type="button" onClick={() => void refresh()} disabled={busy} aria-label="Refresh Home Garage providers"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
      {busy && <p role="status" className="px-5 pb-5 text-sm text-slate-500">Loading parking lots from Firestore…</p>}
      {!busy && !error && visible.length === 0 && <div className="px-5 pb-8 text-center">
        <CarFront size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">{providers.length ? 'No providers match your search.' : 'No Home Garage providers found.'}</p>
        {!providers.length && <p className="mt-1 text-xs text-slate-500">Approved and published parking lots will appear here.</p>}
      </div>}
      {!busy && visible.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Home Garage provider directory">
        <table className="admin-table min-w-[960px]">
          <thead><tr>{['Parking lot', 'Firebase UID', 'Spaces', 'Service area', 'Availability', 'Account status', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{visible.map(provider => <tr key={provider.id}>
            <td><span className="flex items-center gap-2"><Avatar name={provider.name} /><button type="button" className="text-left font-medium text-brand underline decoration-transparent underline-offset-2 hover:decoration-current" onClick={() => setSelected(provider)}>{provider.name}</button></span></td>
            <td className="font-mono text-[10px] text-slate-500">{provider.id}</td>
            <td>{provider.availableSlots ?? '—'} available / {provider.totalSlots ?? '—'} total</td>
            <td>{provider.serviceArea}</td>
            <td><span className="capitalize">{provider.availability}</span></td>
            <td><span className={provider.accountStatus === 'active' ? 'text-emerald-700' : 'font-medium text-red-700'}>{provider.accountStatus === 'active' ? 'Active' : 'Suspended'}</span></td>
            <td><button type="button" className={provider.accountStatus === 'active' ? 'secondary' : 'primary'} disabled={!!statusBusy || busy} onClick={() => void changeStatus(provider)}>{statusBusy === provider.id ? 'Saving…' : provider.accountStatus === 'active' ? 'Suspend' : 'Restore'}</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {!busy && providers.length > 0 && <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">Click a parking lot name to view details. Suspending hides the listing; restoring the account does not republish it.</p>}
    </section>
    {selected && <ProviderVerificationProfile provider={{
      id: selected.id,
      name: selected.name,
      role: 'homegarage',
      availability: selected.availability,
      serviceArea: selected.serviceArea,
      services: Array.isArray(selected.details.services) ? selected.details.services.filter((item): item is string => typeof item === 'string') : ['Parking'],
      accountStatus: selected.accountStatus,
      listingVisibility: selected.visibility === 'active' ? 'active' : 'inactive',
    }} onClose={() => setSelected(null)} />}
  </div>;
}
