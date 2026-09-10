import { LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Brand } from '../components/Brand';

export function AuthLayout() {
  return <div className="min-h-screen bg-white lg:grid lg:grid-cols-[0.95fr_1.05fr]">
    <aside className="flex flex-col border-b border-slate-200 bg-[#faf8f8] px-6 py-7 sm:px-12 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-14 lg:py-10 xl:px-20">
      <Brand />
      <div className="my-auto hidden py-16 lg:block"><span className="eyebrow">STAFF ACCESS PORTAL</span><h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.15] tracking-tight text-slate-900">Helping keep<br />VeResc moving.</h1><p className="mt-6 max-w-sm text-base leading-7 text-slate-600">A dedicated space for the people behind reliable roadside assistance.</p>
        <div className="mt-12 space-y-6"><Feature icon={<ShieldCheck size={20} />} title="Authorized access" text="Reserved for approved VeResc administrators." /><Feature icon={<UserCheck size={20} />} title="One VeResc account" text="Sign in using your existing account credentials." /></div>
      </div>
      <p className="hidden items-center gap-2 text-xs text-slate-500 lg:flex"><LockKeyhole size={14} /> VeResc administration · Staff use only</p>
    </aside>
    <main className="flex min-w-0 flex-col px-6 py-10 sm:px-12 lg:px-16"><div className="m-auto w-full max-w-md py-5"><Outlet /></div><p className="mt-8 text-center text-xs text-slate-400">VeResc Admin · Account access</p></main>
  </div>;
}
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-4"><span className="rounded-lg border border-red-100 bg-white p-3 text-brand">{icon}</span><div><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">{text}</p></div></div>;
}
