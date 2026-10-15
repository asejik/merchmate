import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { FileText, Download, Share2, CreditCard, History, Search, MoreVertical, Pencil, Copy, Trash2, MessageCircle, Receipt, FileCheck2, Plus, Check, ChevronRight, X, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { PaymentModal } from './PaymentModal';
import type { BusinessProfile, Customer, Invoice, ListView, OrderStage } from '../../types';
import { formatMoney } from '../../lib/currency';
import { applyPayment, confirmPayment, getBalance, nextInstallment, getDisplayStatus, getPaymentHistory, getReceiptInfo, getUnconfirmedAmount, isQuote, removeUnconfirmedPayment, todayInputValue, type DisplayStatus } from '../../lib/invoice';
import { renderInvoicePdf, renderReceiptPdf } from '../../lib/pdf';
import { downloadBlob, type ShareFile } from '../../lib/share';
import { ShareModal, type ShareState } from '../ui/ShareModal';
import { buildInvoiceText, clientWhatsAppLink, DEFAULT_COUNTRY_CODE, toWhatsAppNumber, whatsAppLink } from '../../lib/whatsapp';
import { renderInvoiceImage } from '../../lib/invoiceImage';
import { getJobProfit } from '../../lib/profit';
import { formatDate } from '../../lib/dates';
import { isDeliveryLate, isOpenOrder, nextStage, ORDER_STAGES, stageLabel } from '../../lib/orders';

interface Props {
  view: ListView;
  onViewChange: (view: ListView) => void;
  onEdit: (invoiceId: string) => void;
  onDuplicate: (invoiceId: string) => void;
  onConvert: (quoteId: string) => void;
  onCreate: () => void;
  onCreateQuote: () => void;
}


interface InvoiceRow extends Invoice {
  customer?: Customer;
  customerName: string;
  displayStatus: DisplayStatus;
}

type Filter = 'all' | 'to-deliver' | 'unpaid' | 'overdue' | 'paid';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'to-deliver', label: 'To deliver' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
];

