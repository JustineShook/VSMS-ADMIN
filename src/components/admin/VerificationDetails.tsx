import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Application } from '../../types/verification';
import { approvalProblem, display, documentUrl, field, roleLabels } from '../../lib/verification';
import { loadApplicantName, reviewApplication, verificationError } from '../../services/verification';

function labelFor(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^\w/, value => value.toUpperCase());
}

function isTimestamp(value: unknown): value is { toDate: () => Date } {
  return !!value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function';
}

function isSensitiveKey(key: string): boolean {
  return /date.?of.?birth|birth.?date|government.?id|id.?number|full.?id.?number/i.test(key);
}

function MechanicProfileFields({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null);
  const nested = entries.filter(([, value]) => typeof value === 'object' && !Array.isArray(value) && !isTimestamp(value));
  const arrays = entries.filter(([, value]) => Array.isArray(value));
  const scalars = entries.filter(([, value]) => !Array.isArray(value) && (typeof value !== 'object' || isTimestamp(value)));

  return <div className="space-y-4">
    {scalars.length > 0 && <dl className="grid gap-4 sm:grid-cols-2">{scalars.map(([key, value]) => {
      const url = documentUrl(value);
      return <div key={key}><dt className="text-xs text-slate-500">{labelFor(key)}</dt><dd className="mt-1 break-words text-sm">{isSensitiveKey(key) ? 'Hidden for privacy' : isTimestamp(value) ? value.toDate().toLocaleString() : url ? <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-1 text-brand underline">Open submitted file <ExternalLink size={13} /></a> : display(value)}</dd></div>;
    })}</dl>}
    {arrays.map(([key, value]) => <div key={key}><h4 className="mb-2 text-xs font-medium text-slate-500">{labelFor(key)}</h4><p className="break-words text-sm">{Array.isArray(value) ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : display(item)).join(', ') || 'Not provided' : display(value)}</p></div>)}
    {nested.map(([key, value]) => <section key={key} className="rounded-md border border-slate-100 p-4"><h4 className="mb-3 text-sm font-semibold">{labelFor(key)}</h4><MechanicProfileFields data={value as Record<string, unknown>} /></section>)}
  </div>;
}

