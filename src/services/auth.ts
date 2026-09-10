import { browserSessionPersistence, createUserWithEmailAndPassword, setPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

function configuredAuth() {
  if (!auth) throw new Error('Firebase is not configured.');
  return auth;
}
export async function login(email: string, password: string) {
  const instance = configuredAuth();
  await setPersistence(instance, browserSessionPersistence);
  await signInWithEmailAndPassword(instance, email.trim(), password);
}
export async function register(name: string, email: string, password: string): Promise<string | null> {
  const instance = configuredAuth();
  await setPersistence(instance, browserSessionPersistence);
  const { user } = await createUserWithEmailAndPassword(instance, email.trim(), password);
  // Never create an admin role, claim, or shared mobile profile in browser code.
  try {
    await updateProfile(user, { displayName: name.trim() });
    return null;
  } catch {
    return 'Your account was created, but your name could not be saved. Tell your administrator when requesting access.';
  }
}
export async function logout() { await signOut(configuredAuth()); }

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'The email or password is incorrect. Please try again.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Sign in with your existing VeResc account.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements': return 'Your password does not meet the project’s password policy. Use a longer password with uppercase, lowercase, numbers, and symbols.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait and try again.';
    case 'auth/network-request-failed': return 'Unable to connect. Check your internet connection and try again.';
    case 'auth/user-disabled': return 'This account has been disabled. Contact your administrator.';
    case 'auth/operation-not-allowed': return 'Email/password sign-in is not enabled. Contact your administrator.';
    case 'auth/invalid-api-key': case 'auth/unauthorized-domain': return 'Firebase configuration needs attention. Contact your administrator.';
    default: return 'We could not complete this request. Please try again.';
  }
}
