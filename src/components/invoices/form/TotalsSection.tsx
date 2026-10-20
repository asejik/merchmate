import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Calculator, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../ui/Card';
import { HIT_AREA } from '../../ui/styles';
import { inputClass, labelClass } from './formStyles';
import type { Invoice } from '../../../types';
import { CURRENCY_SYMBOLS, formatMoney } from '../../../lib/currency';
import { toNumber, type InvoiceDraft, type Totals } from '../../../lib/invoice';

interface TotalsSectionProps {
  register: UseFormRegister<InvoiceDraft>;
  setValue: UseFormSetValue<InvoiceDraft>;
  currency: InvoiceDraft['currency'];
  noun: string;
  isQuoteDoc: boolean;
  existing: Invoice | undefined;
  discountType: InvoiceDraft['discountType'];
  discountRate: number;
  taxRate: number;
  taxLabel: string;
  totals: Totals;
  amountPaid: number;
}

/** Discount, tax, deposit and notes, beside the running totals. */
export function TotalsSection({ register, setValue, currency, noun, isQuoteDoc, existing, discountType, discountRate, taxRate, taxLabel, totals, amountPaid }: TotalsSectionProps) {
  const symbol = CURRENCY_SYMBOLS[currency];
  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row gap-8">
         <div className="flex-1 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                   <label className={labelClass} htmlFor="inv-discountRate">Discount</label>
                   <button
                     type="button"
                     onClick={() => setValue('discountType', discountType === 'percentage' ? 'fixed' : 'percentage')}
                     className={clsx(HIT_AREA, "rounded-lg bg-primary-tint px-2 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-80")}
                   >
                     {discountType === 'percentage' ? 'Use amount' : 'Use %'}
                   </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">
                    {discountType === 'percentage' ? <Percent size={14} /> : symbol}
                  </span>
                  <input
                    id="inv-discountRate"
                    type="number"
                    step="any"
                    {...register('discountRate', { valueAsNumber: true })}
                    className={clsx(inputClass, "pl-9")}
                    placeholder={discountType === 'percentage' ? "0%" : "0.00"}
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="inv-taxRate">Tax</label>
                <div className="flex gap-2">
                  <input {...register('taxLabel')} className={clsx(inputClass, "w-20")} placeholder="VAT" aria-label="Tax name" />
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Percent size={14} /></span>
                    <input
                      id="inv-taxRate"
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      {...register('taxRate', { valueAsNumber: true })}
                      className={clsx(inputClass, "pl-9")}
                      placeholder="0"
                      aria-label="Tax rate"
                    />
                  </div>
                </div>
              </div>
            </div>

            {isQuoteDoc ? null : existing ? (
              <div className="rounded-xl bg-sunken p-4 text-sm text-muted">
                Paid so far: <span className="font-bold text-ink">{formatMoney(existing.depositAmount, currency)}</span>
                <p className="text-xs text-muted mt-1">Use “Record Payment” on the invoice list to add payments.</p>
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="inv-depositAmount">Deposit / Initial Payment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{symbol}</span>
                  <input
                    id="inv-depositAmount"
                    type="number"
                    step="any"
                    min="0"
                    {...register('depositAmount', { valueAsNumber: true })}
                    className={clsx(inputClass, "money pl-8 text-xl font-bold")}
                  />
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Calculator size={12} />
                  Any amount already paid upfront.
                </p>
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="inv-notes">Notes (shown on {noun.toLowerCase()})</label>
              <textarea id="inv-notes"
                {...register('notes')}
                rows={2}
                className={inputClass}
                placeholder="e.g. Delivery by Friday. Thank you for your order!"
              />
            </div>
         </div>

         <div className="w-full md:w-72 space-y-3 bg-sunken p-4 rounded-xl h-fit">
            <div className="flex justify-between text-sm text-muted">
              <span>Subtotal:</span>
              <span>{formatMoney(totals.subtotal, currency)}</span>
            </div>

            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>
                  Discount {discountType === 'percentage' ? `(${toNumber(discountRate)}%)` : '(Fixed)'}:
                </span>
                <span>-{formatMoney(totals.discount, currency)}</span>
              </div>
            )}

            {totals.tax > 0 && (
              <div className="flex justify-between text-sm text-muted">
                <span>{taxLabel || 'Tax'} ({toNumber(taxRate)}%):</span>
                <span>{formatMoney(totals.tax, currency)}</span>
              </div>
            )}

            <div className="h-px bg-line my-2" />

            <div className="flex justify-between text-base font-semibold text-ink">
              <span>Grand Total:</span>
              <span>{formatMoney(totals.grandTotal, currency)}</span>
            </div>

            {!isQuoteDoc && (
              <>
                <div className="flex justify-between text-sm text-muted">
                  <span>Paid:</span>
                  <span className="text-ink">({formatMoney(toNumber(amountPaid), currency)})</span>
                </div>

                <div className="h-px bg-line my-2" />

                <div className="flex justify-between text-lg font-bold">
                  <span className="text-ink">Balance Due:</span>
                  <span className={totals.balance > 0 ? "text-ink" : "text-success"}>
                    {formatMoney(totals.balance, currency)}
                  </span>
                </div>
              </>
            )}
         </div>
      </div>
    </Card>
  );
}
