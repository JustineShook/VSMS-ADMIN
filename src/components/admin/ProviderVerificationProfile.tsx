import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { bookingError, loadProviderDemoSubscription, loadProviderVerificationData } from '../../services/bookings';
import type { ProviderListing } from '../../services/bookings';
import { display, documentUrl } from '../../lib/verification';

function labelFor(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^\w/, value => value.toUpperCase());
}

function timestamp(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toLocaleString();
  }
  return null;
}

function ProfileFields({ data, prefix = '' }: { data: Record<string, unknown>; prefix?: string }) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null);
  const nested = entries.filter(([, value]) => value !== null && typeof value === 'object' && !Array.isArray(value) && !('toDate' in value));
  const arrays = entries.filter(([, value]) => Array.isArray(value));
  const scalars = entries.filter(([, value]) => !Array.isArray(value) && (typeof value !== 'object' || (value !== null && 'toDate' in value)));

  return <div className="space-y-4">
    {scalars.length > 0 && <dl className="grid gap-4 sm:grid-cols-2">{scalars.map(([key, value]) => {
      const nestedTimestamp = timestamp(value);
      const safeUrl = documentUrl(value);
      return <div key={`${prefix}${key}`}><dt className="text-xs text-slate-500">{labelFor(key)}</dt><dd className="mt-1 break-words text-sm">{nestedTimestamp ?? (safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-1 text-brand underline">Open submitted file <ExternalLink size={13} /></a> : display(value))}</dd></div>;
    })}</dl>}
    {arrays.map(([key, value]) => <div key={`${prefix}${key}`}><h4 className="mb-2 text-xs font-medium text-slate-500">{labelFor(key)}</h4><p className="break-words text-sm">{Array.isArray(value) ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : display(item)).join(', ') || 'Not provided' : display(value)}</p></div>)}
    {nested.map(([key, value]) => <section key={`${prefix}${key}`} className="rounded-md border border-slate-100 p-4"><h4 className="mb-3 text-sm font-semibold">{labelFor(key)}</h4><ProfileFields data={value as Record<string, unknown>} prefix={`${prefix}${key}.`} /></section>)}
  </div>;
}

export function ProviderVerificationProfile({ provider, onClose }: { provider: ProviderListing; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [subscription, setSubscription] = useState<Awaited<ReturnType<typeof loadProviderDemoSubscription>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      loadProviderVerificationData(provider),
      provider.role === 'owner' ? Promise.resolve(null) : loadProviderDemoSubscription(provider),
    ]).then(([value, subscriptionValue]) => { if (active) { setData(value); setSubscription(subscriptionValue); } }, reason => { if (active) setError(bookingError(reason)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [provider]);

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="provider-profile-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[760px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5"><div><h2 id="provider-profile-title" className="text-lg font-semibold">{provider.name}</h2><p className="mt-1 text-xs text-slate-500">Submitted verification profile · {provider.role}</p></div><button className="admin-icon" onClick={onClose} aria-label="Close provider profile"><X size={20} /></button></div>
    <div className="space-y-4 p-5"><p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This view contains private information submitted for provider verification. Keep it within authorized administration.</p>
      {busy && <p role="status" className="text-sm text-slate-500">Loading submitted profile…</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      {subscription && <section className="rounded-md border border-slate-200 p-4">
        <h3 className="font-semibold">Demo subscription</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 capitalize">{subscription.status}</dd></div>
          <div><dt className="text-xs text-slate-500">Plan</dt><dd className="mt-1">{subscription.plan ?? 'None'}</dd></div>
          <div><dt className="text-xs text-slate-500">Demo amount</dt><dd className="mt-1">{subscription.demoAmount === null ? '—' : `₱${subscription.demoAmount.toLocaleString('en-PH')} · Demo only`}</dd></div>
          <div><dt className="text-xs text-slate-500">Expiry</dt><dd className="mt-1">{subscription.expiresAt?.toLocaleString() ?? '—'}</dd></div>
        </dl>
        <h4 className="mt-5 text-sm font-semibold">Demo transaction history</h4>
        {subscription.history.length ? <ul className="mt-2 divide-y divide-slate-100">{subscription.history.map(item => <li key={item.id} className="py-3 text-sm">
          <p className="font-medium">{item.type === 'renewal' ? 'Manual demo renewal' : 'Demo activation'} · {item.plan}</p>
          <p className="mt-1 text-xs text-slate-500">₱{item.demoAmount.toLocaleString('en-PH')} · {item.durationDays} days · {item.createdAt?.toLocaleString() ?? 'Date unavailable'}</p>
          <p className="text-xs text-slate-500">Expires {item.expiresAt?.toLocaleString() ?? 'date unavailable'} · Demo only—no real money was charged.</p>
        </li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No demo transactions.</p>}
        <p className="mt-3 text-xs text-slate-500">Read-only demo records. Subscription status does not restrict listings, discovery, bookings, or account access.</p>
      </section>}
      {data && <ProfileFields data={data} />}
    </div>
  </dialog>;
}
