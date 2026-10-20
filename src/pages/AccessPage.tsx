import { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, ShieldAlert, RefreshCw, UserPlus } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { logout, authErrorMessage } from '../services/auth';
import { Loading } from '../components/Loading';
import { loadMyStaffRequest, staffDateLabel, submitStaffRequest, type StaffRequest } from '../services/staff';

export function AccessPage({ verified = false }: { verified?: boolean }) {
  const { user, status, error, refreshAccess } = useAuth();
  const { state } = useLocation();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [staffRequest, setStaffRequest] = useState<StaffRequest | null>(null);
  const [checkingRequest, setCheckingRequest] = useState(true);
  useEffect(() => {
    let active = true;
    if (!user || status === 'admin') { setCheckingRequest(false); return; }
    void loadMyStaffRequest().then(request => { if (active) setStaffRequest(request); }, () => { if (active) setActionError('Could not check your staff request status. Retry in a moment.'); }).finally(() => { if (active) setCheckingRequest(false); });
    return () => { active = false; };
  }, [user, status]);
  if (status === 'loading') return <Loading />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status === 'admin' && !verified) return <Navigate to="/admin" replace />;
  async function signOut() {
    setBusy(true); setActionError('');
    try { await logout(); } catch (err) { setActionError(authErrorMessage(err)); } finally { setBusy(false); }
  }
  async function requestStaffAccess() {
    setBusy(true); setActionError('');
    try { await submitStaffRequest(); setStaffRequest(await loadMyStaffRequest()); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not submit your staff access request.'); }
    finally { setBusy(false); }
  }
  return <><span className="mb-6 inline-flex rounded-xl bg-red-50 p-4 text-brand">{verified ? <CheckCircle2 size={28} /> : <ShieldAlert size={28} />}</span><p className="eyebrow">ACCOUNT ACCESS</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{verified ? 'You’re signed in' : status === 'error' ? 'Access check unavailable' : 'Admin approval required'}</h2><p className="mt-4 text-sm leading-6 text-slate-600">{verified ? 'Your administrator access has been verified. The admin workspace will be available in a future release.' : status === 'error' ? error : 'Your account is signed in, but it does not have approved administrator access. Contact your VeResc administrator for review.'}</p>
    {state?.registered && <p className="mt-4 text-sm text-slate-600" role="status">Your account was created successfully.</p>}
    {state?.warning && <p className="notice mt-4" role="alert">{state.warning}</p>}
    <dl className="my-7 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm"><dt className="text-xs text-slate-500">Signed in as</dt><dd className="mt-1 break-all font-medium">{user?.email ?? 'VeResc account'}</dd>{user?.displayName && <dd className="mt-1 text-slate-500">{user.displayName}</dd>}<dt className="mt-4 text-xs text-slate-500">Account ID · share with your administrator</dt><dd className="mt-1 break-all font-mono text-xs">{user?.uid ?? 'Unavailable'}</dd></dl>
    {staffRequest && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"><strong>Staff request: {staffRequest.status === 'MANUAL_GRANT_RECORDED' ? 'Approved' : staffRequest.status}</strong><span className="mt-1 block text-xs text-slate-500">Submitted {staffDateLabel(staffRequest.requestedAt)}{staffRequest.status === 'REJECTED' ? ' · You may submit a new request if your access needs have changed.' : ''}</span></p>}
    {actionError && <p className="notice mb-4" role="alert">{actionError}</p>}
    <div className="space-y-3">{staffRequest?.status !== 'PENDING' && staffRequest?.status !== 'MANUAL_GRANT_RECORDED' && <button className="primary w-full" onClick={() => void requestStaffAccess()} disabled={busy || checkingRequest}><UserPlus size={17} />{busy ? 'Submitting request…' : 'Request staff reviewer access'}</button>}{staffRequest?.status === 'PENDING' && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Your staff request is waiting for administrator review.</p>}{staffRequest?.status === 'MANUAL_GRANT_RECORDED' && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Your staff request was approved. Refresh your access to enter the admin dashboard.</p>}<button className="secondary w-full" onClick={() => void refreshAccess()} disabled={busy}><RefreshCw size={17} /> Refresh access</button><button className="secondary w-full" onClick={() => void signOut()} disabled={busy}><LogOut size={17} />{busy ? 'Signing out…' : 'Sign out'}</button></div>
  </>;
}
