import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { subscribeAdminNotifications, type AdminNotification } from '../services/notifications';

interface FeedValue {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}
const FeedContext = createContext<FeedValue | null>(null);
const storageKey = 'veresc-admin-read-notifications';
function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(readSaved);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => subscribeAdminNotifications(items => { setNotifications(items); setLoading(false); setError(''); }, message => { setError(message); setLoading(false); }), []);

  function save(ids: string[]) {
    const unique = [...new Set(ids)].slice(-1000);
    setReadIds(unique);
    try { localStorage.setItem(storageKey, JSON.stringify(unique)); } catch { /* In-memory read state still works in this tab. */ }
  }
  const value = useMemo<FeedValue>(() => ({
    notifications,
    unreadCount: notifications.filter(item => !readIds.includes(item.id)).length,
    loading,
    error,
    isRead: id => readIds.includes(id),
    markRead: id => save([...readIds, id]),
    markAllRead: () => save([...readIds, ...notifications.map(item => item.id)]),
  }), [notifications, readIds, loading, error]);
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useAdminNotifications(): FeedValue {
  const value = useContext(FeedContext);
  if (!value) throw new Error('useAdminNotifications requires AdminNotificationsProvider');
  return value;
}
