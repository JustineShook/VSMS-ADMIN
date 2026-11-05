import { useEffect, useMemo, useState } from 'react';
import { Clock3, Search, ShieldAlert, X } from 'lucide-react';
import { subscribeToComplaints, updateComplaintReview } from '../services/complaints';
import type { Complaint, ComplaintStatus } from '../types/complaint';

type Tab = 'All' | ComplaintStatus;
const tabs: Tab[] = ['All', 'Pending', 'Under Review', 'Resolved', 'Dismissed'];
const services: Record<Complaint['bookingType'], string> = {
  'onsite-mechanic': 'Onsite Mechanic', 'towing-company': 'Towing', 'shop-owner': 'Auto Shop', homegarage: 'Home Garage',
};
function displayDate(value?: { toDate: () => Date }) {
  return value ? value.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
function statusStyle(status: ComplaintStatus) {
  if (status === 'Pending') return 'bg-amber-50 text-amber-800';
  if (status === 'Under Review') return 'bg-blue-50 text-blue-700';
  if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

export function ComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    void subscribeToComplaints(setItems, reason => { if (mounted) setError(reason.message); })
      .then(stop => { if (mounted) unsubscribe = stop; else stop(); })
      .catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load complaints.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; unsubscribe?.(); };
  }, []);
  const counts = useMemo(() => ({ All: items.length, Pending: items.filter(item => item.status === 'Pending').length,
    'Under Review': items.filter(item => item.status === 'Under Review').length,
    Resolved: items.filter(item => item.status === 'Resolved').length,
    Dismissed: items.filter(item => item.status === 'Dismissed').length }), [items]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter(item => (tab === 'All' || item.status === tab)
      && (!term || [item.id, item.bookingReference, services[item.bookingType], item.reporterName, item.reportedUserName, item.category].some(value => value.toLocaleLowerCase().includes(term))));
  }, [items, search, tab]);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">TRUST & SAFETY</p><h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ShieldAlert size={23} className="text-brand" />Complaints</h2><p className="mt-2 text-xs text-slate-500">Review concerns reported by vehicle owners and providers.</p></div><span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-emerald-900"><ShieldAlert size={14} />LIVE REPORTS</span></header>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="admin-panel min-w-0"><div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter complaints by status">{tabs.map(status => <button key={status} type="button" role="tab" aria-selected={tab === status} onClick={() => setTab(status)} className={`rounded-md px-3 py-2 text-xs font-medium ${tab === status ? 'bg-red-50 text-brand' : 'text-slate-500 hover:bg-slate-50'}`}>{status}<span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${tab === status ? 'bg-white' : 'bg-slate-100'}`}>{counts[status]}</span></button>)}</div><label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400"><Search size={14} /><input className="w-full bg-transparent text-xs text-slate-700 outline-none sm:w-60" placeholder="Search complaints…" aria-label="Search complaints" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      {loading ? <div className="px-5 py-14 text-center text-sm text-slate-500">Loading reports…</div> : visible.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Search size={18} /></div><h3 className="mt-3 text-sm font-semibold text-slate-700">No complaints found</h3><p className="mt-1 text-xs text-slate-500">Try another status tab or search term.</p></div> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Complaints list"><table className="admin-table min-w-[1120px]"><thead><tr>{['Booking reference', 'Service type', 'Reporter', 'Reported user', 'Category', 'Date', 'Status', ''].map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><button type="button" className="font-mono font-medium text-brand underline decoration-transparent underline-offset-2 hover:decoration-current" onClick={() => setSelected(item)}>{item.bookingReference}</button><span className="mt-1 block text-[9px] text-slate-400">{item.id}</span></td><td>{services[item.bookingType]}</td><td><span className="block font-medium text-slate-700">{item.reporterName}</span><span className="text-[10px] text-slate-400">{item.reporterType}</span></td><td><span className="block font-medium text-slate-700">{item.reportedUserName}</span><span className="text-[10px] text-slate-400">{item.reporterType === 'Provider' ? 'Vehicle Owner' : 'Provider'}</span></td><td>{item.category}</td><td>{displayDate(item.createdAt)}</td><td><span className={`rounded px-2 py-1 text-[10px] font-medium ${statusStyle(item.status)}`}>{item.status}</span></td><td><button type="button" className="secondary whitespace-nowrap" onClick={() => setSelected(item)}>View Details</button></td></tr>)}</tbody></table></div>}
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">{visible.length} of {counts[tab]} live reports · Reviews are saved to Firestore.</div>
    </section>
    {selected && <ComplaintDetails complaint={selected} onClose={() => setSelected(null)} onSaved={item => { setItems(current => current.map(row => row.id === item.id ? item : row)); setSelected(item); }} />}
  </div>;
}

