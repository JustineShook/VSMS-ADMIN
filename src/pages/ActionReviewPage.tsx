import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { bookingError, loadActionRiskQueue, updateProviderAccountStatus, type ActionRiskCase } from '../services/bookings';

function dateLabel(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function actionLabel(item: ActionRiskCase): string {
  return item.eventType === 'owner_cancel_after_acceptance' ? 'Owner cancellation after provider acceptance' : 'Provider declined a pending request';
}

export function ActionReviewPage() {
  const [cases, setCases] = useState<ActionRiskCase[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<ActionRiskCase | null>(null);
  const [reason, setReason] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setCases(await loadActionRiskQueue()); }
    catch (cause) { setError(bookingError(cause)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function saveStatus() {
    if (!selected?.account || working) return;
    const nextStatus = selected.accountStatus === 'suspended' ? 'active' : 'suspended';
    setWorking(`${selected.id}:${selected.eventType}`);
    setError(''); setNotice('');
    try {
      const result = await updateProviderAccountStatus(selected.account, nextStatus, reason);
      setNotice(nextStatus === 'suspended'
        ? `${selected.name} was suspended. Existing bookings were kept in their current state.${selected.role === 'owner' ? '' : ' The public listing was hidden and its previous visibility was recorded.'}`
        : selected.role === 'owner'
          ? `${selected.name} was reactivated.`
          : result.listingVisibility === 'active'
            ? `${selected.name} was reactivated, and the public listing is visible again.`
            : result.listingVisibility === 'missing'
              ? `${selected.name} was reactivated. No public listing is published for this account.`
            : result.listingCanBePublished
              ? `${selected.name} was reactivated. The public listing remains hidden; the provider can publish it from Public Listing.`
              : `${selected.name} was reactivated, but the public listing remains hidden because current publishing requirements are not met.`);
      setSelected(null); setReason('');
      await refresh();
    } catch (cause) { setError(bookingError(cause)); }
    finally { setWorking(null); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">ACCOUNT SAFETY</p><h2 className="text-2xl font-semibold tracking-tight">Action Review</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Accounts with four or more matching actions in the last 30 days appear here. Owner cancellations after acceptance and provider declines are counted separately.</p></div>
      <button className="secondary inline-flex items-center gap-2" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} />Refresh</button>
    </div>
    <div className="notice flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><p>These counts are calculated from booking records on the client. Actions from older app or website versions may not include event fields and can be missing from this review queue.</p></div>
    {error && <p role="alert" className="notice">{error}</p>}
    {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {busy && <p role="status" className="admin-panel p-6 text-sm text-slate-500">Loading recent booking activity…</p>}
    {!busy && !error && cases.length === 0 && <div className="admin-panel p-7 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-600" /><h3 className="mt-3 font-semibold">No accounts need review</h3><p className="mt-1 text-sm text-slate-500">No account has reached four matching actions in the last 30 days.</p></div>}
    {!busy && cases.map(item => {
      const key = `${item.id}:${item.eventType}`;
      const updating = working === key;
      return <section key={key} className="admin-panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><ShieldAlert size={19} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.name}</h3><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-900">{item.count} actions</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.accountStatus === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{item.accountStatus === 'suspended' ? 'Suspended' : 'Active'}</span></div><p className="mt-1 text-xs text-slate-500">{item.role === 'owner' ? 'Vehicle owner' : item.account?.role ?? item.role} · {actionLabel(item)}</p></div></div>
          <button className={item.accountStatus === 'suspended' ? 'secondary' : 'primary'} disabled={!item.account || updating} onClick={() => { setSelected(item); setReason(''); }}>
            {updating ? 'Saving…' : item.accountStatus === 'suspended' ? 'Reactivate account' : 'Review suspension'}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {item.events.map(event => <article key={event.bookingId} className="grid gap-2 p-5 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div><p className="text-sm font-medium text-slate-800">{event.service} · Booking #{event.bookingId}</p><p className="mt-1 text-xs text-slate-500">Status: {event.status.replaceAll('_', ' ')}</p><p className="mt-2 text-sm leading-5 text-slate-700"><span className="font-semibold">Saved reason:</span> {event.reason}</p></div>
            <p className="flex items-start gap-2 text-xs text-slate-500"><Clock3 size={14} className="mt-0.5 shrink-0" />{dateLabel(event.eventAt)}</p>
          </article>)}
        </div>
      </section>;
    })}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="action-review-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><h3 id="action-review-title" className="text-lg font-semibold">{selected.accountStatus === 'suspended' ? 'Reactivate account?' : 'Suspend account?'}</h3><p className="mt-1 text-sm text-slate-500">{selected.name} · {selected.count} matching actions in 30 days</p></div><button className="admin-icon" aria-label="Close" onClick={() => setSelected(null)}><X size={17} /></button></div>
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm leading-5 text-amber-950">Suspension blocks new bookings and provider actions. Existing bookings remain in their current state; eligible owner cancellations and parking session completion remain available for cleanup.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="review-reason">Admin note (optional)</label>
        <textarea id="review-reason" className="field mt-2 min-h-24 resize-y" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Add a note for the account status record" />
        <div className="mt-5 flex justify-end gap-2"><button className="secondary" disabled={working !== null} onClick={() => setSelected(null)}>Cancel</button><button className={selected.accountStatus === 'suspended' ? 'primary' : 'danger'} disabled={working !== null} onClick={() => void saveStatus()}>{working ? 'Saving…' : selected.accountStatus === 'suspended' ? 'Reactivate account' : 'Suspend account'}</button></div>
      </section>
    </div>}
  </div>;
}
