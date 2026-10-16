import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Calculator, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
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
    <GlassCard className="p-6">
      <div className="flex flex-col md:flex-row gap-8">
         <div className="flex-1 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                   <label className={labelClass} htmlFor="inv-discountRate">Discount</label>
                   <button
                     type="button"
                     onClick={() => setValue('discountType', discountType === 'percentage' ? 'fixed' : 'percentage')}
                     className={clsx(HIT_AREA, "text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded text-indigo-300 transition-colors uppercase font-bold tracking-wide")}
                   >
                     {discountType === 'percentage' ? 'Use amount' : 'Use %'}
                   </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Percent size={14} /></span>
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
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-slate-300">
                Paid so far: <span className="font-bold text-white">{formatMoney(existing.depositAmount, currency)}</span>
                <p className="text-xs text-slate-500 mt-1">Use “Record Payment” on the invoice list to add payments.</p>
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="inv-depositAmount">Deposit / Initial Payment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{symbol}</span>
                  <input
                    id="inv-depositAmount"
                    type="number"
                    step="any"
                    min="0"
                    {...register('depositAmount', { valueAsNumber: true })}
                    className="w-full bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-4 pl-8 text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <p className="text-xs text-indigo-300/80 mt-2 flex items-center gap-1">
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

         <div className="w-full md:w-72 space-y-3 pt-2 bg-black/20 p-4 rounded-xl border border-white/5 h-fit">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Subtotal:</span>
              <span>{formatMoney(totals.subtotal, currency)}</span>
            </div>

            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>
                  Discount {discountType === 'percentage' ? `(${toNumber(discountRate)}%)` : '(Fixed)'}:
                </span>
                <span>-{formatMoney(totals.discount, currency)}</span>
              </div>
            )}

            {totals.tax > 0 && (
              <div className="flex justify-between text-sm text-slate-400">
                <span>{taxLabel || 'Tax'} ({toNumber(taxRate)}%):</span>
                <span>{formatMoney(totals.tax, currency)}</span>
              </div>
            )}

            <div className="h-px bg-white/10 my-2" />

            <div className="flex justify-between text-base font-semibold text-white">
              <span>Grand Total:</span>
              <span>{formatMoney(totals.grandTotal, currency)}</span>
            </div>

            {!isQuoteDoc && (
              <>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Paid:</span>
                  <span className="text-white">({formatMoney(toNumber(amountPaid), currency)})</span>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Balance Due:</span>
                  <span className={totals.balance > 0 ? "text-orange-400" : "text-green-400"}>
                    {formatMoney(totals.balance, currency)}
                  </span>
                </div>
              </>
            )}
         </div>
      </div>
    </GlassCard>
  );
}