function ComplaintDetails({ complaint, onClose, onSaved }: { complaint: Complaint; onClose: () => void; onSaved: (item: Complaint) => void }) {
  const [mode, setMode] = useState<ComplaintStatus | null>(null);
  const [note, setNote] = useState(complaint.adminNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(status: ComplaintStatus) {
    if ((status === 'Resolved' || status === 'Dismissed') && !note.trim()) { setError('Add an admin note before saving this decision.'); return; }
    setSaving(true); setError('');
    try {
      await updateComplaintReview(complaint.id, status, note);
      onSaved({ ...complaint, status, adminNote: note.trim() });
      setMode(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the review.'); }
    finally { setSaving(false); }
  }
  return <dialog open aria-labelledby="complaint-title" className="fixed inset-0 z-50 m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-[820px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5"><div><div className="flex flex-wrap items-center gap-2"><h2 id="complaint-title" className="text-lg font-semibold">Complaint {complaint.id}</h2><span className={`rounded px-2 py-1 text-[10px] font-medium ${statusStyle(complaint.status)}`}>{complaint.status}</span></div><p className="mt-1 text-xs text-slate-500">{complaint.bookingReference} · {services[complaint.bookingType]} · {displayDate(complaint.createdAt)}</p></div><button type="button" className="admin-icon" onClick={onClose} aria-label="Close complaint details"><X size={19} /></button></div>
    <div className="space-y-5 p-5"><section><h3 className="mb-2 text-sm font-semibold">Report explanation</h3><p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{complaint.explanation}</p></section><section className="grid gap-4 sm:grid-cols-2"><Info title="Reporter" name={complaint.reporterName} detail={complaint.reporterType} /><Info title="Reported user" name={complaint.reportedUserName} detail={complaint.reporterType === 'Provider' ? 'Vehicle Owner' : 'Provider'} /><Info title="Related booking" name={complaint.bookingReference} detail={`${services[complaint.bookingType]} · ${complaint.bookingStatusAtSubmission}`} /><Info title="Category" name={complaint.category} detail={`Submitted ${displayDate(complaint.createdAt)}`} /></section><section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} className="text-slate-400" />Admin note</h3><textarea className="field min-h-24" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="Required when resolving or dismissing a report." /></section>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!mode && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">{complaint.status === 'Pending' && <button type="button" className="primary" disabled={saving} onClick={() => void save('Under Review')}>Start Review</button>}{complaint.status === 'Under Review' && <><button type="button" className="secondary" onClick={() => setMode('Dismissed')}>Dismiss</button><button type="button" className="primary" onClick={() => setMode('Resolved')}>Resolve</button></>}</div>}
      {mode && <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="secondary" onClick={() => setMode(null)}>Cancel</button><button type="button" className="primary" disabled={saving || !note.trim()} onClick={() => void save(mode)}>{saving ? 'Saving…' : `Confirm ${mode}`}</button></div>}
    </div>
  </dialog>;
}
function Info({ title, name, detail }: { title: string; name: string; detail: string }) { return <div className="rounded-md border border-slate-100 p-4"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3><p className="mt-2 text-sm font-medium text-slate-800">{name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>; }
