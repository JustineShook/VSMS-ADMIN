import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; hint?: string }
export function FormField({ label, error, hint, type, id, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-800">{label}</label><div className="relative"><input {...props} id={id} type={password && visible ? 'text' : type} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`field ${password ? 'pr-12' : ''}`} />{password && <button type="button" className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-900" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>}</div>{error ? <p id={`${id}-error`} className="mt-2 text-xs text-brand">{error}</p> : hint && <p id={`${id}-hint`} className="mt-2 text-xs text-slate-500">{hint}</p>}</div>;
}
