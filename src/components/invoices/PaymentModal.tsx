import { useState } from 'react';
import { Card } from '../ui/Card';
import { useDialog } from '../ui/useDialog';
import { useDialogs } from '../ui/dialogContext';
import { BUTTON_PRIMARY, FIELD_CLASS, FIELD_LABEL, OVERLAY_CLASS } from '../ui/styles';
import { X, Save, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import type { Invoice } from '../../types';
import { CURRENCY_SYMBOLS, formatMoney } from '../../lib/currency';
import { getBalance } from '../../lib/invoice';

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSave: (amount: number, note: string, unconfirmed: boolean) => void;
}

const METHODS = ['Transfer', 'Cash', 'POS', 'Other'] as const;
type Method = typeof METHODS[number];

export function PaymentModal({ invoice, onClose, onSave }: Props) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const { confirm } = useDialogs();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<Method>('Transfer');
  const [seenInBank, setSeenInBank] = useState(false);
  // Transfer alerts and screenshots can be faked, so transfers need an explicit bank check
  const unconfirmed = method === 'Transfer' && !seenInBank;

  const remaining = getBalance(invoice);
  const money = (value: number) => formatMoney(value, invoice.currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) return;
    if (val > remaining) {
      const proceed = await confirm({
        title: 'More than the balance',
        message: `${money(val)} is more than the ${money(remaining)} still owed on this invoice. Record it anyway?`,
        confirmLabel: 'Record anyway',
      });
      if (!proceed) return;
    }
    const label = method === 'Other' ? '' : method;
    onSave(val, [label, note.trim()].filter(Boolean).join(' - '), unconfirmed);
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-heading" className={OVERLAY_CLASS}>
      <Card className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden shadow-raised">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 id="payment-heading" className="text-lg font-bold text-ink">Record payment</h2>
          <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-xl bg-sunken p-4">
            <div className="mb-1 flex justify-between text-sm text-muted">
              <span>Invoice total</span>
              <span className="money">{money(invoice.grandTotal)}</span>
            </div>
            <div className="mb-2 flex justify-between text-sm text-success">
              <span>Paid so far</span>
              <span className="money">{invoice.depositAmount > 0 ? '−' : ''}{money(invoice.depositAmount)}</span>
            </div>
            <div className="my-2 h-px bg-line" />
            <div className="flex justify-between text-lg font-bold text-ink">
              <span>Balance due</span>
              <span className="money">{money(remaining)}</span>
            </div>
          </div>

          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pay-amount" className={FIELD_LABEL}>New amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted" aria-hidden="true">{CURRENCY_SYMBOLS[invoice.currency]}</span>
                  <input
                    id="pay-amount"
                    type="number"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={clsx(FIELD_CLASS, 'money pl-10 text-xl font-bold')}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <span className={FIELD_LABEL} id="pay-method-label">Paid by</span>
                <div className="flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-labelledby="pay-method-label">
                  {METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setMethod(m)}
                      className={clsx(
                        'min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors duration-150',
                        method === m ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {method === 'Transfer' && (
                <div className={clsx('rounded-xl p-3', seenInBank ? 'bg-success-tint' : 'bg-warning-tint')}>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={seenInBank}
                      onChange={(e) => setSeenInBank(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span>I've checked my own bank app and the money is there</span>
                  </label>
                  {!seenInBank && (
                    <p className="mt-2 flex gap-1.5 text-xs text-warning">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      Alerts and screenshots can be faked. Until you confirm it, this is saved as awaiting confirmation: it won't reduce the balance or get a receipt.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className={FIELD_LABEL} htmlFor="pay-note-optional">Note (optional)</label>
                <input id="pay-note-optional"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="e.g. Sent by her husband"
                />
              </div>

              <button type="submit" className={clsx(BUTTON_PRIMARY, 'w-full')}>
                <Save size={18} aria-hidden="true" />
                {unconfirmed ? 'Save as awaiting confirmation' : 'Confirm payment'}
              </button>
            </form>
          ) : (
            <div className="rounded-xl bg-success-tint p-4 text-center">
              <span className="font-bold text-success">Invoice fully paid</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
