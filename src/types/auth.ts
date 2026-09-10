import type { User } from 'firebase/auth';
export type AuthStatus = 'loading' | 'signed-out' | 'admin' | 'restricted' | 'error';
export interface AuthState { user: User | null; status: AuthStatus; error: string | null }
export interface AuthContextValue extends AuthState { refreshAccess: () => Promise<void> }
