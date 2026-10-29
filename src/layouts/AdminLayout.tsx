import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from '../components/admin/Sidebar';
import { Header } from '../components/admin/Header';
import { useAuth } from '../hooks/useAuth';
import { authErrorMessage, logout } from '../services/auth';
import { AdminNotificationsProvider, useAdminNotifications } from '../hooks/useAdminNotifications';

export function AdminLayout() {
  return <AdminNotificationsProvider><AdminLayoutContent /></AdminNotificationsProvider>;
}

function AdminLayoutContent() {
  const notifications = useAdminNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [activeTarget, setActiveTarget] = useState(() => location.pathname !== '/admin' ? location.pathname : window.location.hash.slice(1) || 'dashboard-top');
  const drawer = useRef<HTMLDialogElement>(null);
  const name = user?.displayName || 'VeResc Admin';
  const headerTitle = location.pathname === '/admin/staff' ? 'Admin Staff'
    : location.pathname === '/admin/verification' ? 'User Verification'
    : location.pathname === '/admin/mechanics' ? 'Onsite Mechanics'
    : location.pathname === '/admin/auto-shops' ? 'Auto Shops'
      : location.pathname === '/admin/towing' ? 'Towing Companies'
        : location.pathname === '/admin/home-garage' ? 'Home Garage'
          : location.pathname === '/admin/vehicle-owners' ? 'Vehicle Owners'
            : location.pathname === '/admin/bookings' ? 'Bookings'
            : location.pathname === '/admin/action-review' ? 'Action Review'
            : location.pathname === '/admin/notifications' ? 'Notifications'
              : location.pathname === '/admin/reports' ? 'Reports'
                : location.pathname === '/admin/complaints' ? 'Complaints' : 'Dashboard';
  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const close = () => { if (breakpoint.matches) drawer.current?.close(); };
    breakpoint.addEventListener('change', close);
    return () => breakpoint.removeEventListener('change', close);
  }, []);
  useEffect(() => {
    const section = location.pathname === '/admin' ? location.hash.slice(1) : '';
    setActiveTarget(location.pathname !== '/admin' ? location.pathname : section || 'dashboard-top');
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (location.pathname !== '/admin' || !location.hash) return;
    const target = location.hash.slice(1);
    let frame = 0;
    let attempts = 0;
    const scrollToTarget = () => {
      const element = document.getElementById(target);
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      if (attempts++ < 10) frame = window.requestAnimationFrame(scrollToTarget);
    };
    frame = window.requestAnimationFrame(scrollToTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  async function signOut() {
    setSigningOut(true); setError('');
    try { await logout(); } catch (err) { setError(authErrorMessage(err)); drawer.current?.close(); }
    finally { setSigningOut(false); }
  }
  const sidebarProps = { name, signingOut, activeTarget, onLogout: () => void signOut(), onNavigate: () => {
    if (drawer.current?.open) drawer.current.close();
  } };
  return <div className="admin-shell min-h-screen bg-[#f7f8fa]">
    <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:bg-white focus:p-3">Skip to dashboard content</a>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 lg:block ${collapsed ? 'w-20' : 'w-60'}`}><Sidebar {...sidebarProps} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></aside>
    <dialog ref={drawer} aria-label="Administration navigation" className="admin-drawer" onClick={event => { if (event.target === drawer.current) drawer.current.close(); }}>
      <div className="relative h-full"><button autoFocus className="admin-icon absolute right-2 top-2 z-10 bg-white" onClick={() => drawer.current?.close()} aria-label="Close navigation"><X size={18} /></button><Sidebar {...sidebarProps} /></div>
    </dialog>
    <div className={collapsed ? 'lg:pl-20' : 'lg:pl-60'}>
      <Header name={name} email={user?.email || ''} title={headerTitle} unreadCount={notifications.unreadCount} onNotifications={() => navigate('/admin/notifications')} onMenu={() => drawer.current?.showModal()} />
      <main id="dashboard-content" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-7">
        {error && <div role="alert" className="notice mb-5">{error}</div>}
        <Outlet />
      </main>
    </div>
  </div>;
}
