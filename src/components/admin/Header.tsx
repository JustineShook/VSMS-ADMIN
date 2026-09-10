import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, Search, UserRound } from 'lucide-react';
import { Avatar } from './Avatar';
export function Header({ name, email, onMenu }: { name: string; email: string; onMenu: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
    <div className="flex items-center gap-3"><button className="admin-icon lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button><h1 className="text-lg font-semibold tracking-tight">Dashboard</h1></div>
    <div className="flex items-center gap-2 sm:gap-5">
      <label className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 md:flex"><Search size={16} /><input className="w-36 bg-transparent text-xs outline-none lg:w-44" placeholder="Search workspace…" aria-label="Search workspace (preview only)" disabled /><span className="text-[9px]">PREVIEW</span></label>
      <button className="admin-icon" disabled aria-label="Notifications (preview only)" title="Notifications — preview only"><Bell size={19} /></button>
      <div ref={root} className="relative border-l border-slate-200 pl-3 sm:pl-5">
        <button ref={trigger} className="flex items-center gap-2.5 rounded-md" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="admin-profile-panel" aria-label="Toggle admin profile">
          <Avatar name={name} /><span className="hidden max-w-36 truncate text-xs font-semibold sm:block">{name}</span><ChevronDown size={14} className="text-slate-400" />
        </button>
        {open && <div id="admin-profile-panel" className="absolute right-0 top-12 z-20 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"><p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={16} />Administrator</p><p className="mt-3 break-words text-xs">{name}</p><p className="mt-1 break-all text-xs text-slate-500">{email}</p><p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Profile settings are not available in this preview.</p></div>}
      </div>
    </div>
  </header>;
}
