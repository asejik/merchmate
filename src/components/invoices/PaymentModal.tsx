import { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { X, Save, History, Calculator } from 'lucide-react';
import type { Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { getBalance, getPaymentHistory } from '../../lib/invoice';

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSave: (amount: number, note: string) => void;
}

export function PaymentModal({ invoice, onClose, onSave }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const history = getPaymentHistory(invoice);
  const remaining = getBalance(invoice);
  const money = (value: number) => formatMoney(value, invoice.currency);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) return;
    if (val > remaining) {
      if(!confirm("Amount exceeds balance. Continue?")) return;
    }
    onSave(val, note);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator size={20} className="text-indigo-400" />
            Record Payment
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Section 1: Payment History */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <History size={14} /> Payment History
            </h4>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((rec) => (
                  <div key={rec.id} className="flex justify-between items-center text-sm p-2 rounded bg-white/5 border border-white/5">
                    <div>
                      <span className="text-slate-300 block">{new Date(rec.date).toLocaleDateString()}</span>
                      <span className="text-[10px] text-slate-500">{rec.note || 'Payment'}</span>
                    </div>
                    <span className="text-green-400 font-mono font-bold">
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
              <span>-{money(invoice.depositAmount)}</span>
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
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">New Amount</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">{invoice.currency}</span>
                   <input
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
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Note (Optional)</label>
                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Bank Transfer, Cash"
                  />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Confirm Payment
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