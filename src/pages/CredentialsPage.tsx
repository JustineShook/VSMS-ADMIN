import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Info, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { Loading } from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { authErrorMessage, login, register } from '../services/auth';
import { validateCredentials, type FieldErrors } from '../lib/validation';

export function CredentialsPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { status } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy && (status === 'admin' || status === 'restricted' || status === 'error')) navigate('/access', { replace: true });
  }, [status, busy, navigate]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const next = validateCredentials(values, isRegister);
    setErrors(next); setError('');
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const warning = isRegister ? await register(values.name, values.email, values.password) : (await login(values.email, values.password), null);
      navigate('/access', { replace: true, state: { registered: isRegister, warning } });
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }
  const field = (key: keyof typeof values) => ({ id: key, name: key, value: values[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setValues(v => ({ ...v, [key]: event.target.value })); setErrors(e => ({ ...e, [key]: undefined })); }, error: errors[key], required: true });
  if (status === 'loading' && !busy) return <Loading />;
  return <><span className="eyebrow">{isRegister ? 'JOIN THE TEAM' : 'WELCOME BACK'}</span><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{isRegister ? 'Create your account' : 'Sign in to VeResc Admin'}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{isRegister ? 'Register your staff account to get started. Administrator approval is required for access.' : 'Enter your account details to continue.'}</p>
    <form onSubmit={submit} noValidate className="mt-8" aria-busy={busy}>
      {error && <div className="notice mb-5" role="alert">{error}</div>}
      <fieldset disabled={busy} className="space-y-5">
        {isRegister && <FormField {...field('name')} label="Full name" autoComplete="name" maxLength={120} placeholder="Your full name" />}
        <FormField {...field('email')} label="Email address" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} />
        <FormField {...field('password')} label="Password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'Create a password' : 'Enter your password'} hint={isRegister ? 'Use at least 8 characters. Your organization’s password policy also applies.' : undefined} />
        {isRegister && <FormField {...field('confirmPassword')} label="Confirm password" type="password" autoComplete="new-password" placeholder="Re-enter your password" />}
        <button className="primary w-full" type="submit">{busy ? <><LoaderCircle size={18} className="animate-spin" />{isRegister ? 'Creating account…' : 'Signing in…'}</> : <>{isRegister ? 'Register account' : 'Sign in'}<ArrowRight size={18} /></>}</button>
      </fieldset>
    </form>
    <p className="mt-6 text-center text-sm text-slate-500">{isRegister ? 'Already have an account?' : 'Need a staff account?'}{' '}<Link className="font-semibold text-brand hover:underline" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Register'}</Link></p>
    <div className="mt-8 flex gap-3 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500"><Info size={17} className="mt-0.5 shrink-0" /><p>{isRegister ? 'Registration does not grant administrator privileges. Contact your VeResc administrator to have your account reviewed.' : 'Access is limited to approved administrators. An existing VeResc account does not automatically include admin access.'}</p></div>
  </>;
}
