import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useFieldArray, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../ui/Card';
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-ink">Items</h2>
        <button
          type="button"
          onClick={() => append(EMPTY_ITEM)}
          className={clsx(HIT_AREA, "flex items-center gap-1 rounded-lg bg-primary-tint px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-80")}
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
          <div key={field.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-sunken p-3 rounded-xl">
            <div className="flex-1 w-full">
              <input
                {...register(`items.${index}.description` as const, {
                  required: true,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleDescriptionChange(index, e.target.value),
                })}
                list="catalog-suggestions"
                autoComplete="off"
                placeholder={suggestions.length ? "Item description (start typing for saved items)" : "Item description"}
                className={inputClass}
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">{symbol}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                  className={clsx(inputClass, "text-right pl-6")}
                  placeholder="Price"
                />
              </div>
              <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="inline-flex items-center justify-center min-h-11 min-w-11 text-muted hover:text-danger transition-colors disabled:opacity-30 disabled:hover:text-muted" aria-label="Remove item">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
