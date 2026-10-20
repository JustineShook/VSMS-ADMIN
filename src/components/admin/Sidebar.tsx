import { Bell, CalendarDays, CarFront, ChevronLeft, ClipboardCheck, LayoutDashboard, LogOut, Settings, ShieldAlert, ShieldCheck, Store, Truck, Users, Wrench, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, target: 'dashboard-top' },
  { label: 'Admin Staff', icon: Users, target: '/admin/staff' },
  { label: 'User Verification', icon: ClipboardCheck, target: '/admin/verification' },
  { label: 'Onsite Mechanics', icon: Wrench, target: '/admin/mechanics' },
  { label: 'Auto Shops', icon: Store, target: '/admin/auto-shops' },
  { label: 'Towing Companies', icon: Truck, target: '/admin/towing' },
  { label: 'Home Garage', icon: CarFront, target: '/admin/home-garage' },
  { label: 'Vehicle Owners', icon: Users, target: '/admin/vehicle-owners' },
  { label: 'Bookings', icon: CalendarDays, target: '/admin/bookings' },
  { label: 'Complaints', icon: ShieldAlert, target: '/admin/complaints' },
  { label: 'Reports', icon: Flag, target: '/admin/reports' },
  { label: 'Notifications', icon: Bell, target: '/admin/notifications' },
  { label: 'Settings', icon: Settings, target: 'admin-account' },
];

interface Props {
  collapsed?: boolean;
  name: string;
  signingOut: boolean;
  onLogout: () => void;
  onToggle?: () => void;
  onNavigate: (target: string) => void;
  activeTarget: string;
}

export function Sidebar({ collapsed = false, name, signingOut, onLogout, onToggle, onNavigate, activeTarget }: Props) {
  return <div className="flex h-full flex-col bg-white">
    <div className={`flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><ShieldCheck size={23} /></span>
      {!collapsed && <div><p className="text-xl font-bold tracking-tight">VeResc<span className="text-brand">.</span></p><p className="text-[9px] font-semibold tracking-[.22em] text-slate-400">ADMINISTRATION</p></div>}
    </div>
    <nav aria-label="Administration" className="min-h-0 flex-1 overflow-y-auto px-3 py-6">
      {!collapsed && <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-slate-400">WORKSPACE</p>}
      <div className="space-y-1">{navigation.map(({ label, icon: Icon, target }) =>
        <Link key={label} to={target.startsWith('/') ? target : `/admin#${target}`} aria-current={activeTarget === target ? 'page' : undefined}
          onClick={() => onNavigate(target)} title={label} aria-label={collapsed ? label : undefined}
          className={`admin-nav ${collapsed ? 'justify-center px-2' : 'px-3'} ${activeTarget === target ? 'bg-red-50 font-semibold text-brand' : 'text-slate-500'}`}>
          <Icon size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && <span className="flex-1 text-left">{label}</span>}
        </Link>
      )}</div>
    </nav>
    <div className="shrink-0 border-t border-slate-200 p-3">
      <div className={`mb-3 flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'}`}><Avatar name={name} />{!collapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold">{name}</p><p className="mt-0.5 text-[11px] text-slate-400">Administrator account</p></div>}</div>
      <button className={`admin-nav text-slate-600 hover:bg-slate-50 ${collapsed ? 'justify-center' : 'px-3'}`} onClick={onLogout} disabled={signingOut} title="Log out" aria-label="Log out"><LogOut size={17} />{!collapsed && (signingOut ? 'Logging out…' : 'Log out')}</button>
      {onToggle && <button className="admin-nav mt-1 justify-center border-t border-slate-100 text-slate-400 hover:text-brand" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}><ChevronLeft size={16} className={collapsed ? 'rotate-180' : ''} />{!collapsed && <span className="text-[11px]">Collapse sidebar</span>}</button>}
    </div>
  </div>;
}
