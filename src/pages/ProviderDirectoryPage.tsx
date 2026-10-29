import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { bookingError, loadProviderDirectory, updateProviderAccountStatus, type ProviderDirectoryRole, type ProviderListing } from '../services/bookings';
import { Avatar } from '../components/admin/Avatar';
import { ProviderVerificationProfile } from '../components/admin/ProviderVerificationProfile';

const configuration: Record<ProviderDirectoryRole, { title: string; description: string }> = {
  'onsite-mechanic': { title: 'Onsite Mechanics', description: 'Published onsite mechanic providers and their service areas.' },
  'shop-owner': { title: 'Auto Shops', description: 'Published auto shop providers and their service areas.' },
  'towing-company': { title: 'Towing Companies', description: 'Published towing providers and their service areas.' },
  homegarage: { title: 'Home Garage', description: 'Published Home Garage parking providers and their spaces.' },
  owner: { title: 'Vehicle Owners', description: 'Vehicle owner accounts and their submitted profile details.' },
};

export function ProviderDirectoryPage({ role }: { role: ProviderDirectoryRole }) {
  const [rows, setRows] = useState<ProviderListing[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [statusBusy, setStatusBusy] = useState('');
  const [error, setError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderListing | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setRows(await loadProviderDirectory(role)); }
    catch (err) { setError(bookingError(err)); }
    finally { setBusy(false); }
  }, [role]);
  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? rows.filter(row => [row.name, row.serviceArea, ...row.services].some(value => value.toLocaleLowerCase().includes(term))) : rows;
  }, [rows, search]);
  const page = configuration[role];

  async function changeStatus(provider: ProviderListing) {
    const nextStatus = provider.accountStatus === 'active' ? 'suspended' : 'active';
    const action = nextStatus === 'suspended' ? 'Suspend' : 'Restore';
    const reason = window.prompt(`Optional reason for ${action.toLowerCase()}ing ${provider.name}:`) ?? '';
    const effect = role === 'owner'
      ? (nextStatus === 'suspended' ? 'They will no longer be able to use their account.' : 'They will be able to use their account again.')
      : (nextStatus === 'suspended'
        ? 'Their public listing will be hidden, and its current visibility will be recorded.'
        : 'A listing that was public before this suspension will be restored only if the provider still meets publishing requirements. A listing that was already hidden will stay hidden.');
    if (!window.confirm(`${action} ${provider.name}'s account? ${effect}`)) return;
    setStatusBusy(provider.id);
    setError('');
    try {
      const result = await updateProviderAccountStatus(provider, nextStatus, reason);
      setRows(current => current.map(row => row.id === provider.id ? {
        ...row,
        accountStatus: nextStatus,
        listingVisibility: role === 'owner' ? row.listingVisibility
          : result.listingVisibility === 'active' ? 'active'
            : result.listingVisibility === 'missing' ? 'missing' : 'inactive',
      } : row));
    } catch (err) { setError(bookingError(err)); }
    finally { setStatusBusy(''); }
  }


  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">PROVIDER DIRECTORY</p><h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2><p className="mt-2 text-xs text-slate-500">{page.description}</p></div><span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">LIVE FIRESTORE</span></div>
    <section className="admin-panel min-w-0">
      <div className="admin-section-heading"><div><h3>Provider accounts</h3><p>{busy ? 'Loading providers…' : `${visibleRows.length} provider${visibleRows.length === 1 ? '' : 's'} found`}</p></div><div className="flex items-center gap-2"><label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400"><Search size={14} /><input className="w-36 bg-transparent text-xs text-slate-700 outline-none" placeholder="Search providers" aria-label="Search providers" value={search} onChange={event => setSearch(event.target.value)} /></label><button className="admin-icon" onClick={() => void load()} disabled={busy || !!statusBusy} aria-label="Refresh provider list"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /></button></div></div>
      {error && <p role="alert" className="notice mx-5 mb-4">{error}</p>}
      {busy && <p role="status" className="px-5 pb-5 text-sm text-slate-500">Loading providers from Firestore…</p>}
      {!busy && !error && visibleRows.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">{rows.length ? 'No providers match your search.' : 'No active published providers in this category yet.'}</p>}
      {!busy && visibleRows.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${page.title} directory`}><table className={`admin-table ${role === 'owner' ? 'min-w-[680px]' : 'min-w-[1030px]'}`}><thead><tr>{(role === 'owner' ? ['Vehicle owner', 'Phone', 'Account status', 'Action'] : ['Provider', 'Account status', 'Listing', 'Service area', 'Services', 'Availability', 'Action']).map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.id}><td><span className="flex items-center gap-2"><Avatar name={row.name} /><span><button className="block text-left font-medium text-brand underline decoration-transparent underline-offset-2 hover:decoration-current" onClick={() => setSelectedProvider(row)}>{row.name}</button><span className="font-mono text-[9px] text-slate-400">{row.id}</span></span></span></td>{role === 'owner' ? <><td>{row.phone || 'Not provided'}</td><td><span className={row.accountStatus === 'active' ? 'text-emerald-700' : 'font-medium text-red-700'}>{row.accountStatus === 'active' ? 'Active' : 'Suspended'}</span></td><td><button className={row.accountStatus === 'active' ? 'secondary' : 'primary'} disabled={!!statusBusy || busy} onClick={() => void changeStatus(row)}>{statusBusy === row.id ? 'Saving…' : row.accountStatus === 'active' ? 'Suspend' : 'Restore'}</button></td></> : <><td><span className={row.accountStatus === 'active' ? 'text-emerald-700' : 'font-medium text-red-700'}>{row.accountStatus === 'active' ? 'Active' : 'Suspended'}</span></td><td><span className="capitalize">{row.listingVisibility === 'missing' ? 'Not published' : row.listingVisibility}</span></td><td>{row.serviceArea}</td><td className="max-w-72 whitespace-normal">{row.services.join(', ') || 'Not provided'}</td><td><span className="capitalize">{row.availability}</span></td><td className="space-y-1"><button className={row.accountStatus === 'active' ? 'secondary' : 'primary'} disabled={!!statusBusy || busy} onClick={() => void changeStatus(row)}>{statusBusy === row.id ? 'Saving…' : row.accountStatus === 'active' ? 'Suspend' : 'Restore'}</button></td></>}</tr>)}</tbody></table></div>}
    </section>
    {selectedProvider && <ProviderVerificationProfile key={selectedProvider.id} provider={selectedProvider} onClose={() => setSelectedProvider(null)} />}
  </div>;
}
