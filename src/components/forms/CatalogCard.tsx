import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Package, Trash2, Search } from 'lucide-react';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { useDialogs } from '../ui/dialogContext';
import { sortCatalog } from '../../lib/catalog';
import { CURRENCY_SYMBOLS } from '../../lib/currency';
import { round2, toNumber } from '../../lib/invoice';
import type { CatalogItem } from '../../types';

export function CatalogCard() {
  const { confirm } = useDialogs();
  const catalog = useLiveQuery(() => db.catalog.toArray(), [], []);
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortCatalog(catalog).filter(item => !term || item.name.toLowerCase().includes(term));
  }, [catalog, search]);

  const updatePrice = (item: CatalogItem, value: string) => {
    const price = round2(toNumber(value));
    if (price > 0 && price !== item.unitPrice) {
      db.catalog.update(item.id, { unitPrice: price, updatedAt: new Date() }).catch(console.error);
    }
  };

  const remove = async (item: CatalogItem) => {
    const sure = await confirm({
      title: 'Remove saved item?',
      message: `"${item.name}" will be removed from your saved items. Existing invoices are not affected.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (sure) db.catalog.delete(item.id).catch(console.error);
  };

  return (
    <GlassCard className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Package size={20} className="text-indigo-400" /> Saved Items
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Items you invoice are remembered with their latest price and suggested as you type. Adjust or remove them here.
      </p>

      {catalog.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Nothing saved yet. Create an invoice or quote and its items will appear here.</p>
      ) : (
        <>
          {catalog.length > 6 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search saved items..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 min-h-11 text-base text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto -mx-2">
            {items.map(item => (
              <li key={item.id} className="flex items-center gap-3 px-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-500">Used {item.usageCount}× · {item.currency}</p>
                </div>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{CURRENCY_SYMBOLS[item.currency]}</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    defaultValue={item.unitPrice}
                    key={`${item.id}-${item.unitPrice}`}
                    onBlur={(e) => updatePrice(item, e.target.value)}
                    aria-label={`Price for ${item.name}`}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2 min-h-11 text-base text-right text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button onClick={() => remove(item)} className="p-2 text-slate-500 hover:text-red-400 transition-colors" aria-label={`Remove ${item.name}`}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
