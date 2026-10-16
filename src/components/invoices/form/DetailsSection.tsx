import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
import { HIT_AREA } from '../../ui/styles';
import { inputClass, labelClass } from './formStyles';
import type { Customer } from '../../../types';
import { CURRENCY_CODES } from '../../../lib/currency';
import { addDays, type InvoiceDraft } from '../../../lib/invoice';

const DUE_PRESETS = [
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

interface DetailsSectionProps {
  register: UseFormRegister<InvoiceDraft>;
  errors: FieldErrors<InvoiceDraft>;
  setValue: UseFormSetValue<InvoiceDraft>;
  currency: InvoiceDraft['currency'];
  dateIssued: string;
  noun: string;
  isQuoteDoc: boolean;
  customers: Customer[];
  onAddClient: () => void;
}

/** Currency, number, client and the dates (issued, due, delivery). */
export function DetailsSection({ register, errors, setValue, currency, dateIssued, noun, isQuoteDoc, customers, onAddClient }: DetailsSectionProps) {
  return (
    <GlassCard className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span id="inv-currency-label" className={labelClass}>Currency</span>
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10" role="radiogroup" aria-labelledby="inv-currency-label">
            {CURRENCY_CODES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setValue('currency', c)}
                className={clsx(
                  "flex-1 min-h-11 text-xs font-medium rounded-md transition-all",
                  currency === c ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-invoiceNumber">{noun} #</label>
          <input id="inv-invoiceNumber" {...register('invoiceNumber', { required: "Required" })} className={inputClass} />
          {errors.invoiceNumber && <span className="text-red-400 text-xs">{errors.invoiceNumber.message}</span>}
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-customerId">Customer</label>
          <select id="inv-customerId"
            {...register('customerId', { required: "Select a client" })}
            className={clsx(inputClass, "[&>option]:bg-slate-900 [&>option]:text-white")}
          >
            <option value="">Select a client...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
            ))}
          </select>
          {errors.customerId && <span className="text-red-400 text-xs">{errors.customerId.message}</span>}
        </div>
      </div>

      {customers?.length === 0 && (
        <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
          <span className="text-xs text-orange-200">No clients found.</span>
          <button type="button" onClick={onAddClient} className="text-xs font-bold text-orange-400 hover:text-orange-300 underline">+ Add New Client</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div>
          <label className={labelClass} htmlFor="inv-dateIssued">{noun} Date</label>
          <input id="inv-dateIssued" type="date" {...register('dateIssued', { required: true })} className={inputClass} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="inv-dueDate">{isQuoteDoc ? 'Valid Until' : 'Due Date'}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="inv-dueDate" type="date" {...register('dueDate')} className={clsx(inputClass, "sm:max-w-[180px]")} />
            <div className="flex flex-wrap gap-1">
              {DUE_PRESETS.map(preset => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setValue('dueDate', addDays(dateIssued, preset.days))}
                  className={clsx(HIT_AREA, "text-[11px] bg-white/5 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-md text-slate-300 transition-colors")}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setValue('dueDate', '')}
                className={clsx(HIT_AREA, "text-[11px] px-2.5 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors")}
              >
                None
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-deliveryDate">Delivery / Pickup Date</label>
          <input id="inv-deliveryDate" type="date" {...register('deliveryDate')} className={inputClass} />
        </div>
        <p className="md:col-span-2 self-end text-xs text-slate-500 pb-2">
          Optional. When you promised the order. Shown on the {noun.toLowerCase()} and flagged if it slips.
        </p>
      </div>
    </GlassCard>
  );
}
