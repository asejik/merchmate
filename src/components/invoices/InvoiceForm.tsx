import { useMemo, useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { Save, Plus, Trash2, Calculator, ArrowLeft, Percent, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { DocumentKind, Invoice } from '../../types';
import { CURRENCY_CODES, CURRENCY_SYMBOLS, formatMoney } from '../../lib/currency';
import {
  addDays,
  calculateTotals,
  composeInvoice,
  convertQuoteDraft,
  duplicateDraft,
  invoiceToDraft,
  kindOf,
  nextInvoiceNumber,
  QUOTE_PREFIX,
  todayInputValue,
  toNumber,
  type InvoiceDraft,
} from '../../lib/invoice';
import { findCatalogItem, learnFromItems, sortCatalog } from '../../lib/catalog';

export type InvoiceEditorMode = 'create' | 'create-quote' | 'edit' | 'duplicate' | 'convert';

interface Props {
  mode: InvoiceEditorMode;
  /** Invoice/quote to edit, copy or convert (ignored when creating). */
  sourceInvoiceId?: string;
  onComplete: (kind: DocumentKind) => void;
  onCancel: () => void;
  onAddClient: () => void;
}

const EMPTY_ITEM = { description: '', quantity: 1, unitPrice: 0 };
const DUE_PRESETS = [
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

function titles(mode: InvoiceEditorMode, kind: DocumentKind): { title: string; subtitle: string; submit: string } {
  const noun = kind === 'quote' ? 'Quote' : 'Invoice';
  switch (mode) {
    case 'edit':
      return { title: `Edit ${noun}`, subtitle: kind === 'quote' ? 'Update the quote before sending it again.' : 'Payments already recorded are kept.', submit: 'Save Changes' };
    case 'duplicate':
      return { title: `Duplicate ${noun}`, subtitle: 'A fresh copy with a new number.', submit: `Create ${noun}` };
    case 'convert':
      return { title: 'Convert Quote to Invoice', subtitle: 'Same items and prices. Adjust anything before saving.', submit: 'Create Invoice' };
    case 'create-quote':
      return { title: 'New Quote', subtitle: 'Send a price estimate. Convert it to an invoice once accepted.', submit: 'Create Quote' };
    default:
      return { title: 'New Invoice', subtitle: 'Bill a client for goods or services.', submit: 'Generate Invoice' };
  }
}

interface InitialState {
  values: InvoiceDraft;
  kind: DocumentKind;
  existing?: Invoice;
  convertFrom?: Invoice;
}

async function loadInitialValues(mode: InvoiceEditorMode, sourceInvoiceId?: string): Promise<InitialState> {
  const [all, profile, source] = await Promise.all([
    db.invoices.toArray(),
    db.businessProfile.orderBy('id').first(),
    sourceInvoiceId ? db.invoices.get(sourceInvoiceId) : undefined,
  ]);
  // Invoices and quotes are numbered independently, each continuing from its most recent number
  const nextNumber = (kind: DocumentKind) => nextInvoiceNumber(
    all
      .filter(doc => kindOf(doc) === kind)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(doc => doc.invoiceNumber),
    kind === 'quote' ? QUOTE_PREFIX : undefined,
  );
  if (mode !== 'create' && mode !== 'create-quote' && !source) throw new Error('Invoice not found');

  if (mode === 'edit' && source) return { values: invoiceToDraft(source), kind: kindOf(source), existing: source };
  if (mode === 'duplicate' && source) return { values: duplicateDraft(source, nextNumber(kindOf(source))), kind: kindOf(source) };
  if (mode === 'convert' && source) {
    return { values: convertQuoteDraft(source, nextNumber('invoice'), profile?.defaultDueDays), kind: 'invoice', convertFrom: source };
  }

  const kind: DocumentKind = mode === 'create-quote' ? 'quote' : 'invoice';
  const today = todayInputValue();
  // Quotes default to 30 days validity; invoices use the business's payment terms
  const dueDays = kind === 'quote' ? 30 : profile?.defaultDueDays;
  return {
    kind,
    values: {
      customerId: '',
      invoiceNumber: nextNumber(kind),
      currency: 'NGN',
      dateIssued: today,
      dueDate: dueDays !== undefined ? addDays(today, dueDays) : '',
      items: [EMPTY_ITEM],
      discountType: 'percentage',
      discountRate: 0,
      taxRate: profile?.defaultTaxRate ?? 0,
      taxLabel: profile?.taxLabel || 'VAT',
      notes: '',
      deliveryDate: '',
      depositAmount: 0,
    },
  };
}

export function InvoiceForm({ mode, sourceInvoiceId, onComplete, onCancel, onAddClient }: Props) {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray());
  const catalog = useLiveQuery(() => db.catalog.toArray(), [], []);
  const [initial, setInitial] = useState<Omit<InitialState, 'values'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const existing = initial?.existing;
  const kind = initial?.kind ?? (mode === 'create-quote' ? 'quote' : 'invoice');
  const isQuoteDoc = kind === 'quote';
  const noun = isQuoteDoc ? 'Quote' : 'Invoice';
  const text = titles(mode, kind);

  const { register, control, handleSubmit, setValue, reset, formState: { errors } } = useForm<InvoiceDraft>({
    defaultValues: {
      currency: 'NGN',
      items: [EMPTY_ITEM],
      discountType: 'percentage',
      discountRate: 0,
      taxRate: 0,
      taxLabel: 'VAT',
      depositAmount: 0,
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = useWatch({ control, name: "items" });
  const deposit = useWatch({ control, name: "depositAmount" });
  const currency = useWatch({ control, name: "currency" });
  const discountRate = useWatch({ control, name: "discountRate" });
  const discountType = useWatch({ control, name: "discountType" });
  const taxRate = useWatch({ control, name: "taxRate" });
  const taxLabel = useWatch({ control, name: "taxLabel" });
  const dateIssued = useWatch({ control, name: "dateIssued" });
  const symbol = CURRENCY_SYMBOLS[currency];
  const suggestions = useMemo(() => sortCatalog(catalog.filter(c => c.currency === currency)), [catalog, currency]);

  // Picking a remembered item fills in its last price (only if no price was typed yet)
  const handleDescriptionChange = (index: number, description: string) => {
    const match = findCatalogItem(catalog, description, currency);
    if (match && !toNumber(items?.[index]?.unitPrice)) {
      setValue(`items.${index}.unitPrice`, match.unitPrice);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadInitialValues(mode, sourceInvoiceId)
      .then(({ values, ...rest }) => {
        if (cancelled) return;
        reset(values);
        setInitial(rest);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setError('Could not load this document. It may have been deleted.');
      });
    return () => { cancelled = true; };
  }, [mode, sourceInvoiceId, reset]);

  // On edit, the amount paid comes from recorded payments, not the form. Quotes are never paid.
  const amountPaid = isQuoteDoc ? 0 : existing ? existing.depositAmount : deposit;

  const totals = useMemo(
    () => calculateTotals({ items: items ?? [], discountType, discountRate, taxRate, amountPaid }),
    [items, amountPaid, discountRate, discountType, taxRate]
  );

  const onSubmit = async (data: InvoiceDraft) => {
    setError('');
    const number = data.invoiceNumber.trim();
    const clash = await db.invoices.where('invoiceNumber').equals(number).first();
    if (clash && clash.id !== existing?.id) {
      setError(`Number ${number} is already used. Choose another.`);
      return;
    }
    if (data.dueDate && data.dueDate < data.dateIssued) {
      setError(`${isQuoteDoc ? 'Valid-until' : 'Due'} date cannot be before the ${noun.toLowerCase()} date.`);
      return;
    }

    setSaving(true);
    try {
      const doc = composeInvoice(data, existing, new Date(), kind);
      await db.transaction('rw', db.invoices, db.catalog, async () => {
        await db.invoices.put(doc);
        if (initial?.convertFrom?.id) {
          await db.invoices.update(initial.convertFrom.id, { convertedInvoiceId: doc.id, updatedAt: new Date() });
        }
        await db.catalog.bulkPut(learnFromItems(await db.catalog.toArray(), doc.items, doc.currency));
      });
      onComplete(kind);
    } catch (err) {
      console.error(err);
      setError(`Failed to save ${noun.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all text-sm";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1 uppercase";

  if (!initial) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
        {error ? <p className="text-red-400">{error}</p> : <Loader2 className="animate-spin" size={28} />}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{text.title}</h2>
          <p className="text-slate-400 text-sm">{text.subtitle}</p>
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
              <label className={labelClass}>{noun} #</label>
              <input {...register('invoiceNumber', { required: "Required" })} className={inputClass} />
              {errors.invoiceNumber && <span className="text-red-400 text-xs">{errors.invoiceNumber.message}</span>}
            </div>
            <div>
              <label className={labelClass}>Customer</label>
              <select
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
              <label className={labelClass}>{noun} Date</label>
              <input type="date" {...register('dateIssued', { required: true })} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>{isQuoteDoc ? 'Valid Until' : 'Due Date'}</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="date" {...register('dueDate')} className={clsx(inputClass, "sm:max-w-[180px]")} />
                <div className="flex flex-wrap gap-1">
                  {DUE_PRESETS.map(preset => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setValue('dueDate', addDays(dateIssued, preset.days))}
                      className="text-[11px] bg-white/5 hover:bg-white/15 border border-white/10 px-2.5 py-1.5 rounded-md text-slate-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setValue('dueDate', '')}
                    className="text-[11px] px-2.5 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Delivery / Pickup Date</label>
              <input type="date" {...register('deliveryDate')} className={inputClass} />
            </div>
            <p className="md:col-span-2 self-end text-xs text-slate-500 pb-2">
              Optional. When you promised the order. Shown on the {noun.toLowerCase()} and flagged if it slips.
            </p>
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
          <datalist id="catalog-suggestions">
            {suggestions.map(item => (
              <option key={item.id} value={item.name}>{formatMoney(item.unitPrice, item.currency)}</option>
            ))}
          </datalist>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex-1 w-full">
                  <input
                    {...register(`items.${index}.description` as const, {
                      required: true,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleDescriptionChange(index, e.target.value),
                    })}
                    list="catalog-suggestions"
                    autoComplete="off"
                    placeholder={suggestions.length ? "Item description (start typing for saved items)" : "Item description"}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                       <label className={labelClass}>Discount</label>
                       <button
                         type="button"
                         onClick={() => setValue('discountType', discountType === 'percentage' ? 'fixed' : 'percentage')}
                         className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-indigo-300 transition-colors uppercase font-bold tracking-wide"
                       >
                         {discountType === 'percentage' ? 'Use amount' : 'Use %'}
                       </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                        {discountType === 'percentage' ? <Percent size={14} /> : symbol}
                      </span>
                      <input
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
                    <label className={labelClass}>Tax</label>
                    <div className="flex gap-2">
                      <input {...register('taxLabel')} className={clsx(inputClass, "w-20")} placeholder="VAT" aria-label="Tax name" />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Percent size={14} /></span>
                        <input
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
                )}

                <div>
                  <label className={labelClass}>Notes (shown on {noun.toLowerCase()})</label>
                  <textarea
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

        <div className="flex flex-col items-end gap-3 pt-4">
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1 disabled:opacity-50">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {text.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
