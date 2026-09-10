import { Bell, CalendarDays, ChevronLeft, ClipboardCheck, LayoutDashboard, LogOut, Settings, ShieldCheck, Store, Truck, Users, Wrench, Flag } from 'lucide-react';
import { Avatar } from './Avatar';
const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Users', icon: Users },
  { label: 'Provider Verification', icon: ClipboardCheck }, { label: 'Onsite Mechanics', icon: Wrench },
  { label: 'Auto Shops', icon: Store }, { label: 'Towing Companies', icon: Truck },
  { label: 'Bookings', icon: CalendarDays }, { label: 'Reports', icon: Flag },
  { label: 'Notifications', icon: Bell }, { label: 'Settings', icon: Settings },
];
interface Props { collapsed?: boolean; name: string; signingOut: boolean; onLogout: () => void; onToggle?: () => void; onVerification?: () => void }
export function Sidebar({ collapsed = false, name, signingOut, onLogout, onToggle, onVerification }: Props) {
  return <div className="flex h-full flex-col bg-white">
    <div className={`flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><ShieldCheck size={23} /></span>
      {!collapsed && <div><p className="text-xl font-bold tracking-tight">VeResc<span className="text-brand">.</span></p><p className="text-[9px] font-semibold tracking-[.22em] text-slate-400">ADMINISTRATION</p></div>}
    </div>
    <nav aria-label="Administration" className="min-h-0 flex-1 overflow-y-auto px-3 py-6">
      {!collapsed && <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-slate-400">WORKSPACE</p>}
      <div className="space-y-1">{navigation.map(({ label, icon: Icon }, index) =>
        <button key={label} type="button" disabled={index !== 0 && index !== 2} aria-current={index === 0 ? 'page' : undefined}
          onClick={index === 2 ? onVerification : undefined}
          title={index === 0 || index === 2 ? label : `${label} — preview only`} aria-label={collapsed ? label : undefined}
          className={`admin-nav ${collapsed ? 'justify-center px-2' : 'px-3'} ${index === 0 ? 'bg-red-50 font-semibold text-brand' : 'text-slate-500'}`}>
          <Icon size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && <span className="flex-1 text-left">{label}</span>}
        </button>
      )}</div>
    </nav>
    <div className="shrink-0 border-t border-slate-200 p-3">
      {!collapsed && <p className="mb-4 px-3 text-[10px] leading-4 text-slate-400">LIVE PROVIDER VERIFICATION</p>}
      <div className={`mb-3 flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'}`}><Avatar name={name} />{!collapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold">{name}</p><p className="mt-0.5 text-[11px] text-slate-400">Administrator</p></div>}</div>
      <button className={`admin-nav text-slate-600 hover:bg-slate-50 ${collapsed ? 'justify-center' : 'px-3'}`} onClick={onLogout} disabled={signingOut} title="Log out" aria-label="Log out"><LogOut size={17} />{!collapsed && (signingOut ? 'Logging out…' : 'Log out')}</button>
      {onToggle && <button className="admin-nav mt-1 justify-center border-t border-slate-100 text-slate-400 hover:text-brand" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}><ChevronLeft size={16} className={collapsed ? 'rotate-180' : ''} />{!collapsed && <span className="text-[11px]">Collapse sidebar</span>}</button>}
    </div>
  </div>;
}
