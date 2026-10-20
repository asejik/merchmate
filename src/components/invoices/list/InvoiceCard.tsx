import { useEffect, useRef } from 'react';
import { Download, Share2, CreditCard, History, MoreVertical, Pencil, Copy, Trash2, MessageCircle, Receipt, FileCheck2, Check, ChevronRight, X, ShieldAlert, Ban, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { CHIP_TONES } from '../../ui/chipTones';
import type { BusinessProfile, DateFormat } from '../../../types';
import { formatMoney } from '../../../lib/currency';
import { formatDate } from '../../../lib/dates';
import { getBalance, getConfirmedPayments, getPaymentHistory, getUnconfirmedAmount, isQuote, nextInstallment } from '../../../lib/invoice';
import { isDeliveryLate, nextStage, ORDER_STAGES, stageLabel } from '../../../lib/orders';
import { getJobProfit } from '../../../lib/profit';
import { clientWhatsAppLink } from '../../../lib/whatsapp';
import { INERT, STAGE_TONES, STATUS_LABELS, STATUS_TONES, timeAgo, type InvoiceRow } from './invoiceRow';
import type { InvoiceActions } from './useInvoiceActions';

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
    <Card className={clsx("p-4 flex flex-col gap-4", menuOpen && "relative z-30")} {...(inert ? INERT : undefined)}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 w-full">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-ink">{inv.customerName}</h2>
            <p className="text-xs text-muted">
              #{inv.invoiceNumber} • {formatDate(inv.dateIssued, dateFormat)}
              {inv.dueDate && (quote ? !inv.convertedInvoiceId : inv.status !== 'paid') && (
                <> • {quote ? 'Valid until' : 'Due'} {formatDate(inv.dueDate, dateFormat)}</>
              )}
              {inv.deliveryDate && inv.orderStage !== 'delivered' && !inv.convertedInvoiceId && (
                <> • <span className={clsx(deliveryLate && "text-danger font-semibold")}>
                  {deliveryLate ? 'Delivery was' : 'Delivery'} {formatDate(inv.deliveryDate, dateFormat)}
                </span></>
              )}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Chip tone={STATUS_TONES[inv.displayStatus]} className={clsx(voided && 'line-through')}>
                {STATUS_LABELS[inv.displayStatus]}
              </Chip>
              {inv.orderStage && !quote && !voided && (
                <button
                  onClick={() => upcomingStage && setStage(inv, upcomingStage)}
                  disabled={!upcomingStage}
                  className={clsx(
                    "relative inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity after:absolute after:-inset-x-1 after:-inset-y-3.5 after:content-['']",
                    CHIP_TONES[STAGE_TONES[inv.orderStage]],
                    upcomingStage && "hover:opacity-80"
                  )}
                  title={upcomingStage ? `Mark as ${stageLabel(upcomingStage)}` : 'Delivered'}
                  aria-label={upcomingStage ? `Order ${stageLabel(inv.orderStage)}. Mark as ${stageLabel(upcomingStage)}` : 'Order delivered'}
                >
                  {stageLabel(inv.orderStage)}
                  {upcomingStage && <ChevronRight size={12} aria-hidden="true" />}
                </button>
              )}
              <span className="money text-sm font-bold text-ink">
                {quote || voided || inv.status === 'paid'
                  ? formatMoney(inv.grandTotal, inv.currency)
                  : `Due: ${formatMoney(getBalance(inv), inv.currency)}`}
              </span>
              {unconfirmedAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning" title="Transfers you haven't seen in your bank account yet">
                  <ShieldAlert size={12} aria-hidden="true" /> {formatMoney(unconfirmedAmount, inv.currency)} unconfirmed
                </span>
              )}
              {inv.lastReminderAt && showWhatsApp && (
                <span className="text-xs text-muted">Messaged {timeAgo(inv.lastReminderAt)}</span>
              )}
            </div>
            {jobProfit && (
              <p className="mt-1 text-xs text-muted" title="From your private costs. Not shown to the client.">
                {quote ? 'Expected profit' : 'Profit'}: <span className={jobProfit.profit < 0 ? "text-danger font-semibold" : "text-ink"}>{formatMoney(jobProfit.profit, inv.currency)}</span>
                {jobProfit.margin !== null && <> · {jobProfit.margin}%</>}
              </p>
            )}
            {nextStep && (
              <p className={clsx("mt-1 text-xs", nextStep.state === 'overdue' ? "text-danger font-semibold" : "text-muted")}>
                Next: {nextStep.installment.label} · {formatMoney(nextStep.remaining, inv.currency)}
                {nextStep.installment.dueDate && <> · {nextStep.state === 'overdue' ? 'was due' : 'by'} {formatDate(nextStep.installment.dueDate, dateFormat)}</>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {unpaidInvoice && (
            <button onClick={onRecordPayment} className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-success-tint rounded-lg text-success transition-colors duration-150" title="Record payment" aria-label="Record payment">
              <CreditCard size={20} />
            </button>
          )}
          {showWhatsApp && (reminderUrl ? (
            <a
              href={reminderUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markReminded(inv)}
              className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-success-tint rounded-lg text-success transition-colors duration-150"
              title={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
              aria-label={orderReady ? "Tell client on WhatsApp that the order is ready" : "Send WhatsApp payment reminder"}
            >
              <MessageCircle size={20} />
            </a>
          ) : (
            <span className="inline-flex items-center justify-center min-h-11 min-w-11 text-muted opacity-60" title={business ? "Client has no phone number" : "Add your business details in Settings first"}>
              <MessageCircle size={20} />
            </span>
          ))}
          {!voided && (<>
          <button
            onClick={() => handlePrepareShare(inv)}
            disabled={isGenerating}
            className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-primary-tint rounded-lg text-primary transition-colors duration-150"
            title="Share PDF"
            aria-label="Share PDF"
          >
            {isGenerating ? (
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
                <Share2 size={20} />
            )}
          </button>
          <button onClick={() => handleDownload(inv)} disabled={isGenerating} className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-primary-tint rounded-lg text-primary transition-colors duration-150" title="Download PDF" aria-label="Download PDF">
            <Download size={20} />
          </button>
          </>)}
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={(e) => onToggleMenu(e.currentTarget.getBoundingClientRect().top > window.innerHeight / 2)}
              className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-sunken rounded-lg text-muted hover:text-ink transition-colors duration-150"
              title="More actions"
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                <div className={clsx("absolute right-0 z-20 w-48", menuUp ? "bottom-full mb-1" : "top-full mt-1", "rounded-xl border border-line bg-surface shadow-raised py-1 text-sm")} role="menu" aria-label="Actions" ref={menuRef} onKeyDown={handleMenuKeys}>
                  {quote && !inv.convertedInvoiceId && (
                    <button role="menuitem" onClick={() => { onCloseMenu(); onConvert(); }} className="w-full flex items-center gap-2 px-3 py-2 text-success hover:bg-sunken">
                      <FileCheck2 size={14} /> Convert to Invoice
                    </button>
                  )}
                  {!voided && (
                    <button role="menuitem" onClick={() => { onCloseMenu(); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-ink hover:bg-sunken">
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  <button role="menuitem" onClick={() => { onCloseMenu(); onDuplicate(); }} className="w-full flex items-center gap-2 px-3 py-2 text-ink hover:bg-sunken">
                    <Copy size={14} /> Duplicate
                  </button>
                  {!quote && !voided && (
                    <div className="border-y border-line my-1 py-1" role="group" aria-label="Order stage">
                      <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-muted">Order</p>
                      {ORDER_STAGES.map(stage => (
                        <button
                          key={stage.id}
                          role="menuitemradio"
                          aria-checked={inv.orderStage === stage.id}
                          onClick={() => setStage(inv, stage.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-ink hover:bg-sunken"
                        >
                          <Check size={14} className={clsx(inv.orderStage !== stage.id && "invisible")} /> {stage.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {voided ? (
                    <button role="menuitem" onClick={() => handleReinstate(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-success hover:bg-sunken">
                      <Undo2 size={14} /> Reinstate
                    </button>
                  ) : hasConfirmedPayments ? (
                    <button role="menuitem" onClick={() => handleVoid(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger-tint">
                      <Ban size={14} /> Void
                    </button>
                  ) : (
                    <button role="menuitem" onClick={() => handleDelete(inv)} className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger-tint">
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
        <div className="mt-2 pt-3 border-t border-line">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted">
            <History size={12} aria-hidden="true" /> Payment history
          </div>
          <div className="space-y-1">
            {history.map((rec) => (
              <div key={rec.id} className={clsx("flex flex-wrap justify-between items-center gap-x-2 gap-y-1 text-xs px-2 py-1 rounded", rec.unconfirmed ? "bg-warning-tint" : "bg-sunken")}>
                <span className="text-muted">
                   {formatDate(rec.date, dateFormat, { moment: true })}
                   {rec.note && <span className="ml-2 rounded border border-line-strong px-1 text-xs">{rec.note}</span>}
                </span>
                {rec.unconfirmed ? (
                  <span className="flex items-center gap-1 ml-auto">
                    <span className="money font-semibold text-warning mr-1" title="Awaiting confirmation">{formatMoney(rec.amount, inv.currency)}</span>
                    <button
                      onClick={() => handleConfirmTransfer(inv, rec.id)}
                      disabled={isGenerating}
                      className="flex items-center gap-1 px-3 min-h-11 rounded-lg bg-success-tint text-success font-semibold hover:opacity-80 transition-opacity"
                      title="I've seen this money in my bank account"
                      aria-label={`Mark ${formatMoney(rec.amount, inv.currency)} transfer as received`}
                    >
                      <Check size={12} /> Received?
                    </button>
                    <button
                      onClick={() => handleRemoveTransfer(inv, rec.id, rec.amount)}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-muted hover:text-danger hover:bg-danger-tint transition-colors duration-150"
                      title="The money never arrived: remove"
                      aria-label={`Remove unconfirmed transfer of ${formatMoney(rec.amount, inv.currency)}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ) : (
                <span className="flex items-center gap-2">
                  <span className="money font-semibold text-success">+{formatMoney(rec.amount, inv.currency)}</span>
                  <button
                    onClick={() => handleReceipt(inv, rec.id)}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-muted hover:text-primary hover:bg-primary-tint transition-colors duration-150"
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
    </Card>
  );
}
