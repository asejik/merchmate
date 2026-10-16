import { useMemo } from 'react';
import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
import { inputClass } from './formStyles';
import { CURRENCY_SYMBOLS, formatMoney } from '../../../lib/currency';
import type { InvoiceDraft, Totals } from '../../../lib/invoice';
import { computeProfit } from '../../../lib/profit';

interface CostsSectionProps {
  control: Control<InvoiceDraft>;
  register: UseFormRegister<InvoiceDraft>;
  currency: InvoiceDraft['currency'];
  taxLabel: string;
  totals: Totals;
}

/** Private job costs and the profit they leave. Never shown to the client. */
export function CostsSection({ control, register, currency, taxLabel, totals }: CostsSectionProps) {
  const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({ control, name: "costs" });
  const costs = useWatch({ control, name: "costs" });
  const symbol = CURRENCY_SYMBOLS[currency];
  const profit = useMemo(() => computeProfit(totals.grandTotal, totals.tax, costs ?? []), [totals.grandTotal, totals.tax, costs]);

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lock size={18} className="text-indigo-400" /> My Costs
          </h2>
          <p className="text-xs text-slate-500 mt-1">Optional and private: never shown to the client. See what you actually make on this job.</p>
        </div>
        <button
          type="button"
          onClick={() => appendCost({ description: '', amount: 0 })}
          className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-indigo-300 transition-colors shrink-0"
        >
          <Plus size={14} /> Add Cost
        </button>
      </div>

      {costFields.length > 0 && (
        <div className="mt-4 space-y-2">
          {costFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-center">
              <input
                {...register(`costs.${index}.description` as const)}
                className={clsx(inputClass, "flex-1 min-w-0")}
                placeholder="e.g. Fabric, tailor, transport"
                aria-label="Cost description"
              />
              <div className="w-28 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{symbol}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  {...register(`costs.${index}.amount` as const, { valueAsNumber: true })}
                  className={clsx(inputClass, "text-right pl-6")}
                  aria-label="Cost amount"
                />
              </div>
              <button type="button" onClick={() => removeCost(index)} className="inline-flex items-center justify-center min-h-11 min-w-11 text-slate-500 hover:text-red-400 transition-colors" aria-label="Remove cost">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="mt-3 rounded-xl bg-black/20 border border-white/5 p-4 text-sm space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Your price{totals.tax > 0 ? ` (before ${taxLabel || 'tax'})` : ''}</span>
              <span>{formatMoney(profit.revenue, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Costs</span>
              <span>-{formatMoney(profit.cost, currency)}</span>
            </div>
            <div className="h-px bg-white/10 my-1" />
            <div className="flex justify-between font-bold">
              <span className="text-white">Profit</span>
              <span className={profit.profit < 0 ? "text-red-400" : "text-green-400"}>
                {formatMoney(profit.profit, currency)}
                {profit.margin !== null && <span className="text-xs font-normal text-slate-400"> · {profit.margin}%</span>}
              </span>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
