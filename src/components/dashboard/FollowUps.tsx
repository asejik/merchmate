import { useMemo, useState } from 'react';
import { MessageCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import type { AppTab, BusinessProfile, Customer, Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { getBalance, getUnconfirmedAmount } from '../../lib/invoice';
import { buildFollowUps, type FollowUpReason } from '../../lib/followups';
import { clientWhatsAppLink } from '../../lib/whatsapp';

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  business?: BusinessProfile;
  onNavigate: (tab: AppTab) => void;
}

const COLLAPSED_COUNT = 5;

const REASON_STYLES: Record<FollowUpReason, string> = {
  unconfirmed: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  ready: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
  overdue: 'text-red-400 bg-red-400/10 border-red-400/20',
  'delivery-late': 'text-red-400 bg-red-400/10 border-red-400/20',
  'delivery-today': 'text-amber-300 bg-amber-400/10 border-amber-400/20',
};

function reasonLabel(reason: FollowUpReason, invoice: Invoice): string {
  const money = (value: number) => formatMoney(value, invoice.currency);
  switch (reason) {
    case 'unconfirmed': return `Check bank for ${money(getUnconfirmedAmount(invoice))}`;
    case 'ready': return getBalance(invoice) > 0 ? `Ready · collect ${money(getBalance(invoice))}` : 'Ready · tell client';
    case 'overdue': return `Overdue · ${money(getBalance(invoice))}`;
    case 'delivery-late': return 'Delivery late';
    case 'delivery-today': return 'Deliver today';
  }
}

export function FollowUps({ invoices, customers, business, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const followUps = useMemo(() => buildFollowUps(invoices, customers), [invoices, customers]);
  const visible = expanded ? followUps : followUps.slice(0, COLLAPSED_COUNT);
  const pending = followUps.filter(f => !f.done).length;

  const markMessaged = (invoice: Invoice) => {
    if (invoice.id) db.invoices.update(invoice.id, { lastReminderAt: new Date() }).catch(console.error);
  };

  return (
    <section aria-labelledby="today-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="today-heading" className="text-lg font-semibold text-white">Today</h2>
        {followUps.length > 0 && (
          <span className="text-xs text-slate-400">{pending === 0 ? 'All done' : `${pending} to do`}</span>
        )}
      </div>

      {followUps.length === 0 ? (
        <GlassCard className="p-4 flex items-center gap-3 text-sm text-slate-400">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          Nothing to chase. No overdue balances, ready orders or unchecked transfers.
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-white/5">
          {visible.map(({ invoice, customer, reasons, needsMessage, done }) => {
            // Rendered as a plain link (not window.open after an await) so popup blockers never interfere
            const link = needsMessage && business && customer ? clientWhatsAppLink(invoice, customer, business) : null;
            return (
              <div key={invoice.id} className={clsx("flex items-center gap-3 p-3", done && "opacity-50")}>
                <button onClick={() => onNavigate('invoices')} className="flex-1 min-w-0 text-left">
                  <p className="text-sm text-white font-medium truncate">
                    {customer?.name ?? 'Unknown'} <span className="text-xs text-slate-500 font-normal">#{invoice.invoiceNumber}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reasons.map(reason => (
                      <span key={reason} className={clsx("text-[10px] px-1.5 py-0.5 rounded border", REASON_STYLES[reason])}>
                        {reasonLabel(reason, invoice)}
                      </span>
                    ))}
                    {done && <span className="text-[10px] px-1.5 py-0.5 text-slate-400">Messaged today</span>}
                  </div>
                </button>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markMessaged(invoice)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-xs font-medium transition-colors"
                    aria-label={`Message ${customer?.name ?? 'client'} on WhatsApp`}
                  >
                    <MessageCircle size={16} /> <span className="hidden sm:inline">Message</span>
                  </a>
                ) : (
                  <button onClick={() => onNavigate('invoices')} className="shrink-0 p-2 text-slate-500 hover:text-white" aria-label="Open invoices">
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            );
          })}
          {followUps.length > COLLAPSED_COUNT && (
            <button onClick={() => setExpanded(!expanded)} className="w-full p-3 text-xs text-indigo-400 hover:text-indigo-300">
              {expanded ? 'Show less' : `Show all ${followUps.length}`}
            </button>
          )}
        </GlassCard>
      )}
    </section>
  );
}