const fields = {
  owner: [],
  homegarage: [],
  'onsite-mechanic': [],
  'towing-company': [
    ['Business name', 'company.companyName'], ['Representative', 'representative.fullName'], ['Phone', 'company.phone'], ['Address', 'company.address'], ['City / municipality', 'company.cityMunicipality'],
    ['Operating hours', 'company.operatingHours'], ['Services', 'services.towingServices'], ['Service area', 'services.serviceArea'], ['Vehicles supported', 'services.vehicleTypesSupported'], ['Business registration number', 'businessDocuments.permitOrRegistrationNumber'],
  ],
  'shop-owner': [['Business name', 'businessName'], ['Phone', 'phone'], ['Address', 'address'], ['Latitude', 'latitude'], ['Longitude', 'longitude'], ['Availability', 'status']],
};
const documents = {
  owner: [],
  homegarage: [],
  'onsite-mechanic': [],
  'towing-company': [['Representative ID', 'representative.validIdUrl'], ['Business permit / registration', 'businessDocuments.permitOrRegistrationUrl']],
  'shop-owner': [],
};
export function VerificationDetails({ application, onClose, onSaved }: { application: Application; onClose: () => void; onSaved: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applicant, setApplicant] = useState('Loading…');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    void loadApplicantName(application.uid).then(name => { if (active) setApplicant(name); }, () => { if (active) setApplicant('Could not load account name'); });
    return () => { active = false; };
  }, [application.uid]);
  const problem = approvalProblem(application);
  async function save() {
    if (!decision || busy) return;
    setBusy(true); setError('');
    try {
      await reviewApplication(application, decision, reason);
      onSaved(`${application.name} ${decision === 'VERIFIED' ? 'approved' : 'rejected'}. ${decision === 'VERIFIED' && application.role !== 'owner' ? 'The provider can publish through the mobile Public Listing screen.' : decision === 'REJECTED' ? 'The rejection reason was saved.' : 'The vehicle owner verification was saved.'}`);
    } catch (err) { setError(verificationError(err)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="verification-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[720px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><h2 id="verification-title" className="text-lg font-semibold">{application.name}</h2><p className="mt-1 text-xs text-slate-500">{roleLabels[application.role]} · {application.legacy ? 'Unverified legacy shop' : 'PENDING'}</p></div><button className="admin-icon" onClick={onClose} disabled={busy} aria-label="Close verification details"><X size={20} /></button></div>
    <div className="space-y-5 p-5">
      <p className="break-all text-xs text-slate-500">Account holder: {applicant}<br />Account ID: {application.uid} · Submitted: {application.submitted}</p>
      {application.legacy && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5">The existing shop model has no submission or document-upload workflow. This is an unverified shop profile, not a submitted application. Confirm the business independently before approving it.</p>}
      {application.role === 'owner' || application.role === 'homegarage' ? <MechanicProfileFields data={application.data} /> : application.role === 'onsite-mechanic' ? <div className="space-y-4">{['personal', 'professional', 'identification', 'credentials'].map(group => {
        const value = application.data[group];
        return value && typeof value === 'object' && !Array.isArray(value) ? <section key={group} className="border-t border-slate-200 pt-4"><h3 className="mb-3 text-sm font-semibold">{labelFor(group)}</h3><MechanicProfileFields data={value as Record<string, unknown>} /></section> : null;
      })}</div> : <dl className="grid gap-4 sm:grid-cols-2">{fields[application.role].map(([label, path]) => <div key={path}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm">{display(field(application.data, path))}</dd></div>)}</dl>}
      {application.role !== 'onsite-mechanic' && application.role !== 'owner' && application.role !== 'homegarage' && <section className="border-t border-slate-200 pt-4"><h3 className="text-sm font-semibold">Submitted documents</h3><p className="mt-1 text-xs text-slate-500">Opens the original submitted file in a new tab.</p><div className="mt-3 space-y-2">{documents[application.role].map(([label, path]) => {
        const url = documentUrl(field(application.data, path));
        return <div key={path} className="text-sm">{url ? <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-2 text-brand underline">{label}<ExternalLink size={14} /></a> : <span className="text-slate-500">{label}: no supported document URL provided</span>}</div>;
      })}{application.role === 'shop-owner' && <p className="text-sm text-slate-500">No verification-document fields exist in the current shop schema.</p>}</div></section>}
      <p className="text-xs leading-5 text-slate-500">Approval does not publish a listing automatically. Any existing listing is hidden until the approved provider republishes it through the mobile app. Private documents are never copied to public listings.</p>
      {problem && <p className="notice">{problem}</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      {!decision ? <div className="flex flex-wrap gap-3"><button className="primary" disabled={!!problem} onClick={() => setDecision('VERIFIED')}>Approve</button><button className="secondary" onClick={() => setDecision('REJECTED')}>Reject</button></div> : <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold">Confirm {decision === 'VERIFIED' ? 'approval' : 'rejection'} of {application.name}?</p>
        <div><label htmlFor="rejection-reason" className="mb-2 block text-xs">{decision === 'REJECTED' ? 'Rejection reason (5–500 characters)' : 'Admin note (optional)'}</label><textarea id="rejection-reason" className="field min-h-24" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={busy} required={decision === 'REJECTED'} /></div>
        <div className="flex flex-wrap gap-3"><button className="primary" disabled={busy || (decision === 'REJECTED' && reason.trim().length < 5)} onClick={() => void save()}>{busy ? 'Saving…' : 'Confirm decision'}</button><button className="secondary" disabled={busy} onClick={() => { setDecision(null); setError(''); }}>Cancel</button></div>
      </div>}
    </div>
  </dialog>;
}
