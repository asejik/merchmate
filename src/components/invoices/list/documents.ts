import { db } from '../../../db';
import type { BusinessProfile, Customer, Invoice } from '../../../types';
import { formatMoney } from '../../../lib/currency';
import { getReceiptInfo, isQuote } from '../../../lib/invoice';
import { renderInvoicePdf, renderReceiptPdf } from '../../../lib/pdf';
import type { ShareFile } from '../../../lib/share';

/** Both parties of a document, or null after telling the user (through `notify`) what is missing. */
export async function loadParties(invoice: Invoice, notify: (message: string) => void | Promise<void>): Promise<{ business: BusinessProfile; customer: Customer } | null> {
  const [business, customer] = await Promise.all([
    db.businessProfile.orderBy('id').first(),
    db.customers.get(invoice.customerId),
  ]);
  if (!business || !customer) {
    void notify(!business ? "Add your business details in Settings first." : "This invoice's client no longer exists.");
    return null;
  }
  return { business, customer };
}

export async function invoiceShareFile(invoice: Invoice, business: BusinessProfile, customer: Customer): Promise<ShareFile> {
  const blob = await renderInvoicePdf(invoice, business, customer);
  const noun = isQuote(invoice) ? 'Quote' : 'Invoice';
  return {
    label: noun,
    file: new File([blob], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' }),
    title: `${noun} #${invoice.invoiceNumber}`,
    text: `Hello, here is ${noun.toLowerCase()} #${invoice.invoiceNumber}.`,
  };
}

export async function receiptShareFile(invoice: Invoice, paymentId: string, business: BusinessProfile, customer: Customer): Promise<ShareFile | null> {
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
