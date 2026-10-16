import { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { useDialog } from '../ui/useDialog';
import { useDialogs } from '../ui/dialogContext';
import { INPUT_CLASS } from '../ui/styles';
import { X, Save, History, Calculator, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import type { DateFormat, Invoice } from '../../types';
import { formatDate } from '../../lib/dates';
import { CURRENCY_SYMBOLS, formatMoney } from '../../lib/currency';
import { getBalance, getPaymentHistory } from '../../lib/invoice';

interface Props {
  invoice: Invoice;
  dateFormat?: DateFormat;
  onClose: () => void;
  onSave: (amount: number, note: string, unconfirmed: boolean) => void;
}

const METHODS = ['Transfer', 'Cash', 'POS', 'Other'] as const;
type Method = typeof METHODS[number];

export function PaymentModal({ invoice, dateFormat, onClose, onSave }: Props) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const { confirm } = useDialogs();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<Method>('Transfer');
  const [seenInBank, setSeenInBank] = useState(false);
  // Transfer alerts and screenshots can be faked, so transfers need an explicit bank check
  const unconfirmed = method === 'Transfer' && !seenInBank;

  const history = getPaymentHistory(invoice);
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
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-heading" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 id="payment-heading" className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator size={20} className="text-indigo-400" />
            Record Payment
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Section 1: Payment History */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <History size={14} /> Payment History
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((rec) => (
                  <div key={rec.id} className="flex justify-between items-center text-sm p-2 rounded bg-white/5 border border-white/5">
                    <div>
                      <span className="text-slate-300 block">{formatDate(rec.date, dateFormat, { moment: true })}</span>
                      <span className="text-[10px] text-slate-500">{rec.note || 'Payment'}</span>
                      {rec.unconfirmed && <span className="ml-2 text-[10px] text-amber-300">Awaiting confirmation</span>}
                    </div>
                    <span className={clsx("font-mono font-bold", rec.unconfirmed ? "text-amber-300/70" : "text-green-400")}>
                      +{money(rec.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Balance Info */}
          <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/10">
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Grand Total</span>
              <span>{money(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-400 mb-2">
              <span>Total Paid</span>
              <span>{invoice.depositAmount > 0 ? '−' : ''}{money(invoice.depositAmount)}</span>
            </div>
            <div className="h-px bg-white/10 my-2" />
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Balance Due</span>
              <span className="text-orange-400">{money(remaining)}</span>
            </div>
          </div>

          {/* Section 3: Add New Payment */}
          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-400 mb-1 uppercase">New Amount</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">{CURRENCY_SYMBOLS[invoice.currency]}</span>
                   <input
                    id="pay-amount"
                    type="number"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-indigo-500/10 border border-indigo-500/50 rounded-xl px-4 py-3 pl-10 text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-indigo-500/30"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-400 mb-1 uppercase">Paid By</span>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10" role="radiogroup" aria-label="Payment method">
                  {METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setMethod(m)}
                      className={clsx(
                        "flex-1 min-h-11 text-xs font-medium rounded-md transition-all",
                        method === m ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {method === 'Transfer' && (
                <div className={clsx("rounded-xl border p-3 transition-colors", seenInBank ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10")}>
                  <label className="flex items-start gap-3 text-sm text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seenInBank}
                      onChange={(e) => setSeenInBank(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-green-500"
                    />
                    <span>I've checked my own bank app and the money is there</span>
                  </label>
                  {!seenInBank && (
                    <p className="mt-2 text-xs text-amber-200/90 flex gap-1.5">
                      <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                      Alerts and screenshots can be faked. Until you confirm it, this is saved as awaiting confirmation: it won't reduce the balance or get a receipt.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase" htmlFor="pay-note-optional">Note (Optional)</label>
                <input id="pay-note-optional"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="e.g. Sent by her husband"
                  />
              </div>

              <button
                type="submit"
                className={clsx(
                  "w-full text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2",
                  unconfirmed ? "bg-amber-700 hover:bg-amber-600 shadow-amber-500/20" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                )}
              >
                <Save size={18} />
                {unconfirmed ? 'Save as Awaiting Confirmation' : 'Confirm Payment'}
              </button>
            </form>
          ) : (
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <span className="text-green-400 font-bold">Invoice Fully Paid ✅</span>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}