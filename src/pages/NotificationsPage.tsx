import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, isRead, markRead, markAllRead } = useAdminNotifications();
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">ADMIN INBOX</p><h2 className="text-2xl font-semibold tracking-tight">Notifications</h2><p className="mt-2 text-xs text-slate-500">Provider applications, booking activity, and provider account changes.</p></div><button className="secondary inline-flex items-center gap-2" disabled={!unreadCount} onClick={markAllRead}><CheckCheck size={15} />Mark all read</button></div>
    {error && <p role="alert" className="notice">{error}</p>}
    <section className="admin-panel"><div className="admin-section-heading"><div><h3>Recent activity</h3><p>{unreadCount} unread · {notifications.length} notifications loaded</p></div></div>
      {loading && <p role="status" className="px-5 pb-5 text-sm text-slate-500">Connecting to live admin notifications…</p>}
      {!loading && !notifications.length && <p className="px-5 pb-5 text-sm text-slate-500">No provider or booking activity found yet.</p>}
      <ul className="divide-y divide-slate-100">{notifications.map(item => {
        const read = isRead(item.id);
        return <li key={item.id}><button className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 ${read ? '' : 'bg-red-50/40'}`} onClick={() => { markRead(item.id); navigate(item.href); }}><span className={`mt-0.5 rounded-full p-2 ${read ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-brand'}`}><Bell size={15} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-medium text-slate-800">{item.title}</strong>{!read && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-brand">NEW</span>}</span><span className="mt-1 block text-xs text-slate-500">{item.message}</span><time className="mt-1 block text-[10px] text-slate-400" dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString()}</time></span></button></li>;
      })}</ul>
      {!loading && notifications.length > 0 && <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">Notifications update live while this admin app is open. Read state is saved in this browser.</p>}
    </section>
  </div>;
}
