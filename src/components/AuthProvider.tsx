import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { hasAdminClaim } from '../lib/authorization';
import { AuthContext } from '../hooks/useAuth';
import type { AuthState } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading', error: null });
  const generation = useRef(0);
  const resolveAccess = useCallback(async (user: User | null, force = false) => {
    const current = ++generation.current;
    if (!user) { setState({ user: null, status: 'signed-out', error: null }); return; }
    setState({ user, status: 'loading', error: null });
    try {
      const token = await user.getIdTokenResult(force);
      if (current !== generation.current || auth?.currentUser?.uid !== user.uid) return;
      setState({ user, status: hasAdminClaim(token.claims) ? 'admin' : 'restricted', error: null });
    } catch {
      if (current !== generation.current) return;
      setState({ user, status: 'error', error: 'We could not verify your access. Check your connection and retry.' });
    }
  }, []);
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onIdTokenChanged(auth, user => { void resolveAccess(user); }, () => {
      ++generation.current;
      setState({ user: auth?.currentUser ?? null, status: 'error', error: 'Your session could not be verified. Please sign in again.' });
    });
    return () => { ++generation.current; unsubscribe(); };
  }, [resolveAccess]);
  return <AuthContext.Provider value={{ ...state, refreshAccess: () => resolveAccess(auth?.currentUser ?? null, true) }}>{children}</AuthContext.Provider>;
}
