import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { FileText, Search, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { HIT_AREA } from '../ui/styles';
import { PaymentModal } from './PaymentModal';
import type { ListView } from '../../types';
import { getDisplayStatus, isQuote, todayInputValue } from '../../lib/invoice';
import { ShareModal } from '../ui/ShareModal';
import { InvoiceCard } from './list/InvoiceCard';
import { FILTERS, matchesFilter, type Filter, type InvoiceRow } from './list/invoiceRow';
import { useInvoiceActions } from './list/useInvoiceActions';

interface Props {
  view: ListView;
  onViewChange: (view: ListView) => void;
  onEdit: (invoiceId: string) => void;
  onDuplicate: (invoiceId: string) => void;
  onConvert: (quoteId: string) => void;
  onCreate: () => void;
  onCreateQuote: () => void;
}

export function InvoiceList({ view, onViewChange, onEdit, onDuplicate, onConvert, onCreate, onCreateQuote }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false); // open upwards near the bottom so the nav bar doesn't cover it
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const actions = useInvoiceActions(() => setMenuId(null));
  const { generatingId, selectedInvoice, setSelectedInvoice, shareModal, setShareModal, handlePaymentUpdate } = actions;

  const business = useLiveQuery(() => db.businessProfile.orderBy('id').first());
  const dateFormat = business?.dateFormat;

  const invoices = useLiveQuery(async (): Promise<InvoiceRow[]> => {
    const [allInvoices, allCustomers] = await Promise.all([
      db.invoices.orderBy('createdAt').reverse().toArray(),
      db.customers.toArray(),
    ]);
    const customers = new Map(allCustomers.map(c => [c.id, c]));
    const today = todayInputValue();
    return allInvoices.map(inv => {
      const customer = customers.get(inv.customerId);
      return {
        ...inv,
        customer,
        customerName: customer?.name ?? 'Unknown',
        displayStatus: getDisplayStatus(inv, today),
      };
    });
  });

  // Escape closes the actions menu
  useEffect(() => {
    if (!menuId) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuId(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (invoices ?? []).filter(row =>
      isQuote(row) === (view === 'quotes') &&
      (view === 'quotes' || matchesFilter(row, filter)) &&
      (!term || row.customerName.toLowerCase().includes(term) || row.invoiceNumber.toLowerCase().includes(term))
    );
  }, [invoices, search, filter, view]);

  const today = todayInputValue();
  const viewTotal = (invoices ?? []).filter(row => isQuote(row) === (view === 'quotes')).length;
  const noun = view === 'quotes' ? 'quote' : 'invoice';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10" role="tablist" aria-label="Document type">
          {(['invoices', 'quotes'] as ListView[]).map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => { onViewChange(v); setMenuId(null); }}
              className={clsx(
                "px-4 min-h-11 text-lg font-bold rounded-lg transition-all capitalize",
                view === v ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 hidden sm:inline">
            {visible.length === viewTotal ? `Total: ${viewTotal}` : `${visible.length} of ${viewTotal}`}
          </span>
          {view === 'quotes' && (
            <button onClick={onCreateQuote} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all">
              <Plus size={16} /> New Quote
            </button>
          )}
        </div>
      </div>

      {invoices && viewTotal === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
          <FileText size={48} className="mb-4 opacity-20" />
          <p>No {noun}s created yet.</p>
          {view === 'quotes' && <p className="text-xs mt-1 max-w-xs">Quotes let clients approve a price before you start. Convert one to an invoice in a tap.</p>}
          <button onClick={view === 'quotes' ? onCreateQuote : onCreate} className={clsx(HIT_AREA, "mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium")}>
            Create your first {noun} &rarr;
          </button>
        </div>
      ) : (
      <>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="search"
            aria-label={`Search ${noun}s by client or number`}
            placeholder={`Search client or ${noun} #...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 min-h-11 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        {view === 'invoices' && (
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10" role="tablist" aria-label="Filter by status">
          {FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "flex-1 md:flex-none px-2 sm:px-3 min-h-11 text-xs font-medium rounded-lg transition-all whitespace-nowrap",
                filter === f.id ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Click-outside catcher; lives outside the cards because backdrop-filter traps fixed children */}
      {menuId && <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />}

      <div className="grid gap-4">
        {visible.map((inv) => (
          <InvoiceCard
            key={inv.id}
            inv={inv}
            business={business}
            dateFormat={dateFormat}
            today={today}
            isGenerating={generatingId === inv.id}
            menuOpen={menuId === inv.id}
            menuUp={menuUp}
            onToggleMenu={openUp => { setMenuUp(openUp); setMenuId(menuId === inv.id ? null : inv.id ?? null); }}
            onCloseMenu={() => setMenuId(null)}
            onRecordPayment={() => setSelectedInvoice(inv)}
            onEdit={() => onEdit(inv.id!)}
            onDuplicate={() => onDuplicate(inv.id!)}
            onConvert={() => onConvert(inv.id!)}
            actions={actions}
          />
        ))}

        {invoices && visible.length === 0 && (
          <p className="text-center text-slate-500 py-12">No invoices match your search.</p>
        )}
      </div>

      </>
      )}

      {selectedInvoice && (
        <PaymentModal invoice={selectedInvoice} dateFormat={dateFormat} onClose={() => setSelectedInvoice(null)} onSave={handlePaymentUpdate} />
      )}

      {shareModal && <ShareModal state={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}
