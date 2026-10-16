import { db } from './index';
import type { DocumentKind, Invoice } from '../types';
import { applyPayment, composeInvoice, confirmPayment, getConfirmedPayments, getUnconfirmedAmount, isQuote, removeUnconfirmedPayment, type InvoiceDraft } from '../lib/invoice';
import { learnFromItems } from '../lib/catalog';

type PaymentChanges = Pick<Invoice, 'depositAmount' | 'payments' | 'status' | 'updatedAt'>;

/**
 * Applies a payment change to the invoice as it is stored *now*, not to the copy a screen
 * is holding. Another tab or window may have recorded a payment since that copy was read,
 * and writing totals computed from it would silently erase that payment.
 * Returns the saved invoice, or null when it no longer exists or the change does not apply.
 */
async function changePayments(invoiceId: string, build: (fresh: Invoice) => PaymentChanges | null): Promise<Invoice | null> {
  return db.transaction('rw', db.invoices, async () => {
    const fresh = await db.invoices.get(invoiceId);
    const changes = fresh && build(fresh);
    if (!fresh || !changes) return null;
    await db.invoices.update(invoiceId, changes);
    return { ...fresh, ...changes };
  });
}

export const recordPayment = (invoiceId: string, amount: number, note: string, unconfirmed: boolean) =>
  changePayments(invoiceId, fresh => applyPayment(fresh, amount, note, new Date(), { unconfirmed }));

export const confirmTransfer = (invoiceId: string, paymentId: string) =>
  changePayments(invoiceId, fresh => confirmPayment(fresh, paymentId));

export const discardTransfer = (invoiceId: string, paymentId: string) =>
  changePayments(invoiceId, fresh => removeUnconfirmedPayment(fresh, paymentId));

/**
 * Deletes an invoice or quote. A quote that was converted into it becomes open again,
 * instead of pointing at an invoice that no longer exists.
 * An invoice with confirmed payments is never deleted (receipts were issued against it): void it.
 * Returns false when it was kept for that reason.
 */
export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  return db.transaction('rw', db.invoices, async () => {
    const doc = await db.invoices.get(invoiceId);
    if (doc && getConfirmedPayments(doc).length > 0) return false;
    await db.invoices.delete(invoiceId);
    await db.invoices.filter(other => other.convertedInvoiceId === invoiceId)
      .modify(other => { delete other.convertedInvoiceId; other.updatedAt = new Date(); });
    return true;
  });
}

export type VoidResult = 'voided' | 'unconfirmed-transfers' | 'not-an-invoice';

/**
 * Cancels an invoice but keeps it, its payments and its receipts on record. Transfers still
 * awaiting confirmation must be confirmed or removed first, so no unresolved money is left behind.
 */
export async function voidInvoice(invoiceId: string): Promise<VoidResult> {
  return db.transaction('rw', db.invoices, async () => {
    const doc = await db.invoices.get(invoiceId);
    if (!doc || isQuote(doc)) return 'not-an-invoice';
    if (getUnconfirmedAmount(doc) > 0) return 'unconfirmed-transfers';
    await db.invoices.update(invoiceId, { voidedAt: new Date(), updatedAt: new Date() });
    return 'voided';
  });
}

export async function reinstateInvoice(invoiceId: string): Promise<void> {
  await db.invoices.update(invoiceId, { voidedAt: undefined, updatedAt: new Date() });
}

/**
 * Deletes a client unless documents still reference it. The check and the delete share one
 * transaction so a document saved from another tab cannot slip in between and be orphaned.
 * Returns how many documents block the delete (0 = deleted).
 */
export async function deleteCustomer(customerId: string): Promise<number> {
  return db.transaction('rw', db.customers, db.invoices, async () => {
    const count = await db.invoices.where('customerId').equals(customerId).count();
    if (count === 0) await db.customers.delete(customerId);
    return count;
  });
}

/** Thrown by saveDocument when another document already uses the number. */
export class NumberInUseError extends Error {
  readonly number: string;
  constructor(number: string) {
    super(`Number ${number} is already used.`);
    this.number = number;
  }
}

/** Thrown by saveDocument when the invoice being edited was deleted meanwhile. */
export class DocumentGoneError extends Error {
  constructor() {
    super('This document was deleted.');
  }
}

/**
 * Saves an invoice or quote and learns its items for the catalog, in one transaction.
 * The number check lives inside it so two tabs cannot both claim the same number, and an edit
 * is composed from the stored invoice (not the copy the form loaded), so payments or reminders
 * recorded since then are kept.
 */
export async function saveDocument(draft: InvoiceDraft, existing: Invoice | undefined, kind: DocumentKind, convertFromId?: string): Promise<Invoice> {
  return db.transaction('rw', db.invoices, db.catalog, async () => {
    const number = draft.invoiceNumber.trim();
    const clash = await db.invoices.where('invoiceNumber').equals(number).and(doc => doc.id !== existing?.id).first();
    if (clash) throw new NumberInUseError(number);

    const current = existing?.id ? await db.invoices.get(existing.id) : undefined;
    if (existing && !current) throw new DocumentGoneError();

    const doc = composeInvoice(draft, current, new Date(), kind);
    await db.invoices.put(doc);
    if (convertFromId) await db.invoices.update(convertFromId, { convertedInvoiceId: doc.id, updatedAt: new Date() });
    await db.catalog.bulkPut(learnFromItems(await db.catalog.toArray(), doc.items, doc.currency));
    return doc;
  });
}
