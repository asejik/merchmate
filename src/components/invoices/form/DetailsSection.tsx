import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { clsx } from 'clsx';
import { FieldError } from '../../ui/FieldError';
import { Card } from '../../ui/Card';
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
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span id="inv-currency-label" className={labelClass}>Currency</span>
          <div className="flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-labelledby="inv-currency-label">
            {CURRENCY_CODES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setValue('currency', c)}
                className={clsx(
                  "flex-1 min-h-11 text-sm font-semibold rounded-lg transition-colors duration-150",
                  currency === c ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-invoiceNumber">{noun} #</label>
          <input id="inv-invoiceNumber" aria-invalid={!!errors.invoiceNumber} aria-describedby={errors.invoiceNumber ? 'inv-invoiceNumber-error' : undefined} {...register('invoiceNumber', { required: "Required" })} className={inputClass} />
          <FieldError id="inv-invoiceNumber-error" message={errors.invoiceNumber?.message} />
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-customerId">Customer</label>
          <select id="inv-customerId" aria-invalid={!!errors.customerId} aria-describedby={errors.customerId ? 'inv-customerId-error' : undefined}
            {...register('customerId', { required: "Select a client" })}
            className={inputClass}
          >
            <option value="">Select a client...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
            ))}
          </select>
          <FieldError id="inv-customerId-error" message={errors.customerId?.message} />
        </div>
      </div>

      {customers?.length === 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-warning-tint p-3">
          <span className="text-sm text-warning">No clients yet.</span>
          <button type="button" onClick={onAddClient} className="min-h-11 px-2 text-sm font-semibold text-primary underline">Add a client</button>
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
                  className={clsx(HIT_AREA, "text-xs font-medium bg-sunken hover:bg-primary-tint px-2.5 py-1.5 rounded-lg text-ink transition-colors duration-150")}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setValue('dueDate', '')}
                className={clsx(HIT_AREA, "text-xs font-medium px-2.5 py-1.5 rounded-lg text-muted hover:text-ink transition-colors duration-150")}
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
        <p className="md:col-span-2 self-end text-xs text-muted pb-2">
          Optional. When you promised the order. Shown on the {noun.toLowerCase()} and flagged if it slips.
        </p>
      </div>
    </Card>
  );
}
