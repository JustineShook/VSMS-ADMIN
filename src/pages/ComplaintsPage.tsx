import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Image, Search, ShieldAlert, X } from 'lucide-react';

type ComplaintStatus = 'Pending' | 'Under Review' | 'Resolved' | 'Dismissed';
type Outcome = 'No Account Action' | 'Issue Warning' | 'Suspend Account';
type Tab = 'All' | ComplaintStatus;

interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  note: string;
}

interface Complaint {
  id: string;
  bookingRef: string;
  service: 'Onsite Mechanic' | 'Auto Shop' | 'Towing' | 'Home Garage';
  reporter: string;
  reporterType: 'Vehicle Owner' | 'Provider';
  reportedUser: string;
  reportedType: 'Vehicle Owner' | 'Provider';
  reason: string;
  date: string;
  status: ComplaintStatus;
  description: string;
  evidence: string[];
  booking: string;
  response: string;
  history: HistoryEntry[];
  resolutionNote?: string;
  outcome?: Outcome;
  dismissalReason?: string;
}

const initialComplaints: Complaint[] = [
  {
    id: 'CMP-2084', bookingRef: 'VR-10482', service: 'Onsite Mechanic', reporter: 'Mara Villanueva', reporterType: 'Vehicle Owner',
    reportedUser: 'Northside Mobile Repair', reportedType: 'Provider', reason: 'Service not completed', date: '2026-10-18T10:35:00', status: 'Pending',
    description: 'The mechanic marked the job complete before finishing the brake inspection. I was charged for a service that was not completed and could not get a response afterward.',
    evidence: ['Dashboard warning photo', 'Conversation screenshot'], booking: 'Brake inspection · 2018 Toyota Vios · Quezon City',
    response: 'No response submitted yet.', history: [{ at: 'Oct 18, 2026 · 10:35 AM', actor: 'Mara Villanueva', action: 'Complaint submitted', note: 'Reported through the booking.' }],
  },
  {
    id: 'CMP-2079', bookingRef: 'VR-10461', service: 'Auto Shop', reporter: 'Prime Auto Care', reporterType: 'Provider',
    reportedUser: 'Rafael Dizon', reportedType: 'Vehicle Owner', reason: 'Customer no-show', date: '2026-10-17T16:20:00', status: 'Under Review',
    description: 'The customer confirmed the appointment but did not arrive. The shop held a service bay for more than an hour and could not reach them.',
    evidence: ['Appointment log'], booking: 'Engine diagnostics · 2020 Honda City · Marikina',
    response: 'I contacted the shop to reschedule and explained that I had a family emergency.',
    history: [{ at: 'Oct 17, 2026 · 4:20 PM', actor: 'Prime Auto Care', action: 'Complaint submitted', note: 'Reported through the booking.' }, { at: 'Oct 17, 2026 · 5:05 PM', actor: 'Demo Admin', action: 'Review started', note: 'Complaint moved to Under Review.' }],
  },
  {
    id: 'CMP-2075', bookingRef: 'VR-10433', service: 'Towing', reporter: 'Jonas Mercado', reporterType: 'Vehicle Owner',
    reportedUser: 'Rapid Response Towing', reportedType: 'Provider', reason: 'Unexpected price change', date: '2026-10-17T09:12:00', status: 'Pending',
    description: 'The final amount requested at pickup was much higher than the estimate in the booking. I was not told about the extra charges before the tow.',
    evidence: ['Booking estimate screenshot', 'Receipt photo'], booking: 'Flatbed towing · 2016 Mitsubishi Mirage · Pasig to Mandaluyong',
    response: 'No response submitted yet.', history: [{ at: 'Oct 17, 2026 · 9:12 AM', actor: 'Jonas Mercado', action: 'Complaint submitted', note: 'Reported through the booking.' }],
  },
  {
    id: 'CMP-2068', bookingRef: 'VR-10397', service: 'Home Garage', reporter: 'Eastview Home Garage', reporterType: 'Provider',
    reportedUser: 'Trina Ramos', reportedType: 'Vehicle Owner', reason: 'Property damage', date: '2026-10-16T14:48:00', status: 'Resolved',
    description: 'A vehicle left oil stains on the reserved parking space. The owner and garage agreed on a cleaning arrangement.',
    evidence: ['Parking space photo'], booking: 'Reserved parking · 2019 Suzuki Ertiga · Antipolo',
    response: 'I agreed to cover the cleaning service after seeing the garage photos.',
    history: [{ at: 'Oct 16, 2026 · 2:48 PM', actor: 'Eastview Home Garage', action: 'Complaint submitted', note: 'Reported through the booking.' }, { at: 'Oct 16, 2026 · 3:10 PM', actor: 'Demo Admin', action: 'Review started', note: 'Both parties were contacted.' }, { at: 'Oct 16, 2026 · 4:02 PM', actor: 'Demo Admin', action: 'Complaint resolved', note: 'No Account Action · Parties agreed on cleaning.' }],
    resolutionNote: 'Both parties agreed on a cleaning arrangement.', outcome: 'No Account Action',
  },
  {
    id: 'CMP-2051', bookingRef: 'VR-10354', service: 'Auto Shop', reporter: 'Liza Bautista', reporterType: 'Vehicle Owner',
    reportedUser: 'Cityline Auto Shop', reportedType: 'Provider', reason: 'Other', date: '2026-10-15T11:03:00', status: 'Dismissed',
    description: 'I could not find the shop entrance and thought the provider had moved without updating the listing.',
    evidence: [], booking: 'Tire replacement · 2021 Nissan Almera · San Juan',
    response: 'The entrance is inside the service lane shown in the listing. We called twice but could not reach the customer.',
    history: [{ at: 'Oct 15, 2026 · 11:03 AM', actor: 'Liza Bautista', action: 'Complaint submitted', note: 'Reported through the booking.' }, { at: 'Oct 15, 2026 · 11:40 AM', actor: 'Demo Admin', action: 'Review started', note: 'Contact details and listing were checked.' }, { at: 'Oct 15, 2026 · 12:16 PM', actor: 'Demo Admin', action: 'Complaint dismissed', note: 'No provider fault found; listing directions were accurate.' }],
    dismissalReason: 'No provider fault found; listing directions were accurate.',
  },
  {
    id: 'CMP-2044', bookingRef: 'VR-10320', service: 'Towing', reporter: 'MetroTow Services', reporterType: 'Provider',
    reportedUser: 'Paolo Navarro', reportedType: 'Vehicle Owner', reason: 'Abusive behavior', date: '2026-10-14T18:22:00', status: 'Under Review',
    description: 'The customer sent repeated insulting messages after the driver explained that traffic had delayed arrival.',
    evidence: ['Message thread screenshot'], booking: 'Wheel-lift towing · 2015 Ford Fiesta · Caloocan',
    response: 'I was frustrated because the arrival time changed twice. I should not have sent those messages.',
    history: [{ at: 'Oct 14, 2026 · 6:22 PM', actor: 'MetroTow Services', action: 'Complaint submitted', note: 'Reported through the booking.' }, { at: 'Oct 14, 2026 · 6:55 PM', actor: 'Demo Admin', action: 'Review started', note: 'Complaint moved to Under Review.' }],
  },
  {
    id: 'CMP-2038', bookingRef: 'VR-10288', service: 'Home Garage', reporter: 'Noel Garcia', reporterType: 'Vehicle Owner',
    reportedUser: 'Greenview Parking Garage', reportedType: 'Provider', reason: 'Reserved space unavailable', date: '2026-10-13T08:40:00', status: 'Pending',
    description: 'The reserved space was occupied when I arrived. The attendant asked me to wait but there was no alternative space available.',
    evidence: ['Occupied parking slot photo'], booking: 'Overnight parking · 2022 Toyota Raize · Taguig',
    response: 'No response submitted yet.', history: [{ at: 'Oct 13, 2026 · 8:40 AM', actor: 'Noel Garcia', action: 'Complaint submitted', note: 'Reported through the booking.' }],
  },
  {
    id: 'CMP-2017', bookingRef: 'VR-10214', service: 'Onsite Mechanic', reporter: 'Alex Mobile Mechanic', reporterType: 'Provider',
    reportedUser: 'Celine Flores', reportedType: 'Vehicle Owner', reason: 'Payment dispute', date: '2026-10-10T13:15:00', status: 'Resolved',
    description: 'The owner disputed the call-out fee after the mechanic had already travelled to the location.',
    evidence: ['Service estimate screenshot'], booking: 'Battery replacement · 2017 Honda BR-V · Las Piñas',
    response: 'I misunderstood the call-out fee and paid it after the mechanic explained the estimate.',
    history: [{ at: 'Oct 10, 2026 · 1:15 PM', actor: 'Alex Mobile Mechanic', action: 'Complaint submitted', note: 'Reported through the booking.' }, { at: 'Oct 10, 2026 · 1:42 PM', actor: 'Demo Admin', action: 'Review started', note: 'The submitted estimate was reviewed.' }, { at: 'Oct 10, 2026 · 2:03 PM', actor: 'Demo Admin', action: 'Complaint resolved', note: 'No Account Action · Owner confirmed payment.' }],
    resolutionNote: 'Owner confirmed the call-out fee was included in the estimate.', outcome: 'No Account Action',
  },
];

