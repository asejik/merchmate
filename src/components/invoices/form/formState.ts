import { db } from '../../../db';
import type { DocumentKind, Invoice } from '../../../types';
import {
  addDays,
  convertQuoteDraft,
  duplicateDraft,
  invoiceToDraft,
  kindOf,
  nextInvoiceNumber,
  QUOTE_PREFIX,
  todayInputValue,
  type InvoiceDraft,
} from '../../../lib/invoice';

export type InvoiceEditorMode = 'create' | 'create-quote' | 'edit' | 'duplicate' | 'convert';

export const EMPTY_ITEM = { description: '', quantity: 1, unitPrice: 0 };

export function titles(mode: InvoiceEditorMode, kind: DocumentKind): { title: string; subtitle: string; submit: string } {
  const noun = kind === 'quote' ? 'Quote' : 'Invoice';
  switch (mode) {
    case 'edit':
      return { title: `Edit ${noun}`, subtitle: kind === 'quote' ? 'Update the quote before sending it again.' : 'Payments already recorded are kept.', submit: 'Save Changes' };
    case 'duplicate':
      return { title: `Duplicate ${noun}`, subtitle: 'A fresh copy with a new number.', submit: `Create ${noun}` };
    case 'convert':
      return { title: 'Convert Quote to Invoice', subtitle: 'Same items and prices. Adjust anything before saving.', submit: 'Create Invoice' };
    case 'create-quote':
      return { title: 'New Quote', subtitle: 'Send a price estimate. Convert it to an invoice once accepted.', submit: 'Create Quote' };
    default:
      return { title: 'New Invoice', subtitle: 'Bill a client for goods or services.', submit: 'Generate Invoice' };
  }
}

export interface InitialState {
  values: InvoiceDraft;
  kind: DocumentKind;
  existing?: Invoice;
  convertFrom?: Invoice;
}

export async function loadInitialValues(mode: InvoiceEditorMode, sourceInvoiceId?: string): Promise<InitialState> {
  const [all, profile, source] = await Promise.all([
    db.invoices.toArray(),
    db.businessProfile.orderBy('id').first(),
    sourceInvoiceId ? db.invoices.get(sourceInvoiceId) : undefined,
  ]);
  // Invoices and quotes are numbered independently, each continuing from its most recent number
  const nextNumber = (kind: DocumentKind) => nextInvoiceNumber(
    all
      .filter(doc => kindOf(doc) === kind)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(doc => doc.invoiceNumber),
    kind === 'quote' ? QUOTE_PREFIX : undefined,
  );
  if (mode !== 'create' && mode !== 'create-quote' && !source) throw new Error('Invoice not found');

  if (mode === 'edit' && source) return { values: invoiceToDraft(source), kind: kindOf(source), existing: source };
  if (mode === 'duplicate' && source) return { values: duplicateDraft(source, nextNumber(kindOf(source))), kind: kindOf(source) };
  if (mode === 'convert' && source) {
    return { values: convertQuoteDraft(source, nextNumber('invoice'), profile?.defaultDueDays), kind: 'invoice', convertFrom: source };
  }

  const kind: DocumentKind = mode === 'create-quote' ? 'quote' : 'invoice';
  const today = todayInputValue();
  // Quotes default to 30 days validity; invoices use the business's payment terms
  const dueDays = kind === 'quote' ? 30 : profile?.defaultDueDays;
  return {
    kind,
    values: {
      customerId: '',
      invoiceNumber: nextNumber(kind),
      currency: 'NGN',
      dateIssued: today,
      dueDate: dueDays !== undefined ? addDays(today, dueDays) : '',
      items: [EMPTY_ITEM],
      discountType: 'percentage',
      discountRate: 0,
      taxRate: profile?.defaultTaxRate ?? 0,
      taxLabel: profile?.taxLabel || 'VAT',
      notes: '',
      deliveryDate: '',
      plan: [],
      costs: [],
      depositAmount: 0,
    },
  };
}
