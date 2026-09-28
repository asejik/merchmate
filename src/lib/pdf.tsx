import type { BusinessProfile, Customer, Invoice } from '../types';
import type { ReceiptInfo } from './invoice';
import type { StatementGroup } from './statement';

/**
 * Renders the invoice PDF. @react-pdf/renderer is ~1.5 MB, so it is loaded
 * on first use instead of being part of the initial bundle.
 */
export async function renderInvoicePdf(invoice: Invoice, business: BusinessProfile, customer: Customer): Promise<Blob> {
  const [{ pdf }, { InvoicePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/invoices/InvoicePDF'),
  ]);
  return pdf(<InvoicePDF invoice={invoice} business={business} customer={customer} />).toBlob();
}

export async function renderReceiptPdf(invoice: Invoice, receipt: ReceiptInfo, business: BusinessProfile, customer: Customer): Promise<Blob> {
  const [{ pdf }, { ReceiptPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/invoices/ReceiptPDF'),
  ]);
  return pdf(<ReceiptPDF invoice={invoice} receipt={receipt} business={business} customer={customer} />).toBlob();
}

export async function renderStatementPdf(business: BusinessProfile, customer: Customer, groups: StatementGroup[], generatedOn: Date = new Date()): Promise<Blob> {
  const [{ pdf }, { StatementPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/customers/StatementPDF'),
  ]);
  return pdf(<StatementPDF business={business} customer={customer} groups={groups} generatedOn={generatedOn} />).toBlob();
}
