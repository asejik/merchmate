import type { BusinessProfile, Customer, Invoice } from '../types';

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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the native share sheet (WhatsApp etc.) when the device can share files, otherwise downloads. */
export async function shareOrDownload(file: File, title: string, text: string): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
  } else {
    downloadBlob(file, file.name);
  }
}
