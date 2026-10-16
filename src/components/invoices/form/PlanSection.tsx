import { useMemo } from 'react';
import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
import { HIT_AREA } from '../../ui/styles';
import { inputClass } from './formStyles';
import { formatMoney } from '../../../lib/currency';
import { planAmounts, toNumber, type InvoiceDraft, type PlanDraftStep } from '../../../lib/invoice';

// Common splits for made-to-order work; the first instalment is due on the invoice date
const PLAN_PRESETS: { label: string; steps: Omit<PlanDraftStep, 'dueDate'>[] }[] = [
  { label: '50 / 50', steps: [{ label: 'Deposit', percent: 50 }, { label: 'Balance', percent: 50 }] },
  { label: '50 / 30 / 20', steps: [{ label: 'Deposit', percent: 50 }, { label: 'At fitting', percent: 30 }, { label: 'On collection', percent: 20 }] },
  { label: '70 / 30', steps: [{ label: 'Deposit', percent: 70 }, { label: 'On delivery', percent: 30 }] },
];

interface PlanSectionProps {
  control: Control<InvoiceDraft>;
  register: UseFormRegister<InvoiceDraft>;
  currency: InvoiceDraft['currency'];
  dateIssued: string;
  grandTotal: number;
}

/** Optional instalments: split the total into stages with their own dates. */
export function PlanSection({ control, register, currency, dateIssued, grandTotal }: PlanSectionProps) {
  const { fields: planFields, append: appendStep, remove: removeStep, replace: replacePlan } = useFieldArray({ control, name: "plan" });
  const plan = useWatch({ control, name: "plan" });
  const planSplit = useMemo(() => planAmounts(grandTotal, plan ?? []), [grandTotal, plan]);
  const planPercentTotal = (plan ?? []).reduce((sum, step) => sum + toNumber(step.percent), 0);

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CalendarClock size={18} className="text-indigo-400" /> Payment Plan
          </h3>
          <p className="text-xs text-slate-500 mt-1">Optional. Split the total into instalments, e.g. deposit, at fitting, on collection.</p>
        </div>
        {planFields.length > 0 && (
          <button type="button" onClick={() => replacePlan([])} className="text-xs text-slate-500 hover:text-red-400 shrink-0">
            Remove plan
          </button>
        )}
      </div>

      {planFields.length === 0 ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {PLAN_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => replacePlan(preset.steps.map((step, i) => ({ ...step, dueDate: i === 0 ? dateIssued : '' })))}
              className={clsx(HIT_AREA, "text-xs bg-white/5 hover:bg-white/15 border border-white/10 px-3 py-2 rounded-lg text-slate-200 transition-colors")}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {planFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_5rem_2rem] sm:grid-cols-[1fr_5rem_10rem_8rem_2rem] gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/5">
              <input {...register(`plan.${index}.label` as const)} className={inputClass} placeholder={`Instalment ${index + 1}`} aria-label="Instalment name" />
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  {...register(`plan.${index}.percent` as const, { valueAsNumber: true })}
                  className={clsx(inputClass, "pr-6 text-right")}
                  aria-label="Percentage"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
              </div>
              <button type="button" onClick={() => removeStep(index)} className="p-2 text-slate-500 hover:text-red-400 transition-colors sm:order-last" aria-label="Remove instalment">
                <Trash2 size={16} />
              </button>
              <input type="date" {...register(`plan.${index}.dueDate` as const)} className={inputClass} aria-label="Due by (optional)" title="Due by (leave empty for no fixed date)" />
              <span className="col-span-2 sm:col-span-1 text-xs sm:text-sm text-slate-300 text-right font-mono truncate">{formatMoney(planSplit[index] ?? 0, currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => appendStep({ label: '', percent: Math.max(0, 100 - planPercentTotal), dueDate: '' })}
              className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-indigo-300 transition-colors"
            >
              <Plus size={14} /> Add Instalment
            </button>
            <span className={clsx("text-xs", Math.abs(planPercentTotal - 100) > 0.01 ? "text-orange-400" : "text-slate-500")}>
              Total {Math.round(planPercentTotal * 100) / 100}% {Math.abs(planPercentTotal - 100) > 0.01 && '(must be 100%)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Leave a date empty for stages with no fixed day, like "on collection". Reminders ask for the instalment due, not the whole balance.</p>
        </div>
      )}
    </GlassCard>
  );
}
