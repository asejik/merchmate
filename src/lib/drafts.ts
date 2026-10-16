// Auto-saved drafts of a NEW invoice or quote, so a phone call, a crash or the system closing the
// app never loses what was typed. Stored on this device only (localStorage), one per kind.
// Editing, duplicating and converting do not use drafts: they change an existing document and ask
// before discarding.

import type { DocumentKind } from '../types';
import { addDays, daysBetween, toDateInputValue, toNumber, type InvoiceDraft } from './invoice';

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const keyFor = (kind: DocumentKind) => `invoiceDraft:${kind}`;
const KINDS: DocumentKind[] = ['invoice', 'quote'];
const defaultStorage = (): DraftStorage => localStorage;

export interface StoredDraft {
  savedAt: string; // ISO
  values: InvoiceDraft;
}

/** True when the user has entered something worth keeping (an untouched form is not a draft). */
export function hasContent(values: Partial<InvoiceDraft>): boolean {
  return !!(
    values.customerId ||
    values.notes?.trim() ||
    values.deliveryDate ||
    toNumber(values.depositAmount) > 0 ||
    values.plan?.length ||
    values.costs?.length ||
    values.items?.some(item => item.description?.trim() || toNumber(item.unitPrice) > 0)
  );
}

export function saveDraft(kind: DocumentKind, values: InvoiceDraft, now: Date = new Date(), storage: DraftStorage = defaultStorage()): void {
  try {
    if (!hasContent(values)) storage.removeItem(keyFor(kind));
    else storage.setItem(keyFor(kind), JSON.stringify({ savedAt: now.toISOString(), values } satisfies StoredDraft));
  } catch {
    // Storage full or unavailable: a draft is a convenience, never a reason to fail
  }
}

const isDraft = (value: unknown): value is StoredDraft => {
  const draft = value as StoredDraft | null;
  return !!draft && typeof draft.savedAt === 'string' && !Number.isNaN(Date.parse(draft.savedAt))
    && !!draft.values && Array.isArray(draft.values.items) && Array.isArray(draft.values.plan) && Array.isArray(draft.values.costs)
    && typeof draft.values.invoiceNumber === 'string' && typeof draft.values.customerId === 'string';
};

export function loadDraft(kind: DocumentKind, storage: DraftStorage = defaultStorage()): StoredDraft | null {
  try {
    const raw = storage.getItem(keyFor(kind));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed) && hasContent(parsed.values)) return parsed;
    storage.removeItem(keyFor(kind)); // damaged or empty: discard it
  } catch {
    clearDraft(kind, storage); // unreadable: discard it too
  }
  return null;
}

export function clearDraft(kind: DocumentKind, storage: DraftStorage = defaultStorage()): void {
  try {
    storage.removeItem(keyFor(kind));
  } catch {
    // nothing to clear
  }
}

export function clearAllDrafts(storage: DraftStorage = defaultStorage()): void {
  KINDS.forEach(kind => clearDraft(kind, storage));
}

/**
 * Turns a stored draft into form values for today. A draft from an earlier day must not quietly
 * backdate the invoice, so its dates restart from today (keeping the payment terms and delivery gap
 * it had); and a number someone else has used since is replaced by the next free one.
 */
export function restoreValues(stored: StoredDraft, fresh: InvoiceDraft, today: string, numberTaken: boolean): InvoiceDraft {
  const values = { ...fresh, ...stored.values };
  if (numberTaken || !values.invoiceNumber.trim()) values.invoiceNumber = fresh.invoiceNumber;
  const savedDay = toDateInputValue(new Date(stored.savedAt));
  if (savedDay !== today && values.dateIssued) {
    const termDays = values.dueDate ? daysBetween(values.dateIssued, values.dueDate) : null;
    const deliveryDays = values.deliveryDate ? daysBetween(values.dateIssued, values.deliveryDate) : null;
    values.dateIssued = today;
    values.dueDate = termDays === null ? '' : addDays(today, termDays);
    values.deliveryDate = deliveryDays === null ? '' : addDays(today, deliveryDays);
    values.plan = values.plan.map(step => ({ ...step, dueDate: step.dueDate ? addDays(today, daysBetween(stored.values.dateIssued, step.dueDate)) : '' }));
  }
  return values;
}
