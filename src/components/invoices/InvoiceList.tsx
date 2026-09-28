import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { FileText, Download, Share2, CreditCard, Send, History, Search, MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { PaymentModal } from './PaymentModal';
import type { Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { applyPayment, getBalance, getDisplayStatus, getPaymentHistory, todayInputValue, type DisplayStatus } from '../../lib/invoice';
import { downloadBlob, renderInvoicePdf, shareOrDownload } from '../../lib/pdf';

interface Props {
  onEdit: (invoiceId: string) => void;
  onDuplicate: (invoiceId: string) => void;
  onCreate: () => void;
}

interface InvoiceRow extends Invoice {
  customerName: string;
  displayStatus: DisplayStatus;
}

interface ShareState {
  file: File;
  invoice: Invoice;
  afterPayment: boolean;
}

type Filter = 'all' | 'unpaid' | 'overdue' | 'paid';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
];

const STATUS_STYLES: Record<DisplayStatus, string> = {
  paid: 'text-green-400 bg-green-400/10 border-green-400/20',
  partial: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  overdue: 'text-red-400 bg-red-400/10 border-red-400/20',
  pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  draft: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

function matchesFilter(row: InvoiceRow, filter: Filter): boolean {
  switch (filter) {
    case 'unpaid': return row.status !== 'paid';
    case 'overdue': return row.displayStatus === 'overdue';
    case 'paid': return row.status === 'paid';
    default: return true;
  }
}

async function buildPdf(invoice: Invoice): Promise<Blob | null> {
  const business = await db.businessProfile.orderBy('id').first();
  const customer = await db.customers.get(invoice.customerId);
  if (!business || !customer) {
    alert(!business ? "Add your business details in Settings first." : "This invoice's client no longer exists.");
    return null;
  }
  return renderInvoicePdf(invoice, business, customer);
}

export function InvoiceList({ onEdit, onDuplicate, onCreate }: Props) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [shareModal, setShareModal] = useState<ShareState | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const invoices = useLiveQuery(async (): Promise<InvoiceRow[]> => {
    const [allInvoices, allCustomers] = await Promise.all([
      db.invoices.orderBy('createdAt').reverse().toArray(),
      db.customers.toArray(),
    ]);
    const names = new Map(allCustomers.map(c => [c.id, c.name]));
    const today = todayInputValue();
    return allInvoices.map(inv => ({
      ...inv,
      customerName: names.get(inv.customerId) ?? 'Unknown',
      displayStatus: getDisplayStatus(inv, today),
    }));
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (invoices ?? []).filter(row =>
      matchesFilter(row, filter) &&
      (!term || row.customerName.toLowerCase().includes(term) || row.invoiceNumber.toLowerCase().includes(term))
    );
  }, [invoices, search, filter]);

  const handlePrepareShare = async (invoice: Invoice, afterPayment = false) => {
    if (!invoice.id) return;
    setGeneratingId(invoice.id);
    try {
      const blob = await buildPdf(invoice);
      if (!blob) return;
      const file = new File([blob], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
      setShareModal({ file, invoice, afterPayment });
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const executeShare = async () => {
    if (!shareModal) return;
    const { file, invoice } = shareModal;
    try {
      await shareOrDownload(file, `Invoice #${invoice.invoiceNumber}`, `Hello, here is invoice #${invoice.invoiceNumber}.`);
    } catch (error) {
      // AbortError just means the user closed the share sheet
      if ((error as Error).name !== 'AbortError') console.error(error);
    } finally {
      setShareModal(null);
    }
  };

  const handlePaymentUpdate = async (amount: number, note: string) => {
    if (!selectedInvoice?.id) return;
    try {
      const changes = applyPayment(selectedInvoice, amount, note);
      await db.invoices.update(selectedInvoice.id, changes);
      setSelectedInvoice(null);
      await handlePrepareShare({ ...selectedInvoice, ...changes }, true);
    } catch (error) {
      console.error(error);
      alert("Failed to update payment");
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    if (!invoice.id) return;
    setGeneratingId(invoice.id);
    try {
      const blob = await buildPdf(invoice);
      if (blob) downloadBlob(blob, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (invoice: InvoiceRow) => {
    setMenuId(null);
    if (!invoice.id) return;
    const paidNote = invoice.depositAmount > 0 ? `\n\nIts ${formatMoney(invoice.depositAmount, invoice.currency)} payment history will also be deleted.` : '';
    if (!confirm(`Delete invoice #${invoice.invoiceNumber} for ${invoice.customerName}? This cannot be undone.${paidNote}`)) return;
    try {
      await db.invoices.delete(invoice.id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete invoice");
    }
  };

  if (invoices && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <FileText size={48} className="mb-4 opacity-20" />
        <p>No invoices created yet.</p>
        <button onClick={onCreate} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
          Create your first invoice &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Invoices</h1>
        <div className="text-sm text-slate-400">
          {visible.length === invoices?.length ? `Total: ${visible.length}` : `${visible.length} of ${invoices?.length ?? 0}`}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="search"
            placeholder="Search client or invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10" role="tablist">
          {FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                filter === f.id ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Click-outside catcher; lives outside the cards because backdrop-filter traps fixed children */}
      {menuId && <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />}

      <div className="grid gap-4">
        {visible.map((inv) => {
          const history = getPaymentHistory(inv);
          const isGenerating = generatingId === inv.id;
          const statusStyle = STATUS_STYLES[inv.displayStatus];

          return (
            // Raise the card with an open menu above its siblings (each card is its own stacking context)
            <GlassCard key={inv.id} className={clsx("p-4 flex flex-col gap-4 group", menuId === inv.id && "relative z-30")}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 w-full">
                  <div className={`p-3 rounded-full ${statusStyle}`}>
                    <FileText size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{inv.customerName}</h3>
                    <p className="text-xs text-slate-400">
                      #{inv.invoiceNumber} • {new Date(inv.dateIssued).toLocaleDateString()}
                      {inv.dueDate && inv.status !== 'paid' && <> • Due {new Date(inv.dueDate).toLocaleDateString()}</>}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${statusStyle}`}>
                        {inv.displayStatus}
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {inv.status === 'paid'
                          ? formatMoney(inv.grandTotal, inv.currency)
                          : `Due: ${formatMoney(getBalance(inv), inv.currency)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {inv.status !== 'paid' && (
                    <button onClick={() => setSelectedInvoice(inv)} className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors" title="Record Payment" aria-label="Record payment">
                      <CreditCard size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => handlePrepareShare(inv)}
                    disabled={isGenerating}
                    className="p-2 hover:bg-green-500/10 rounded-lg text-green-500 transition-colors"
                    title="Share PDF"
                    aria-label="Share PDF"
                  >
                    {isGenerating ? (
                        <div className="h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Share2 size={20} />
                    )}
                  </button>
                  <button onClick={() => handleDownload(inv)} disabled={isGenerating} className="p-2 hover:bg-white/10 rounded-lg text-indigo-400 transition-colors" title="Download PDF" aria-label="Download PDF">
                    <Download size={20} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setMenuId(menuId === inv.id ? null : inv.id ?? null)}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                      title="More actions"
                      aria-label="More actions"
                      aria-expanded={menuId === inv.id}
                    >
                      <MoreVertical size={20} />
                    </button>
                    {menuId === inv.id && (
                      <>
                        <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1 text-sm" role="menu">
                          <button role="menuitem" onClick={() => { setMenuId(null); onEdit(inv.id!); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                            <Pencil size={14} /> Edit
                          </button>
                          <button role="menuitem" onClick={() => { setMenuId(null); onDuplicate(inv.id!); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                            <Copy size={14} /> Duplicate
                          </button>
                          <button role="menuitem" onClick={() => handleDelete(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10">
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {history.length > 0 && (
                <div className="mt-2 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
                    <History size={12} /> Payment History
                  </div>
                  <div className="space-y-1">
                    {history.map((rec) => (
                      <div key={rec.id} className="flex justify-between text-xs px-2 py-1 rounded bg-white/5">
                        <span className="text-slate-400">
                           {new Date(rec.date).toLocaleDateString()}
                           {rec.note && <span className="opacity-50 ml-2 text-[10px] uppercase border border-slate-600 rounded px-1">{rec.note}</span>}
                        </span>
                        <span className="font-mono text-green-400">
                          +{formatMoney(rec.amount, inv.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}

        {invoices && visible.length === 0 && (
          <p className="text-center text-slate-500 py-12">No invoices match your search.</p>
        )}
      </div>

      {selectedInvoice && (
        <PaymentModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onSave={handlePaymentUpdate} />
      )}

      {shareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard className="w-full max-w-sm p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
              <Share2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {shareModal.afterPayment ? 'Invoice Updated!' : 'PDF Ready'}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {shareModal.afterPayment
                ? 'The new balance has been calculated. Share the updated PDF now.'
                : `Invoice #${shareModal.invoice.invoiceNumber} is ready to send.`}
            </p>
            <div className="space-y-3">
              <button
                onClick={executeShare}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all"
              >
                <Send size={18} />
                {shareModal.afterPayment ? 'Share Update' : 'Share'}
              </button>
              <button onClick={() => setShareModal(null)} className="text-slate-500 hover:text-white text-sm py-2">
                Done
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
