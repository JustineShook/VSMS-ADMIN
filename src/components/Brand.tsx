import { ShieldCheck } from 'lucide-react';
export function Brand() {
  return <a href="/" className="inline-flex items-center gap-3 text-inherit no-underline" aria-label="VeResc home"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck size={26} strokeWidth={1.8} /></span><span className="text-2xl font-bold tracking-tight text-slate-950">VERESC</span></a>;
}
