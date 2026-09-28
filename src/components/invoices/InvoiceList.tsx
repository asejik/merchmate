import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { FileText, Download, Share2, CreditCard, Send, History } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import type { Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { applyPayment, getBalance, getPaymentHistory } from '../../lib/invoice';
import { downloadBlob, renderInvoicePdf, shareOrDownload } from '../../lib/pdf';

interface InvoiceWithCustomer extends Invoice {
  customerName: string;
}

interface ShareState {
  file: File;
  invoice: Invoice;
  afterPayment: boolean;
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

export function InvoiceList() {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [shareModal, setShareModal] = useState<ShareState | null>(null);

  const invoices = useLiveQuery(async (): Promise<InvoiceWithCustomer[]> => {
    const [allInvoices, allCustomers] = await Promise.all([
      db.invoices.orderBy('createdAt').reverse().toArray(),
      db.customers.toArray(),
    ]);
    const names = new Map(allCustomers.map(c => [c.id, c.name]));
    return allInvoices.map(inv => ({ ...inv, customerName: names.get(inv.customerId) ?? 'Unknown' }));
  });

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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'partial': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  if (!invoices?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <FileText size={48} className="mb-4 opacity-20" />
        <p>No invoices created yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Invoices</h1>
        <div className="text-sm text-slate-400">Total: {invoices.length}</div>
      </div>

      <div className="grid gap-4">
        {invoices.map((inv) => {
          const history = getPaymentHistory(inv);
          const isGenerating = generatingId === inv.id;

          return (
            <GlassCard key={inv.id} className="p-4 flex flex-col gap-4 group">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 w-full">
                  <div className={`p-3 rounded-full ${getStatusColor(inv.status)}`}>
                    <FileText size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{inv.customerName}</h3>
                    <p className="text-xs text-slate-400">#{inv.invoiceNumber} • {new Date(inv.dateIssued).toLocaleDateString()}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                      {inv.status !== 'paid' && (
                        <span className="text-xs font-mono text-slate-300">
                          Due: {formatMoney(getBalance(inv), inv.currency)}
                        </span>
                      )}
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
