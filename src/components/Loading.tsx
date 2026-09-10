import { LoaderCircle } from 'lucide-react';
export function Loading() { return <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-600"><LoaderCircle size={20} className="animate-spin" /> Checking your session…</div>; }
