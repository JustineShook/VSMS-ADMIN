import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from '../components/admin/Sidebar';
import { Header } from '../components/admin/Header';
import { useAuth } from '../hooks/useAuth';
import { authErrorMessage, logout } from '../services/auth';
export function AdminLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const drawer = useRef<HTMLDialogElement>(null);
  const name = user?.displayName || 'VeResc Admin';
  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const close = () => { if (breakpoint.matches) drawer.current?.close(); };
    breakpoint.addEventListener('change', close);
    return () => breakpoint.removeEventListener('change', close);
  }, []);
  async function signOut() {
    setSigningOut(true); setError('');
    try { await logout(); } catch (err) { setError(authErrorMessage(err)); drawer.current?.close(); }
    finally { setSigningOut(false); }
  }
  const sidebarProps = { name, signingOut, onLogout: () => void signOut(), onVerification: () => {
    drawer.current?.close();
    document.getElementById('provider-verification')?.scrollIntoView({ block: 'start' });
  } };
  return <div className="admin-shell min-h-screen bg-[#f7f8fa]">
    <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:bg-white focus:p-3">Skip to dashboard content</a>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 lg:block ${collapsed ? 'w-20' : 'w-60'}`}><Sidebar {...sidebarProps} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></aside>
    <dialog ref={drawer} aria-label="Administration navigation" className="admin-drawer" onClick={event => { if (event.target === drawer.current) drawer.current.close(); }}>
      <div className="relative h-full"><button autoFocus className="admin-icon absolute right-2 top-2 z-10 bg-white" onClick={() => drawer.current?.close()} aria-label="Close navigation"><X size={18} /></button><Sidebar {...sidebarProps} /></div>
    </dialog>
    <div className={collapsed ? 'lg:pl-20' : 'lg:pl-60'}>
      <Header name={name} email={user?.email || ''} onMenu={() => drawer.current?.showModal()} />
      <main id="dashboard-content" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-7">
        {error && <div role="alert" className="notice mb-5">{error}</div>}
        <Outlet />
      </main>
    </div>
  </div>;
}
