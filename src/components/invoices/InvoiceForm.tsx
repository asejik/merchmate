import { useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { Save, Plus, Trash2, Calculator, ArrowLeft, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import type { Invoice, CurrencyCode, DiscountType } from '../../types';
import { CURRENCY_CODES, CURRENCY_SYMBOLS, formatMoney } from '../../lib/currency';
import { calculateTotals, deriveStatus, lineTotal, nextInvoiceNumber, toNumber } from '../../lib/invoice';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
  onAddClient: () => void;
}

interface InvoiceFormValues {
  currency: CurrencyCode;
  invoiceNumber: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  depositAmount: number;
  discountRate: number;
  discountType: DiscountType;
  dateIssued: string;
  customerId: string;
}

const EMPTY_ITEM = { description: '', quantity: 1, unitPrice: 0 };

export function InvoiceForm({ onComplete, onCancel, onAddClient }: Props) {
  const customers = useLiveQuery(() => db.customers.toArray());

  const { register, control, handleSubmit, setValue } = useForm<InvoiceFormValues>({
    defaultValues: {
      currency: 'NGN',
      invoiceNumber: 'Loading...',
      items: [EMPTY_ITEM],
      depositAmount: 0,
      discountRate: 0,
      discountType: 'percentage',
      dateIssued: new Date().toISOString().split('T')[0],
      customerId: ''
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = useWatch({ control, name: "items" });
  const deposit = useWatch({ control, name: "depositAmount" });
  const currency = useWatch({ control, name: "currency" });
  const discountRate = useWatch({ control, name: "discountRate" });
  const discountType = useWatch({ control, name: "discountType" });
  const symbol = CURRENCY_SYMBOLS[currency];

  // Sequential numbering: one past the highest number already used
  useEffect(() => {
    db.invoices.orderBy('invoiceNumber').keys()
      .then(keys => setValue('invoiceNumber', nextInvoiceNumber(keys.map(String))))
      .catch(() => setValue('invoiceNumber', nextInvoiceNumber([])));
  }, [setValue]);

  const totals = useMemo(
    () => calculateTotals({ items: items ?? [], discountType, discountRate, amountPaid: deposit }),
    [items, deposit, discountRate, discountType]
  );

  const onSubmit = async (data: InvoiceFormValues) => {
    if (!data.customerId) {
      alert("Please select a customer");
      return;
    }

    const now = new Date();
    const amountPaid = toNumber(data.depositAmount);
    const invoiceData: Invoice = {
      id: crypto.randomUUID(),
      customerId: data.customerId,
      invoiceNumber: data.invoiceNumber.trim(),
      items: data.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
        total: lineTotal(item.quantity, item.unitPrice),
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountRate: toNumber(data.discountRate),
      discountType: data.discountType,
      tax: 0,
      grandTotal: totals.grandTotal,
      depositAmount: amountPaid,
      currency: data.currency,
      status: deriveStatus(totals.grandTotal, amountPaid),
      dateIssued: new Date(data.dateIssued),
      isSynced: false,
      createdAt: now,
      updatedAt: now
    };

    try {
      await db.invoices.add(invoiceData);
      onComplete();
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice");
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all text-sm";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1 uppercase";

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">New Invoice</h2>
          <p className="text-slate-400 text-sm">Bill a client for goods or services.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        <GlassCard className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Currency</label>
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                {CURRENCY_CODES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('currency', c)}
                    className={clsx(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                      currency === c ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Invoice #</label>
              <input {...register('invoiceNumber', { required: "Required" })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" {...register('dateIssued', { required: true })} className={inputClass} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Customer</label>
            <select
              {...register('customerId', { required: "Required" })}
              className={clsx(inputClass, "[&>option]:bg-slate-900 [&>option]:text-white")}
            >
              <option value="">Select a client...</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
            {customers?.length === 0 && (
              <div className="mt-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
                <span className="text-xs text-orange-200">No clients found.</span>
                <button type="button" onClick={onAddClient} className="text-xs font-bold text-orange-400 hover:text-orange-300 underline">+ Add New Client</button>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Items</h3>
            <button
              type="button"
              onClick={() => append(EMPTY_ITEM)}
              className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-indigo-300 transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex-1 w-full">
                  <input
                    {...register(`items.${index}.description` as const, { required: true })}
                    placeholder="Item description"
                    className="bg-transparent border-none text-white placeholder-slate-600 focus:ring-0 w-full p-0 text-sm"
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="w-20">
                     <input
                       type="number"
                       step="any" // Allows fractional quantities, e.g. 3.5 hours
                       {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                       className={clsx(inputClass, "text-right")}
                       placeholder="Qty"
                       min="0"
                     />
                  </div>
                  <div className="w-32 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{symbol}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                      className={clsx(inputClass, "text-right pl-6")}
                      placeholder="Price"
                    />
                  </div>
                  <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="p-2 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-500" aria-label="Remove item">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row gap-8">
             <div className="flex-1 space-y-4">

                <div>
                  <div className="flex justify-between items-center mb-1">
                     <label className={labelClass}>Discount</label>
                     <button
                       type="button"
                       onClick={() => setValue('discountType', discountType === 'percentage' ? 'fixed' : 'percentage')}
                       className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-indigo-300 transition-colors uppercase font-bold tracking-wide"
                     >
                       Switch to {discountType === 'percentage' ? 'Fixed Amount' : 'Percentage'}
                     </button>
                  </div>

                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                      {discountType === 'percentage' ? <Percent size={14} /> : symbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      {...register('discountRate', { valueAsNumber: true })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pl-9 text-white focus:outline-none focus:border-indigo-500 transition-all"
                      placeholder={discountType === 'percentage' ? "0%" : "0.00"}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Deposit / Initial Payment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{symbol}</span>
                    <input
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

                <div className="h-px bg-white/10 my-2" />

                <div className="flex justify-between text-base font-semibold text-white">
                  <span>Grand Total:</span>
                  <span>{formatMoney(totals.grandTotal, currency)}</span>
                </div>

                <div className="flex justify-between text-sm text-slate-400">
                  <span>Paid / Deposit:</span>
                  <span className="text-white">({formatMoney(toNumber(deposit), currency)})</span>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Balance Due:</span>
                  <span className={totals.balance > 0 ? "text-orange-400" : "text-green-400"}>
                    {formatMoney(totals.balance, currency)}
                  </span>
                </div>
             </div>
          </div>
        </GlassCard>

        <div className="flex justify-end pt-4">
           <button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1">
            <Save size={20} />
            Generate Invoice
          </button>
        </div>
      </form>
    </div>
  );
}
