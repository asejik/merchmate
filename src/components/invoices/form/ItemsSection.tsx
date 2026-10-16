import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useFieldArray, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
import { HIT_AREA } from '../../ui/styles';
import { inputClass } from './formStyles';
import { db } from '../../../db';
import { CURRENCY_SYMBOLS, formatMoney } from '../../../lib/currency';
import { toNumber, type InvoiceDraft } from '../../../lib/invoice';
import { findCatalogItem, sortCatalog } from '../../../lib/catalog';
import { EMPTY_ITEM } from './formState';

interface ItemsSectionProps {
  control: Control<InvoiceDraft>;
  register: UseFormRegister<InvoiceDraft>;
  setValue: UseFormSetValue<InvoiceDraft>;
  items: InvoiceDraft['items'] | undefined;
  currency: InvoiceDraft['currency'];
}

/** The line items, with suggestions from items billed before. */
export function ItemsSection({ control, register, setValue, items, currency }: ItemsSectionProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const catalog = useLiveQuery(() => db.catalog.toArray(), [], []);
  const symbol = CURRENCY_SYMBOLS[currency];
  const suggestions = useMemo(() => sortCatalog(catalog.filter(c => c.currency === currency)), [catalog, currency]);

  // Picking a remembered item fills in its last price (only if no price was typed yet)
  const handleDescriptionChange = (index: number, description: string) => {
    const match = findCatalogItem(catalog, description, currency);
    if (match && !toNumber(items?.[index]?.unitPrice)) {
      setValue(`items.${index}.unitPrice`, match.unitPrice);
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Items</h3>
        <button
          type="button"
          onClick={() => append(EMPTY_ITEM)}
          className={clsx(HIT_AREA, "text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-indigo-300 transition-colors")}
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
                className="bg-transparent border-none text-white placeholder-slate-600 focus:ring-0 w-full min-h-11 p-0 text-base"
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
              <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="inline-flex items-center justify-center min-h-11 min-w-11 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-500" aria-label="Remove item">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