const tabs: Tab[] = ['All', 'Pending', 'Under Review', 'Resolved', 'Dismissed'];
const outcomes: Outcome[] = ['No Account Action', 'Issue Warning', 'Suspend Account'];

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusStyle(status: ComplaintStatus) {
  if (status === 'Pending') return 'bg-amber-50 text-amber-800';
  if (status === 'Under Review') return 'bg-blue-50 text-blue-700';
  if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

export function ComplaintsPage() {
  const [complaints, setComplaints] = useState(initialComplaints);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = complaints.find(complaint => complaint.id === selectedId) ?? null;
  const counts = useMemo(() => ({
    All: complaints.length,
    Pending: complaints.filter(item => item.status === 'Pending').length,
    'Under Review': complaints.filter(item => item.status === 'Under Review').length,
    Resolved: complaints.filter(item => item.status === 'Resolved').length,
    Dismissed: complaints.filter(item => item.status === 'Dismissed').length,
  }), [complaints]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return complaints.filter(item => (tab === 'All' || item.status === tab) && (!term || [item.id, item.bookingRef, item.service, item.reporter, item.reportedUser, item.reason].some(value => value.toLocaleLowerCase().includes(term))));
  }, [complaints, search, tab]);

  function updateComplaint(id: string, update: (complaint: Complaint) => Complaint) {
    setComplaints(current => current.map(complaint => complaint.id === id ? update(complaint) : complaint));
  }

  function addHistory(action: string, note: string): HistoryEntry {
    return { at: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), actor: 'Demo Admin', action, note };
  }

  function startReview(complaint: Complaint) {
    updateComplaint(complaint.id, current => ({
      ...current,
      status: 'Under Review',
      history: [...current.history, addHistory('Review started', 'Complaint moved to Under Review.')],
    }));
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">TRUST & SAFETY</p><h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ShieldAlert size={23} className="text-brand" />Complaints</h2><p className="mt-2 text-xs text-slate-500">Review concerns reported by vehicle owners and providers.</p></div>
      <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-amber-900"><AlertTriangle size={14} />DEMO / MOCK DATA</span>
    </header>

    <section className="admin-panel min-w-0">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter complaints by status">
          {tabs.map(status => <button key={status} type="button" role="tab" aria-selected={tab === status} onClick={() => setTab(status)} className={`rounded-md px-3 py-2 text-xs font-medium ${tab === status ? 'bg-red-50 text-brand' : 'text-slate-500 hover:bg-slate-50'}`}>
            {status}<span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${tab === status ? 'bg-white' : 'bg-slate-100'}`}>{counts[status]}</span>
          </button>)}
        </div>
        <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400">
          <Search size={14} /><input className="w-full bg-transparent text-xs text-slate-700 outline-none sm:w-60" placeholder="Search complaints…" aria-label="Search complaints" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>
      {visible.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Search size={18} /></div><h3 className="mt-3 text-sm font-semibold text-slate-700">No complaints found</h3><p className="mt-1 text-xs text-slate-500">Try another status tab or search term.</p></div> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Complaints list">
        <table className="admin-table min-w-[1120px]">
          <thead><tr>{['Booking reference', 'Service type', 'Reporter', 'Reported user', 'Reason', 'Date', 'Status', ''].map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr></thead>
          <tbody>{visible.map(item => <tr key={item.id}>
            <td><button type="button" className="font-mono font-medium text-brand underline decoration-transparent underline-offset-2 hover:decoration-current" onClick={() => setSelectedId(item.id)}>{item.bookingRef}</button><span className="mt-1 block text-[9px] text-slate-400">{item.id}</span></td>
            <td>{item.service}</td><td><span className="block font-medium text-slate-700">{item.reporter}</span><span className="text-[10px] text-slate-400">{item.reporterType}</span></td>
            <td><span className="block font-medium text-slate-700">{item.reportedUser}</span><span className="text-[10px] text-slate-400">{item.reportedType}</span></td>
            <td>{item.reason}</td><td>{dateLabel(item.date)}</td><td><span className={`rounded px-2 py-1 text-[10px] font-medium ${statusStyle(item.status)}`}>{item.status}</span></td>
            <td><button type="button" className="secondary whitespace-nowrap" onClick={() => setSelectedId(item.id)}>View Details</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">{visible.length} of {counts[tab]} mock complaints · Actions are temporary and reset when the page reloads.</div>
    </section>
    {selected && <ComplaintDetails key={selected.id} complaint={selected} onClose={() => setSelectedId(null)} onStartReview={() => startReview(selected)} onUpdate={updateComplaint} addHistory={addHistory} />}
  </div>;
}

function ComplaintDetails({ complaint, onClose, onStartReview, onUpdate, addHistory }: {
  complaint: Complaint;
  onClose: () => void;
  onStartReview: () => void;
  onUpdate: (id: string, update: (complaint: Complaint) => Complaint) => void;
  addHistory: (action: string, note: string) => HistoryEntry;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'resolve' | 'dismiss' | null>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('No Account Action');
  useEffect(() => { dialog.current?.showModal(); }, []);

  function resolve() {
    const cleanNote = note.trim();
    if (!cleanNote) return;
    if (outcome === 'Suspend Account' && !window.confirm(`Simulate suspending ${complaint.reportedUser}'s account? This demo action will not affect any real account.`)) return;
    onUpdate(complaint.id, current => ({
      ...current,
      status: 'Resolved',
      resolutionNote: cleanNote,
      outcome,
      history: [...current.history, addHistory('Complaint resolved', `${outcome} · ${cleanNote}${outcome === 'Suspend Account' ? ' (simulated only; no account changed)' : ''}`)],
    }));
    setMode(null);
    setNote('');
  }

  function dismiss() {
    const cleanReason = note.trim();
    if (!cleanReason) return;
    onUpdate(complaint.id, current => ({
      ...current,
      status: 'Dismissed',
      dismissalReason: cleanReason,
      history: [...current.history, addHistory('Complaint dismissed', cleanReason)],
    }));
    setMode(null);
    setNote('');
  }

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="complaint-title" className="m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-[820px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
      <div><div className="flex flex-wrap items-center gap-2"><h2 id="complaint-title" className="text-lg font-semibold">Complaint {complaint.id}</h2><span className={`rounded px-2 py-1 text-[10px] font-medium ${statusStyle(complaint.status)}`}>{complaint.status}</span></div><p className="mt-1 text-xs text-slate-500">{complaint.bookingRef} · {complaint.service} · {dateLabel(complaint.date)}</p></div>
      <button type="button" className="admin-icon" onClick={onClose} aria-label="Close complaint details"><X size={19} /></button>
    </div>
    <div className="space-y-5 p-5">
      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Demo only.</strong> These actions change mock data in this page only. They do not affect real accounts, bookings, listings, or notifications.</p>
      <section><h3 className="mb-2 text-sm font-semibold">Complaint description</h3><p className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{complaint.description}</p></section>
      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="Reporter" name={complaint.reporter} detail={complaint.reporterType} />
        <InfoCard title="Reported user" name={complaint.reportedUser} detail={complaint.reportedType} />
        <InfoCard title="Related booking" name={complaint.bookingRef} detail={complaint.booking} />
        <InfoCard title="Complaint reason" name={complaint.reason} detail={`Submitted ${dateLabel(complaint.date)}`} />
      </section>
      {complaint.evidence.length > 0 && <section><h3 className="mb-3 text-sm font-semibold">Evidence provided</h3><div className="grid gap-3 sm:grid-cols-2">{complaint.evidence.map((item, index) => <div key={item} className={`flex min-h-32 items-end rounded-md border border-slate-200 p-3 ${index % 2 ? 'bg-gradient-to-br from-slate-100 via-red-50 to-slate-200' : 'bg-gradient-to-br from-amber-50 via-slate-100 to-red-100'}`}><div className="flex items-center gap-2 rounded bg-white/90 px-2.5 py-2 text-xs text-slate-600"><Image size={14} className="text-brand" />{item}<span className="text-[9px] text-slate-400">Mock preview</span></div></div>)}</div></section>}
      <section><h3 className="mb-2 text-sm font-semibold">Reported party response</h3><p className="rounded-md border border-slate-100 p-4 text-sm leading-6 text-slate-600">{complaint.response}</p></section>
      {(complaint.resolutionNote || complaint.dismissalReason) && <section className="rounded-md border border-slate-200 p-4"><h3 className="text-sm font-semibold">Decision record</h3>{complaint.outcome && <p className="mt-2 text-xs text-slate-600">Outcome: <strong>{complaint.outcome}</strong></p>}<p className="mt-1 text-sm leading-6 text-slate-600">{complaint.resolutionNote || complaint.dismissalReason}</p></section>}
      <section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} className="text-slate-400" />Review history</h3><ol className="space-y-3 border-l border-slate-200 pl-4">{complaint.history.map((entry, index) => <li key={`${entry.at}-${index}`} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand ring-1 ring-slate-200" /><p className="text-xs font-medium text-slate-700">{entry.action} <span className="font-normal text-slate-400">· {entry.actor}</span></p><p className="mt-1 text-[10px] text-slate-400">{entry.at}</p><p className="mt-1 text-xs leading-5 text-slate-500">{entry.note}</p></li>)}</ol></section>
      {complaint.status === 'Pending' && <div className="flex justify-end border-t border-slate-100 pt-4"><button type="button" className="primary" onClick={onStartReview}>Start Review</button></div>}
      {complaint.status === 'Under Review' && !mode && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="secondary" onClick={() => { setMode('dismiss'); setNote(''); }}>Dismiss</button><button type="button" className="primary" onClick={() => { setMode('resolve'); setNote(''); }}>Resolve</button></div>}
      {mode === 'resolve' && <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold">Resolve complaint</h3>
        <label className="block text-xs font-medium text-slate-600">Outcome<select className="field mt-1" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}>{outcomes.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="block text-xs font-medium text-slate-600">Resolution note<textarea className="field mt-1 min-h-20" value={note} onChange={event => setNote(event.target.value)} placeholder="Summarize the decision and any follow-up." maxLength={500} /></label>
        {outcome === 'Suspend Account' && <p className="text-xs text-amber-800">Suspension is a simulated demo outcome and will not change a real account.</p>}
        <div className="flex justify-end gap-2"><button type="button" className="secondary" onClick={() => setMode(null)}>Cancel</button><button type="button" className="primary" disabled={!note.trim()} onClick={resolve}>Confirm Resolution</button></div>
      </div>}
      {mode === 'dismiss' && <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold">Dismiss complaint</h3>
        <label className="block text-xs font-medium text-slate-600">Dismissal reason<textarea className="field mt-1 min-h-20" value={note} onChange={event => setNote(event.target.value)} placeholder="Explain why this complaint is being dismissed." maxLength={500} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="secondary" onClick={() => setMode(null)}>Cancel</button><button type="button" className="primary" disabled={!note.trim()} onClick={dismiss}>Confirm Dismissal</button></div>
      </div>}
    </div>
  </dialog>;
}

function InfoCard({ title, name, detail }: { title: string; name: string; detail: string }) {
  return <div className="rounded-md border border-slate-100 p-4"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3><p className="mt-2 text-sm font-medium text-slate-800">{name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}
