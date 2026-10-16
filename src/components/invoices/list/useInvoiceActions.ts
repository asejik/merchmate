import { useState } from 'react';
import { db } from '../../../db';
import { confirmTransfer, deleteInvoice, discardTransfer, recordPayment, reinstateInvoice, voidInvoice } from '../../../db/mutations';
import type { Invoice, OrderStage } from '../../../types';
import { formatMoney } from '../../../lib/currency';
import { failed } from '../../../lib/messages';
import { getBalance, getUnconfirmedAmount, isQuote } from '../../../lib/invoice';
import { renderInvoicePdf } from '../../../lib/pdf';
import { downloadBlob, type ShareFile } from '../../../lib/share';
import type { ShareState } from '../../ui/ShareModal';
import { buildInvoiceText, DEFAULT_COUNTRY_CODE, toWhatsAppNumber, whatsAppLink } from '../../../lib/whatsapp';
import { renderInvoiceImage } from '../../../lib/invoiceImage';
import { invoiceShareFile, loadParties, receiptShareFile } from './documents';
import type { InvoiceRow } from './invoiceRow';

/** Everything the invoice list can do to a document: share, pay, deliver, void, delete. */
export function useInvoiceActions(closeMenu: () => void) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [shareModal, setShareModal] = useState<ShareState | null>(null);

  const setStage = async (invoice: InvoiceRow, stage: OrderStage) => {
    closeMenu();
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
      alert(failed('update the order'));
    }
  };

  const markReminded = (invoice: Invoice) => {
    if (invoice.id) db.invoices.update(invoice.id, { lastReminderAt: new Date() }).catch(console.error);
  };

  /** Runs a PDF job with the row's spinner showing and a readable error on failure. */
  const withGenerating = async (invoice: Invoice, job: () => Promise<void>) => {
    if (!invoice.id) return;
    setGeneratingId(invoice.id);
    try {
      await job();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(failed('create the PDF'));
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

  /** Offers the receipt for the payment just saved (and the updated invoice). */
  const shareAfterPayment = async (updated: Invoice, paymentId: string | undefined, withInvoice: boolean) => {
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

  /** Runs a payment change against the stored invoice; returns it, or null (with a message) when it failed. */
  const savePayment = async (change: () => Promise<Invoice | null>): Promise<Invoice | null> => {
    try {
      const saved = await change();
      if (!saved) alert("This payment could not be updated. The invoice may have changed or been deleted. Please check it and try again.");
      return saved;
    } catch (error) {
      console.error(error);
      alert(failed('save the payment'));
      return null;
    }
  };

  const handlePaymentUpdate = async (amount: number, note: string, unconfirmed: boolean) => {
    if (!selectedInvoice?.id) return;
    const invoiceId = selectedInvoice.id;
    setSelectedInvoice(null);
    const saved = await savePayment(() => recordPayment(invoiceId, amount, note, unconfirmed));
    // An unconfirmed transfer has nothing to send yet: the receipt comes when it is confirmed
    if (saved && !unconfirmed) await shareAfterPayment(saved, saved.payments?.at(-1)?.id, true);
  };

  const handleConfirmTransfer = async (invoice: Invoice, paymentId: string) => {
    if (!invoice.id) return;
    const invoiceId = invoice.id;
    const saved = await savePayment(() => confirmTransfer(invoiceId, paymentId));
    if (saved) await shareAfterPayment(saved, paymentId, false);
  };

  const handleRemoveTransfer = async (invoice: Invoice, paymentId: string, amount: number) => {
    if (!invoice.id) return;
    const invoiceId = invoice.id;
    if (!confirm(`Remove this ${formatMoney(amount, invoice.currency)} transfer?\n\nOnly do this if the money never arrived in your account.`)) return;
    await savePayment(() => discardTransfer(invoiceId, paymentId));
  };

  const handleDownload = (invoice: Invoice) => withGenerating(invoice, async () => {
    const parties = await loadParties(invoice);
    if (!parties) return;
    downloadBlob(await renderInvoicePdf(invoice, parties.business, parties.customer), `${invoice.invoiceNumber}.pdf`);
  });

  const handleDelete = async (invoice: InvoiceRow) => {
    closeMenu();
    if (!invoice.id) return;
    const docNoun = isQuote(invoice) ? 'quote' : 'invoice';
    if (!confirm(`Delete ${docNoun} #${invoice.invoiceNumber} for ${invoice.customerName}? This cannot be undone.`)) return;
    try {
      if (!await deleteInvoice(invoice.id)) {
        alert(`${docNoun} #${invoice.invoiceNumber} has payments on record, so it can't be deleted. Use Void instead.`);
      }
    } catch (err) {
      console.error(err);
      alert(failed('delete this document'));
    }
  };

  const handleVoid = async (invoice: InvoiceRow) => {
    closeMenu();
    if (!invoice.id) return;
    if (!confirm(
      `Void invoice #${invoice.invoiceNumber} for ${invoice.customerName}?\n\n` +
      `It stays on record with its ${formatMoney(invoice.depositAmount, invoice.currency)} of payments and receipts, ` +
      `but it no longer counts as money owed, and can't be edited or sent. You can reinstate it later.\n\n` +
      `Money you already received is not refunded by this: handle any refund yourself.`
    )) return;
    try {
      const result = await voidInvoice(invoice.id);
      if (result === 'unconfirmed-transfers') alert("This invoice has transfers you haven't confirmed yet. Confirm them, or remove the ones that never arrived, then void it.");
    } catch (err) {
      console.error(err);
      alert(failed('void this invoice'));
    }
  };

  const handleReinstate = async (invoice: InvoiceRow) => {
    closeMenu();
    if (!invoice.id) return;
    try {
      await reinstateInvoice(invoice.id);
    } catch (err) {
      console.error(err);
      alert(failed('reinstate this invoice'));
    }
  };

  return {
    generatingId,
    selectedInvoice,
    setSelectedInvoice,
    shareModal,
    setShareModal,
    setStage,
    markReminded,
    handlePrepareShare,
    handleReceipt,
    handlePaymentUpdate,
    handleConfirmTransfer,
    handleRemoveTransfer,
    handleDownload,
    handleDelete,
    handleVoid,
    handleReinstate,
  };
}

export type InvoiceActions = ReturnType<typeof useInvoiceActions>;