const STAGE_STYLES: Record<OrderStage, string> = {
  in_progress: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  ready: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
  delivered: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

const STATUS_STYLES: Record<DisplayStatus, string> = {
  paid: 'text-green-400 bg-green-400/10 border-green-400/20',
  partial: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  overdue: 'text-red-400 bg-red-400/10 border-red-400/20',
  pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  draft: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  open: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  expired: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  converted: 'text-green-400 bg-green-400/10 border-green-400/20',
};

function matchesFilter(row: InvoiceRow, filter: Filter): boolean {
  switch (filter) {
    case 'to-deliver': return isOpenOrder(row);
    case 'unpaid': return row.status !== 'paid';
    case 'overdue': return row.displayStatus === 'overdue';
    case 'paid': return row.status === 'paid';
    default: return true;
  }
}

async function loadParties(invoice: Invoice): Promise<{ business: BusinessProfile; customer: Customer } | null> {
  const [business, customer] = await Promise.all([
    db.businessProfile.orderBy('id').first(),
    db.customers.get(invoice.customerId),
  ]);
  if (!business || !customer) {
    alert(!business ? "Add your business details in Settings first." : "This invoice's client no longer exists.");
    return null;
  }
  return { business, customer };
}

async function invoiceShareFile(invoice: Invoice, business: BusinessProfile, customer: Customer): Promise<ShareFile> {
  const blob = await renderInvoicePdf(invoice, business, customer);
  const noun = isQuote(invoice) ? 'Quote' : 'Invoice';
  return {
    label: noun,
    file: new File([blob], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' }),
    title: `${noun} #${invoice.invoiceNumber}`,
    text: `Hello, here is ${noun.toLowerCase()} #${invoice.invoiceNumber}.`,
  };
}

async function receiptShareFile(invoice: Invoice, paymentId: string, business: BusinessProfile, customer: Customer): Promise<ShareFile | null> {
  const receipt = getReceiptInfo(invoice, paymentId);
  if (!receipt) return null;
  const blob = await renderReceiptPdf(invoice, receipt, business, customer);
  return {
    label: 'Receipt',
    file: new File([blob], `Receipt-${receipt.receiptNumber}.pdf`, { type: 'application/pdf' }),
    title: `Receipt #${receipt.receiptNumber}`,
    text: `Hello, here is your receipt for ${formatMoney(receipt.payment.amount, invoice.currency)}. Thank you!`,
  };
}

function timeAgo(date: Date): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function InvoiceList({ view, onViewChange, onEdit, onDuplicate, onConvert, onCreate, onCreateQuote }: Props) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [shareModal, setShareModal] = useState<ShareState | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false); // open upwards near the bottom so the nav bar doesn't cover it
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

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

  // Rendered as a plain link (not window.open after an await) so popup blockers never interfere
  const reminderLink = (row: InvoiceRow): string | null => {
    if (!business || !row.customer) return null;
    return clientWhatsAppLink(row, row.customer, business);
  };

  const setStage = async (invoice: InvoiceRow, stage: OrderStage) => {
    setMenuId(null);
    if (!invoice.id || stage === invoice.orderStage) return;
    const balance = getBalance(invoice);
    if (stage === 'delivered' && balance > 0 &&
        !confirm(`${invoice.customerName} still owes ${formatMoney(balance, invoice.currency)} on #${invoice.invoiceNumber}.${
          getUnconfirmedAmount(invoice) > 0 ? `\n\n${formatMoney(getUnconfirmedAmount(invoice), invoice.currency)} in transfers is not yet confirmed. Check your bank app first.` : ''
        }\n\nMark as delivered anyway?`)) {
      return;
    }
    try {
      await db.invoices.update(invoice.id, { orderStage: stage, updatedAt: new Date() });
    } catch (err) {
      console.error(err);
      alert("Failed to update the order");
    }
  };

  const markReminded = (invoice: Invoice) => {
    if (invoice.id) db.invoices.update(invoice.id, { lastReminderAt: new Date() }).catch(console.error);
  };

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

  /** Runs a PDF job with the row's spinner showing and a readable error on failure. */
  const withGenerating = async (invoice: Invoice, job: () => Promise<void>) => {
    if (!invoice.id) return;
    setGeneratingId(invoice.id);
    try {
      await job();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Could not generate the PDF: ${(error as Error).message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePrepareShare = (invoice: Invoice) => withGenerating(invoice, async () => {
    const parties = await loadParties(invoice);
    if (!parties) return;
    const { business, customer } = parties;
    const [file, image] = await Promise.all([
      invoiceShareFile(invoice, business, customer),
      // The image is a nice-to-have: if the browser can't draw it, still offer the PDF
      renderInvoiceImage(invoice, business, customer).catch(err => { console.error(err); return null; }),
    ]);
    const files = [{ ...file, label: 'as PDF' }];
    if (image) {
      files.push({ ...file, label: 'as Image', file: new File([image], `${invoice.invoiceNumber}.png`, { type: 'image/png' }) });
    }
    const phone = toWhatsAppNumber(customer.phone ?? '', business.defaultCountryCode || DEFAULT_COUNTRY_CODE);
    setShareModal({
      heading: 'Ready to Send',
      description: `Send ${file.title} as a PDF, an image that opens right in the chat, or a WhatsApp text message.`,
      files,
      links: [{ label: 'Send as WhatsApp Text', href: whatsAppLink(phone, buildInvoiceText(invoice, customer, business)) }],
    });
  });

  const handleReceipt = (invoice: Invoice, paymentId: string) => withGenerating(invoice, async () => {
    const parties = await loadParties(invoice);
    if (!parties) return;
    const file = await receiptShareFile(invoice, paymentId, parties.business, parties.customer);
    if (file) setShareModal({ heading: 'Receipt Ready', description: `${file.title} is ready to send.`, files: [file] });
  });

  /** Saves payment changes, then offers the receipt for the payment just received (and the updated invoice). */
  const savePaymentAndShare = async (invoice: Invoice, changes: Partial<Invoice>, paymentId: string | undefined, withInvoice: boolean) => {
    if (!invoice.id) return;
    try {
      await db.invoices.update(invoice.id, changes);
    } catch (error) {
      console.error(error);
      alert("Failed to update payment");
      return;
    }
    const updated: Invoice = { ...invoice, ...changes };
    await withGenerating(updated, async () => {
      const parties = await loadParties(updated);
      if (!parties || !paymentId) return;
      const [receipt, invoiceFile] = await Promise.all([
        receiptShareFile(updated, paymentId, parties.business, parties.customer),
        withInvoice ? invoiceShareFile(updated, parties.business, parties.customer) : null,
      ]);
      const balance = getBalance(updated);
      const files = [receipt, invoiceFile].filter((f): f is ShareFile => f !== null);
      setShareModal({
        heading: 'Payment Recorded',
        description: balance > 0
          ? `New balance: ${formatMoney(balance, updated.currency)}. Send the client a receipt${withInvoice ? ' and the updated invoice' : ''}.`
          : 'This invoice is now fully paid. Send the client a receipt.',
        files,
      });
    });
  };

  const handlePaymentUpdate = async (amount: number, note: string, unconfirmed: boolean) => {
    if (!selectedInvoice?.id) return;
    const invoice = selectedInvoice;
    const changes = applyPayment(invoice, amount, note, new Date(), { unconfirmed });
    setSelectedInvoice(null);
    if (unconfirmed) {
      // Nothing to send yet: the receipt comes when the transfer is confirmed
      try {
        await db.invoices.update(invoice.id!, changes);
      } catch (error) {
        console.error(error);
        alert("Failed to update payment");
      }
      return;
    }
    await savePaymentAndShare(invoice, changes, changes.payments?.at(-1)?.id, true);
  };

  const handleConfirmTransfer = async (invoice: Invoice, paymentId: string) => {
    const changes = confirmPayment(invoice, paymentId);
    if (changes) await savePaymentAndShare(invoice, changes, paymentId, false);
  };

  const handleRemoveTransfer = async (invoice: Invoice, paymentId: string, amount: number) => {
    const changes = removeUnconfirmedPayment(invoice, paymentId);
    if (!changes || !invoice.id) return;
    if (!confirm(`Remove this ${formatMoney(amount, invoice.currency)} transfer?\n\nOnly do this if the money never arrived in your account.`)) return;
    try {
      await db.invoices.update(invoice.id, changes);
    } catch (error) {
      console.error(error);
      alert("Failed to update payment");
    }
  };

  const handleDownload = (invoice: Invoice) => withGenerating(invoice, async () => {
    const parties = await loadParties(invoice);
    if (!parties) return;
    downloadBlob(await renderInvoicePdf(invoice, parties.business, parties.customer), `${invoice.invoiceNumber}.pdf`);
  });

  const handleDelete = async (invoice: InvoiceRow) => {
    setMenuId(null);
    if (!invoice.id) return;
    const paidNote = invoice.depositAmount > 0 ? `\n\nIts ${formatMoney(invoice.depositAmount, invoice.currency)} payment history will also be deleted.` : '';
    const docNoun = isQuote(invoice) ? 'quote' : 'invoice';
    if (!confirm(`Delete ${docNoun} #${invoice.invoiceNumber} for ${invoice.customerName}? This cannot be undone.${paidNote}`)) return;
    try {
      await db.invoices.delete(invoice.id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete invoice");
    }
  };

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
                "px-4 py-1.5 text-lg font-bold rounded-lg transition-all capitalize",
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
          <button onClick={view === 'quotes' ? onCreateQuote : onCreate} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
            Create your first {noun} &rarr;
          </button>
        </div>
      ) : (
      <>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="search"
            placeholder={`Search client or ${noun} #...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
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
                "flex-1 md:flex-none px-2 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap",
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
        {visible.map((inv) => {
          const history = getPaymentHistory(inv);
          const isGenerating = generatingId === inv.id;
          const statusStyle = STATUS_STYLES[inv.displayStatus];
          const quote = isQuote(inv);
          const unpaidInvoice = !quote && inv.status !== 'paid';
          const orderReady = !quote && inv.orderStage === 'ready';
          const showWhatsApp = unpaidInvoice || orderReady;
          const reminderUrl = showWhatsApp ? reminderLink(inv) : null;
          const upcomingStage = inv.orderStage ? nextStage(inv.orderStage) : null;
          const deliveryLate = isDeliveryLate(inv, today);
          const unconfirmedAmount = quote ? 0 : getUnconfirmedAmount(inv);
          const nextStep = unpaidInvoice ? nextInstallment(inv, today) : null;
          const jobProfit = getJobProfit(inv);

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
                      #{inv.invoiceNumber} • {formatDate(inv.dateIssued, dateFormat)}
                      {inv.dueDate && (quote ? !inv.convertedInvoiceId : inv.status !== 'paid') && (
                        <> • {quote ? 'Valid until' : 'Due'} {formatDate(inv.dueDate, dateFormat)}</>
                      )}
                      {inv.deliveryDate && inv.orderStage !== 'delivered' && !inv.convertedInvoiceId && (
                        <> • <span className={clsx(deliveryLate && "text-red-400 font-medium")}>
                          {deliveryLate ? 'Delivery was' : 'Delivery'} {formatDate(inv.deliveryDate, dateFormat)}
                        </span></>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${statusStyle}`}>
                        {inv.displayStatus}
                      </span>
                      {inv.orderStage && !quote && (
                        <button
                          onClick={() => upcomingStage && setStage(inv, upcomingStage)}
                          disabled={!upcomingStage}
                          className={clsx(
                            "text-[10px] uppercase px-2 py-0.5 rounded border inline-flex items-center gap-0.5 transition-opacity",
                            STAGE_STYLES[inv.orderStage],
                            upcomingStage && "hover:opacity-80"
                          )}
                          title={upcomingStage ? `Mark as ${stageLabel(upcomingStage)}` : 'Delivered'}
                          aria-label={upcomingStage ? `Order ${stageLabel(inv.orderStage)}. Mark as ${stageLabel(upcomingStage)}` : 'Order delivered'}
                        >
                          {stageLabel(inv.orderStage)}
                          {upcomingStage && <ChevronRight size={10} />}
                        </button>
                      )}
                      <span className="text-xs font-mono text-slate-300">
                        {quote || inv.status === 'paid'
                          ? formatMoney(inv.grandTotal, inv.currency)
                          : `Due: ${formatMoney(getBalance(inv), inv.currency)}`}
                      </span>
                      {unconfirmedAmount > 0 && (
                        <span className="text-[10px] text-amber-300 inline-flex items-center gap-1" title="Transfers you haven't seen in your bank account yet">
                          <ShieldAlert size={11} /> {formatMoney(unconfirmedAmount, inv.currency)} unconfirmed
                        </span>
                      )}
                      {inv.lastReminderAt && showWhatsApp && (
                        <span className="text-[10px] text-slate-500">Messaged {timeAgo(inv.lastReminderAt)}</span>
                      )}
                    </div>
                    {jobProfit && (
                      <p className="mt-1 text-[11px] text-slate-500" title="From your private costs. Not shown to the client.">
                        {quote ? 'Expected profit' : 'Profit'}: <span className={jobProfit.profit < 0 ? "text-red-400" : "text-slate-300"}>{formatMoney(jobProfit.profit, inv.currency)}</span>
                        {jobProfit.margin !== null && <> · {jobProfit.margin}%</>}
                      </p>
                    )}
                    {nextStep && (
                      <p className={clsx("mt-1 text-[11px]", nextStep.state === 'overdue' ? "text-red-400" : "text-slate-400")}>
                        Next: {nextStep.installment.label} · {formatMoney(nextStep.remaining, inv.currency)}
                        {nextStep.installment.dueDate && <> · {nextStep.state === 'overdue' ? 'was due' : 'by'} {formatDate(nextStep.installment.dueDate, dateFormat)}</>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {unpaidInvoice && (
                    <button onClick={() => setSelectedInvoice(inv)} className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors" title="Record Payment" aria-label="Record payment">
                      <CreditCard size={20} />
                    </button>
                  )}
                  {showWhatsApp && (reminderUrl ? (
                    <a
                      href={reminderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markReminded(inv)}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-400 transition-colors"
                      title={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
                      aria-label={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
                    >
                      <MessageCircle size={20} />
                    </a>
                  ) : (
                    <span className="p-2 text-slate-600" title={business ? "Client has no phone number" : "Add your business details in Settings first"}>
                      <MessageCircle size={20} />
                    </span>
                  ))}
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
                      onClick={(e) => {
                        setMenuUp(e.currentTarget.getBoundingClientRect().top > window.innerHeight / 2);
                        setMenuId(menuId === inv.id ? null : inv.id ?? null);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                      title="More actions"
                      aria-label="More actions"
                      aria-expanded={menuId === inv.id}
                    >
                      <MoreVertical size={20} />
                    </button>
                    {menuId === inv.id && (
                      <>
                        <div className={clsx("absolute right-0 z-20 w-48", menuUp ? "bottom-full mb-1" : "top-full mt-1", "rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1 text-sm")} role="menu">
                          {quote && !inv.convertedInvoiceId && (
                            <button role="menuitem" onClick={() => { setMenuId(null); onConvert(inv.id!); }} className="w-full flex items-center gap-2 px-3 py-2 text-green-300 hover:bg-white/10">
                              <FileCheck2 size={14} /> Convert to Invoice
                            </button>
                          )}
                          <button role="menuitem" onClick={() => { setMenuId(null); onEdit(inv.id!); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                            <Pencil size={14} /> Edit
                          </button>
                          <button role="menuitem" onClick={() => { setMenuId(null); onDuplicate(inv.id!); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                            <Copy size={14} /> Duplicate
                          </button>
                          {!quote && (
                            <div className="border-y border-white/10 my-1 py-1" role="group" aria-label="Order stage">
                              <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase text-slate-500">Order</p>
                              {ORDER_STAGES.map(stage => (
                                <button
                                  key={stage.id}
                                  role="menuitemradio"
                                  aria-checked={inv.orderStage === stage.id}
                                  onClick={() => setStage(inv, stage.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                                >
                                  <Check size={14} className={clsx(inv.orderStage !== stage.id && "invisible")} /> {stage.label}
                                </button>
                              ))}
                            </div>
                          )}
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
                      <div key={rec.id} className={clsx("flex flex-wrap justify-between items-center gap-x-2 gap-y-1 text-xs px-2 py-1 rounded", rec.unconfirmed ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/5")}>
                        <span className="text-slate-400">
                           {formatDate(rec.date, dateFormat, { moment: true })}
                           {rec.note && <span className="opacity-50 ml-2 text-[10px] uppercase border border-slate-600 rounded px-1">{rec.note}</span>}
                        </span>
                        {rec.unconfirmed ? (
                          <span className="flex items-center gap-1 ml-auto">
                            <span className="font-mono text-amber-300/80 mr-1" title="Awaiting confirmation">{formatMoney(rec.amount, inv.currency)}</span>
                            <button
                              onClick={() => handleConfirmTransfer(inv, rec.id)}
                              disabled={isGenerating}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/15 text-green-300 hover:bg-green-500/25 transition-colors"
                              title="I've seen this money in my bank account"
                              aria-label={`Mark ${formatMoney(rec.amount, inv.currency)} transfer as received`}
                            >
                              <Check size={12} /> Received?
                            </button>
                            <button
                              onClick={() => handleRemoveTransfer(inv, rec.id, rec.amount)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="The money never arrived: remove"
                              aria-label={`Remove unconfirmed transfer of ${formatMoney(rec.amount, inv.currency)}`}
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ) : (
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-green-400">+{formatMoney(rec.amount, inv.currency)}</span>
                          <button
                            onClick={() => handleReceipt(inv, rec.id)}
                            disabled={isGenerating}
                            className="p-1 rounded text-slate-500 hover:text-indigo-300 hover:bg-white/10 transition-colors"
                            title="Receipt for this payment"
                            aria-label={`Receipt for payment of ${formatMoney(rec.amount, inv.currency)}`}
                          >
                            <Receipt size={14} />
                          </button>
                        </span>
                        )}
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

      </>
      )}

      {selectedInvoice && (
        <PaymentModal invoice={selectedInvoice} dateFormat={dateFormat} onClose={() => setSelectedInvoice(null)} onSave={handlePaymentUpdate} />
      )}

      {shareModal && <ShareModal state={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}
