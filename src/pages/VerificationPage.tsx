import { ClipboardCheck } from 'lucide-react';
import { VerificationTable } from '../components/admin/VerificationTable';

export function VerificationPage() {
  return <div className="space-y-6">
    <header>
      <p className="mb-2 text-[10px] font-semibold tracking-[.16em] text-slate-400">ACCOUNT REVIEW</p>
      <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ClipboardCheck size={23} className="text-brand" />User Verification</h2>
      <p className="mt-2 text-xs text-slate-500">Review submitted vehicle owner and provider profiles. Approve verified applications or reject them with a reason.</p>
    </header>
    <VerificationTable />
  </div>;
}
