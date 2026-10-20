import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { FileText, Search, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { BUTTON_PRIMARY } from '../ui/styles';
import { Card } from '../ui/Card';
import { PaymentModal } from './PaymentModal';
import type { ListView } from '../../types';
import { getDisplayStatus, isQuote, todayInputValue } from '../../lib/invoice';
import { ShareModal } from '../ui/ShareModal';
import { InvoiceCard } from './list/InvoiceCard';
import { FILTERS, INERT, matchesFilter, type Filter, type InvoiceRow } from './list/invoiceRow';
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
      <h1 className="sr-only">{view === 'quotes' ? 'Quotes' : 'Invoices'}</h1>
      <div className="flex items-center justify-between gap-4">
        <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Document type">
          {(['invoices', 'quotes'] as ListView[]).map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => { onViewChange(v); setMenuId(null); }}
              className={clsx(
                "px-4 min-h-11 text-base font-bold rounded-lg transition-colors duration-150 capitalize",
                view === v ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted hidden sm:inline">
            {visible.length === viewTotal ? `Total: ${viewTotal}` : `${visible.length} of ${viewTotal}`}
          </span>
          {view === 'quotes' && (
            <button onClick={onCreateQuote} className={BUTTON_PRIMARY}>
              <Plus size={16} /> New Quote
            </button>
          )}
        </div>
      </div>

      {invoices && viewTotal === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <FileText size={32} className="mb-3 text-primary" aria-hidden="true" />
          <p className="text-base font-bold text-ink">No {noun}s yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {view === 'quotes' ? 'Quotes let a client approve a price before you start. Convert one to an invoice in a tap.' : 'Your invoices will show here, with what each client still owes.'}
          </p>
          <button onClick={view === 'quotes' ? onCreateQuote : onCreate} className={clsx(BUTTON_PRIMARY, 'mt-5')}>
            <Plus size={16} aria-hidden="true" /> Create your first {noun}
          </button>
        </Card>
      ) : (
      <>
      <div className="flex flex-col md:flex-row md:items-center gap-3" {...(menuId ? INERT : undefined)}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={`Search ${noun}s by client or number`}
            placeholder={`Search client or ${noun} #...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-line-strong bg-surface pl-10 pr-4 text-base text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
        {view === 'invoices' && (
        <div className="flex flex-wrap rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "flex-1 md:flex-none px-2 sm:px-3 min-h-11 text-xs font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap",
                filter === f.id ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
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

      <div className="grid gap-3">
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
            inert={menuId !== null && menuId !== inv.id}
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
          <p className="py-12 text-center text-sm text-muted">No {noun}s match your search.</p>
        )}
      </div>

      </>
      )}

      {selectedInvoice && (
        <PaymentModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onSave={handlePaymentUpdate} />
      )}

      {shareModal && <ShareModal state={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}
