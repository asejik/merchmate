import { LifeBuoy, Mail, FileText, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const SUPPORT_EMAIL = 'info@asejik.com';
const SUPPORT_LINK = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MerchMate support')}`;

const linkClass = 'flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 py-2';

export function AboutCard() {
  return (
    <GlassCard className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <LifeBuoy size={20} className="text-indigo-400" /> Help & About
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Need help or found a mistake? Email us. If something is broken, attach a problem report from the section above.
      </p>
      <nav aria-label="Help and legal" className="flex flex-col divide-y divide-white/5">
        <a href={SUPPORT_LINK} className={linkClass}><Mail size={16} /> {SUPPORT_EMAIL}</a>
        <a href="/privacy.html" className={linkClass}><ShieldCheck size={16} /> Privacy Policy</a>
        <a href="/terms.html" className={linkClass}><FileText size={16} /> Terms of Use</a>
      </nav>
      <p className="mt-3 text-[11px] text-slate-600">MerchMate · version {__BUILD__}</p>
    </GlassCard>
  );
}
