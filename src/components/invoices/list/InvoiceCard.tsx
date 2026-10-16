import { useEffect, useRef } from 'react';
import { FileText, Download, Share2, CreditCard, History, MoreVertical, Pencil, Copy, Trash2, MessageCircle, Receipt, FileCheck2, Check, ChevronRight, X, ShieldAlert, Ban, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../../ui/GlassCard';
import type { BusinessProfile, DateFormat } from '../../../types';
import { formatMoney } from '../../../lib/currency';
import { formatDate } from '../../../lib/dates';
import { getBalance, getConfirmedPayments, getPaymentHistory, getUnconfirmedAmount, isQuote, nextInstallment } from '../../../lib/invoice';
import { isDeliveryLate, nextStage, ORDER_STAGES, stageLabel } from '../../../lib/orders';
import { getJobProfit } from '../../../lib/profit';
import { clientWhatsAppLink } from '../../../lib/whatsapp';
import { STAGE_STYLES, STATUS_STYLES, timeAgo, type InvoiceRow } from './invoiceRow';
import type { InvoiceActions } from './useInvoiceActions';

// React 18 has no typed `inert` prop; the attribute itself works in every current browser
const INERT = { inert: '' } as Record<string, string>;

interface InvoiceCardProps {
  inv: InvoiceRow;
  business?: BusinessProfile;
  dateFormat?: DateFormat;
  today: string;
  isGenerating: boolean;
  menuOpen: boolean;
  menuUp: boolean; // open upwards near the bottom so the nav bar doesn't cover it
  /** Another card's menu is open: this one is covered by it, so it must not be reachable. */
  inert: boolean;
  onToggleMenu: (openUp: boolean) => void;
  onCloseMenu: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onConvert: () => void;
  actions: InvoiceActions;
}

/** One invoice or quote in the list: status, actions menu, and payment history. */
export function InvoiceCard({ inv, business, dateFormat, today, isGenerating, menuOpen, menuUp, inert, onToggleMenu, onCloseMenu, onRecordPayment, onEdit, onDuplicate, onConvert, actions }: InvoiceCardProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Opening the menu moves focus into it; closing it puts focus back on the button that opened it
  useEffect(() => {
    if (!menuOpen) return;
    const trigger = triggerRef.current;
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    return () => trigger?.focus();
  }, [menuOpen]);

  /** Arrow keys, Home and End move between the menu items; Tab leaves the menu and closes it. */
  const handleMenuKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => { event.preventDefault(); items[(to + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Tab') onCloseMenu();
  };

  const { setStage, markReminded, handlePrepareShare, handleReceipt, handleConfirmTransfer, handleRemoveTransfer, handleDownload, handleDelete, handleVoid, handleReinstate } = actions;

  const history = getPaymentHistory(inv);
  const statusStyle = STATUS_STYLES[inv.displayStatus];
  const quote = isQuote(inv);
  const voided = !!inv.voidedAt;
  const unpaidInvoice = !quote && !voided && inv.status !== 'paid';
  const hasConfirmedPayments = getConfirmedPayments(inv).length > 0;
  const orderReady = !quote && !voided && inv.orderStage === 'ready';
  const showWhatsApp = unpaidInvoice || orderReady;
  // Rendered as a plain link (not window.open after an await) so popup blockers never interfere
  const reminderUrl = showWhatsApp && business && inv.customer ? clientWhatsAppLink(inv, inv.customer, business) : null;
  const upcomingStage = inv.orderStage ? nextStage(inv.orderStage) : null;
  const deliveryLate = isDeliveryLate(inv, today);
  const unconfirmedAmount = quote ? 0 : getUnconfirmedAmount(inv);
  const nextStep = unpaidInvoice ? nextInstallment(inv, today) : null;
  const jobProfit = getJobProfit(inv);

  return (
    // Raise the card with an open menu above its siblings (each card is its own stacking context)
    <GlassCard className={clsx("p-4 flex flex-col gap-4 group", menuOpen && "relative z-30")} {...(inert ? INERT : undefined)}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 w-full">
          <div className={`p-3 rounded-full ${statusStyle}`}>
            <FileText size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold">{inv.customerName}</h2>
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
              {inv.orderStage && !quote && !voided && (
                <button
                  onClick={() => upcomingStage && setStage(inv, upcomingStage)}
                  disabled={!upcomingStage}
                  className={clsx(
                    "relative text-[10px] uppercase px-2 py-0.5 rounded border inline-flex items-center gap-0.5 transition-opacity after:absolute after:-inset-x-1 after:-inset-y-3.5 after:content-['']",
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
                {quote || voided || inv.status === 'paid'
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
            <button onClick={onRecordPayment} className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors" title="Record Payment" aria-label="Record payment">
              <CreditCard size={20} />
            </button>
          )}
          {showWhatsApp && (reminderUrl ? (
            <a
              href={reminderUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markReminded(inv)}
              className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-emerald-500/10 rounded-lg text-emerald-400 transition-colors"
              title={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
              aria-label={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
            >
              <MessageCircle size={20} />
            </a>
          ) : (
            <span className="inline-flex items-center justify-center min-h-11 min-w-11 text-slate-600" title={business ? "Client has no phone number" : "Add your business details in Settings first"}>
              <MessageCircle size={20} />
            </span>
          ))}
          {!voided && (<>
          <button
            onClick={() => handlePrepareShare(inv)}
            disabled={isGenerating}
            className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-green-500/10 rounded-lg text-green-500 transition-colors"
            title="Share PDF"
            aria-label="Share PDF"
          >
            {isGenerating ? (
                <div className="h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
                <Share2 size={20} />
            )}
          </button>
          <button onClick={() => handleDownload(inv)} disabled={isGenerating} className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-white/10 rounded-lg text-indigo-400 transition-colors" title="Download PDF" aria-label="Download PDF">
            <Download size={20} />
          </button>
          </>)}
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={(e) => onToggleMenu(e.currentTarget.getBoundingClientRect().top > window.innerHeight / 2)}
              className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
              title="More actions"
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                <div className={clsx("absolute right-0 z-20 w-48", menuUp ? "bottom-full mb-1" : "top-full mt-1", "rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1 text-sm")} role="menu" aria-label="Actions" ref={menuRef} onKeyDown={handleMenuKeys}>
                  {quote && !inv.convertedInvoiceId && (
                    <button role="menuitem" onClick={() => { onCloseMenu(); onConvert(); }} className="w-full flex items-center gap-2 px-3 py-2 text-green-300 hover:bg-white/10">
                      <FileCheck2 size={14} /> Convert to Invoice
                    </button>
                  )}
                  {!voided && (
                    <button role="menuitem" onClick={() => { onCloseMenu(); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  <button role="menuitem" onClick={() => { onCloseMenu(); onDuplicate(); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10">
                    <Copy size={14} /> Duplicate
                  </button>
                  {!quote && !voided && (
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
                  {voided ? (
                    <button role="menuitem" onClick={() => handleReinstate(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-green-300 hover:bg-white/10">
                      <Undo2 size={14} /> Reinstate
                    </button>
                  ) : hasConfirmedPayments ? (
                    <button role="menuitem" onClick={() => handleVoid(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10">
                      <Ban size={14} /> Void
                    </button>
                  ) : (
                    <button role="menuitem" onClick={() => handleDelete(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10">
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
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
                      className="flex items-center gap-1 px-3 min-h-11 rounded bg-green-500/15 text-green-300 hover:bg-green-500/25 transition-colors"
                      title="I've seen this money in my bank account"
                      aria-label={`Mark ${formatMoney(rec.amount, inv.currency)} transfer as received`}
                    >
                      <Check size={12} /> Received?
                    </button>
                    <button
                      onClick={() => handleRemoveTransfer(inv, rec.id, rec.amount)}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
                    className="inline-flex items-center justify-center min-h-11 min-w-11 rounded text-slate-500 hover:text-indigo-300 hover:bg-white/10 transition-colors"
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
}
