import { ShieldCheck } from 'lucide-react';
export function Brand() {
  return <a href="/" className="inline-flex items-center gap-3 text-inherit no-underline" aria-label="VeResc Admin home"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck size={26} strokeWidth={1.8} /></span><span className="text-2xl font-bold tracking-tight">VeResc <span className="ml-1 text-sm font-medium tracking-normal text-slate-500">Admin</span></span></a>;
}
