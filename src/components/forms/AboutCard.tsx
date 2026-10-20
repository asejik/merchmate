import { LifeBuoy, Mail, FileText, ShieldCheck } from 'lucide-react';
import { Card } from '../ui/Card';

const SUPPORT_EMAIL = 'info@asejik.com';
const SUPPORT_LINK = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MerchMate support')}`;

const linkClass = 'flex items-center gap-2 text-sm text-primary hover:text-primary-hover py-2';

export function AboutCard() {
  return (
    <Card className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
        <LifeBuoy size={20} className="text-primary" /> Help & About
      </h2>
      <p className="text-xs text-muted mb-3">
        Need help or found a mistake? Email us. If something is broken, attach a problem report from the section above.
      </p>
      <nav aria-label="Help and legal" className="flex flex-col divide-y divide-line">
        <a href={SUPPORT_LINK} className={linkClass}><Mail size={16} /> {SUPPORT_EMAIL}</a>
        <a href="/privacy.html" className={linkClass}><ShieldCheck size={16} /> Privacy Policy</a>
        <a href="/terms.html" className={linkClass}><FileText size={16} /> Terms of Use</a>
      </nav>
      <p className="mt-3 text-xs text-muted">MerchMate · version {__BUILD__}</p>
    </Card>
  );
}
