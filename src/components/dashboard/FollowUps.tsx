import { useMemo, useState } from 'react';
import { MessageCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../../db';
import { Card } from '../ui/Card';
import { Chip, type ChipTone } from '../ui/Chip';
import type { AppTab, BusinessProfile, Customer, Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { getBalance, getOverdueAmount, getUnconfirmedAmount } from '../../lib/invoice';
import { buildFollowUps, type FollowUpReason } from '../../lib/followups';
import { clientWhatsAppLink } from '../../lib/whatsapp';

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  business?: BusinessProfile;
  onNavigate: (tab: AppTab) => void;
}

const COLLAPSED_COUNT = 5;

const REASON_TONES: Record<FollowUpReason, ChipTone> = {
  unconfirmed: 'warning',
  ready: 'primary',
  overdue: 'danger',
  'delivery-late': 'danger',
  'delivery-today': 'warning',
};

function reasonLabel(reason: FollowUpReason, invoice: Invoice): string {
  const money = (value: number) => formatMoney(value, invoice.currency, { trimZeros: true });
  switch (reason) {
    case 'unconfirmed': return `Check bank for ${money(getUnconfirmedAmount(invoice))}`;
    case 'ready': return getBalance(invoice) > 0 ? `Ready · collect ${money(getBalance(invoice))}` : 'Ready · tell client';
    case 'overdue': return `Overdue · ${money(getOverdueAmount(invoice))}`;
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
        <h2 id="today-heading" className="text-base font-bold text-ink">Today</h2>
        {followUps.length > 0 && (
          <span className="text-xs text-muted">{pending === 0 ? 'All done' : `${pending} to do`}</span>
        )}
      </div>

      {followUps.length === 0 ? (
        <Card className="p-4 flex items-center gap-3 text-sm text-muted">
          <CheckCircle2 size={18} className="text-success shrink-0" aria-hidden="true" />
          Nothing to chase. No overdue balances, ready orders or unchecked transfers.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {visible.map(({ invoice, customer, reasons, needsMessage, done }) => {
            // Rendered as a plain link (not window.open after an await) so popup blockers never interfere
            const link = needsMessage && business && customer ? clientWhatsAppLink(invoice, customer, business) : null;
            return (
              <div key={invoice.id} className="flex items-center gap-3 p-3">
                <button onClick={() => onNavigate('invoices')} className="flex-1 min-w-0 min-h-11 text-left">
                  <p className={clsx("text-sm font-semibold truncate", done ? "text-muted" : "text-ink")}>
                    {customer?.name ?? 'Unknown'} <span className="text-xs text-muted font-normal">#{invoice.invoiceNumber}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {reasons.map(reason => (
                      <Chip key={reason} tone={REASON_TONES[reason]}>{reasonLabel(reason, invoice)}</Chip>
                    ))}
                    {done && <span className="text-xs text-muted self-center">Messaged today</span>}
                  </div>
                </button>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markMessaged(invoice)}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-xl border border-line-strong text-primary hover:bg-primary-tint text-sm font-semibold transition-colors duration-150"
                    aria-label={`Message ${customer?.name ?? 'client'} on WhatsApp`}
                  >
                    <MessageCircle size={18} aria-hidden="true" /> <span className="hidden sm:inline">Message</span>
                  </a>
                ) : (
                  <button onClick={() => onNavigate('invoices')} className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl text-muted hover:bg-sunken hover:text-ink" aria-label="Open invoices">
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          {followUps.length > COLLAPSED_COUNT && (
            <button onClick={() => setExpanded(!expanded)} className="w-full min-h-11 p-3 text-sm font-semibold text-primary hover:bg-primary-tint">
              {expanded ? 'Show less' : `Show all ${followUps.length}`}
            </button>
          )}
        </Card>
      )}
    </section>
  );
}
