import type { DiscountType, DocumentKind, Invoice, InvoiceStatus, PaymentRecord, PlanInstallment } from '../types';

export const DEFAULT_INVOICE_TERMS = 'Payment is due by the date shown on this invoice.\nThank you for your business.';

/** Rounds to 2 decimal places so floating point noise (0.1 + 0.2) never reaches stored totals. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Coerces form input (string, NaN, undefined) to a finite number, defaulting to 0. */
export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function lineTotal(quantity: unknown, unitPrice: unknown): number {
  return round2(toNumber(quantity) * toNumber(unitPrice));
}

export interface TotalsInput {
  items: { quantity: unknown; unitPrice: unknown }[];
  discountType: DiscountType;
  discountRate: unknown;
  taxRate?: unknown;
  amountPaid: unknown;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  balance: number;
}

const clampPercent = (value: unknown) => Math.min(100, Math.max(0, toNumber(value)));

/** subtotal -> discount (capped at subtotal) -> tax on the discounted amount -> grand total. */
export function calculateTotals({ items, discountType, discountRate, taxRate, amountPaid }: TotalsInput): Totals {
  const subtotal = round2(items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice), 0));
  const rate = Math.max(0, toNumber(discountRate));

  const discount = discountType === 'fixed'
    ? Math.min(round2(rate), subtotal)
    : round2(subtotal * (Math.min(rate, 100) / 100));

  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (clampPercent(taxRate) / 100));
  const grandTotal = round2(taxable + tax);
  const balance = Math.max(0, round2(grandTotal - toNumber(amountPaid)));

  return { subtotal, discount, tax, grandTotal, balance };
}

export function deriveStatus(grandTotal: number, amountPaid: number): InvoiceStatus {
  if (amountPaid >= grandTotal) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}

export function isVoid(invoice: Pick<Invoice, 'voidedAt'>): boolean {
  return !!invoice.voidedAt;
}

/** What the client still owes. A voided invoice owes nothing. */
export function getBalance(invoice: Pick<Invoice, 'grandTotal' | 'depositAmount'> & Partial<Pick<Invoice, 'voidedAt'>>): number {
  if (invoice.voidedAt) return 0;
  return Math.max(0, round2(invoice.grandTotal - invoice.depositAmount));
}

/** Cash actually received against this invoice (overpayments are not counted as revenue). */
export function getAmountCollected(invoice: Pick<Invoice, 'grandTotal' | 'depositAmount'>): number {
  return Math.min(invoice.depositAmount, invoice.grandTotal);
}

/**
 * A real moment inside a calendar day (local noon). Calendar dates are UTC midnight, which is
 * the previous evening west of UTC: using it as a payment time would show the wrong day and
 * count the payment in the wrong month. Noon lands on the same day in every timezone.
 */
export function calendarDayMoment(day: Date | string): Date {
  const d = new Date(day);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
}

/**
 * Invoices created before payment tracking have a depositAmount but no payments array.
 * Synthesize a single record for them so every screen shows the same history.
 */
export function getPaymentHistory(invoice: Pick<Invoice, 'payments' | 'depositAmount' | 'dateIssued'>): PaymentRecord[] {
  if (invoice.payments) return invoice.payments;
  if (invoice.depositAmount <= 0) return [];
  return [{
    id: 'legacy',
    date: calendarDayMoment(invoice.dateIssued).toISOString(),
    amount: invoice.depositAmount,
    note: 'Initial Deposit',
  }];
}

/** Payments that count as money received (excludes transfers awaiting confirmation). */
export function getConfirmedPayments(invoice: Pick<Invoice, 'payments' | 'depositAmount' | 'dateIssued'>): PaymentRecord[] {
  return getPaymentHistory(invoice).filter(p => !p.unconfirmed);
}

/** Total of transfers recorded but not yet seen in the bank. */
export function getUnconfirmedAmount(invoice: Pick<Invoice, 'payments' | 'depositAmount' | 'dateIssued'>): number {
  return round2(getPaymentHistory(invoice).filter(p => p.unconfirmed).reduce((sum, p) => sum + p.amount, 0));
}

type PaymentChanges = Pick<Invoice, 'depositAmount' | 'payments' | 'status' | 'updatedAt'>;

function withPayments(invoice: Invoice, payments: PaymentRecord[], received: number, now: Date): PaymentChanges {
  const depositAmount = round2(invoice.depositAmount + received);
  return { depositAmount, payments, status: deriveStatus(invoice.grandTotal, depositAmount), updatedAt: now };
}

/** Records a payment. An unconfirmed one is kept aside and does not reduce the balance until confirmed. */
export function applyPayment(
  invoice: Invoice,
  amount: number,
  note: string,
  now: Date = new Date(),
  options: { unconfirmed?: boolean } = {},
): PaymentChanges {
  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    date: now.toISOString(),
    amount: round2(amount),
    note: note.trim() || 'Payment',
    ...(options.unconfirmed && { unconfirmed: true }),
  };
  return withPayments(invoice, [...getPaymentHistory(invoice), payment], payment.unconfirmed ? 0 : payment.amount, now);
}

/**
 * Marks a transfer as received. It moves to the end of the history so receipt numbers
 * already issued for other payments never change.
 */
export function confirmPayment(invoice: Invoice, paymentId: string, now: Date = new Date()): PaymentChanges | null {
  const history = getPaymentHistory(invoice);
  const payment = history.find(p => p.id === paymentId);
  if (!payment?.unconfirmed) return null;
  const confirmed: PaymentRecord = { ...payment };
  delete confirmed.unconfirmed;
  return withPayments(invoice, [...history.filter(p => p.id !== paymentId), confirmed], payment.amount, now);
}

/** Drops a transfer that never arrived. Confirmed payments cannot be removed. */
export function removeUnconfirmedPayment(invoice: Invoice, paymentId: string, now: Date = new Date()): PaymentChanges | null {
  const history = getPaymentHistory(invoice);
  if (!history.find(p => p.id === paymentId)?.unconfirmed) return null;
  return withPayments(invoice, history.filter(p => p.id !== paymentId), 0, now);
}

/** Dexie v2 upgrade: invoices saved before v2 have no createdAt. */
export function backfillCreatedAt(invoice: Partial<Pick<Invoice, 'createdAt' | 'updatedAt' | 'dateIssued'>>): void {
  if (!invoice.createdAt) {
    invoice.createdAt = invoice.updatedAt ?? invoice.dateIssued ?? new Date();
  }
}

/**
 * Increments the most recent number, keeping its format ("2026/INV/07" -> "2026/INV/08"),
 * and skips numbers already in use. Following the most recent (not the highest) lets a
 * user restart a sequence by typing e.g. "INV-001" once.
 * @param numbersOldestFirst existing numbers of the same kind, ordered by creation
 */
export function nextInvoiceNumber(numbersOldestFirst: string[], fallbackPrefix = 'INV-'): string {
  const used = new Set(numbersOldestFirst.map(n => n.trim().toLowerCase()));
  const match = numbersOldestFirst.at(-1)?.trim().match(/^(.*?)(\d+)(\D*)$/);
  const [prefix, digits, suffix] = match ? [match[1], match[2], match[3]] : [fallbackPrefix, '000', ''];
  let n = parseInt(digits, 10);
  let candidate: string;
  do {
    n += 1;
    candidate = `${prefix}${String(n).padStart(digits.length, '0')}${suffix}`;
  } while (used.has(candidate.toLowerCase()));
  return candidate;
}

// ---------- Dates ----------
// Dates entered in forms are calendar days ("YYYY-MM-DD"), stored as UTC midnight.

/** Date -> "YYYY-MM-DD" for <input type="date">. */
export function toDateInputValue(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Today's calendar date in the user's local timezone, as "YYYY-MM-DD". */
export function todayInputValue(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(dateInput: string, days: number): string {
  const date = new Date(dateInput);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

export function daysBetween(fromInput: string, toInput: string): number {
  return Math.round((new Date(toInput).getTime() - new Date(fromInput).getTime()) / 86_400_000);
}

export type DisplayStatus = InvoiceStatus | 'overdue' | 'open' | 'expired' | 'converted' | 'void';

export const QUOTE_PREFIX = 'QUO-';

export function isQuote(invoice: Pick<Invoice, 'kind'>): boolean {
  return invoice.kind === 'quote';
}

export function kindOf(invoice: Pick<Invoice, 'kind'>): DocumentKind {
  return invoice.kind ?? 'invoice';
}

type OverdueInput = Pick<Invoice, 'status' | 'dueDate' | 'kind'> & Partial<Pick<Invoice, 'paymentPlan' | 'grandTotal' | 'depositAmount' | 'voidedAt'>>;

/** Past the due date, or an instalment of its payment plan was missed. */
export function isOverdue(invoice: OverdueInput, today: string = todayInputValue()): boolean {
  if (isQuote(invoice) || invoice.status === 'paid' || invoice.voidedAt) return false;
  if (invoice.dueDate && toDateInputValue(invoice.dueDate) < today) return true;
  return getPlanOverdueAmount(invoice, today) > 0;
}

/** Overdue/expired are derived from dueDate at read time, never stored. */
export function getDisplayStatus(invoice: OverdueInput & Pick<Invoice, 'convertedInvoiceId'>, today: string = todayInputValue()): DisplayStatus {
  if (isQuote(invoice)) {
    if (invoice.convertedInvoiceId) return 'converted';
    return invoice.dueDate && toDateInputValue(invoice.dueDate) < today ? 'expired' : 'open';
  }
  if (invoice.voidedAt) return 'void';
  return isOverdue(invoice, today) ? 'overdue' : invoice.status;
}

// ---------- Payment plans ----------

export type InstallmentState = 'paid' | 'part-paid' | 'overdue' | 'due-today' | 'upcoming';

export interface InstallmentStatus {
  installment: PlanInstallment;
  amount: number;
  paid: number; // portion of this instalment covered by payments so far
  remaining: number;
  state: InstallmentState;
}

/** Instalment amounts for a total. The last absorbs rounding so they always add up exactly. */
export function planAmounts(grandTotal: number, plan: Pick<PlanInstallment, 'percent'>[]): number[] {
  let allocated = 0;
  return plan.map((step, i) => {
    const amount = i === plan.length - 1 ? round2(grandTotal - allocated) : round2(grandTotal * toNumber(step.percent) / 100);
    allocated = round2(allocated + amount);
    return amount;
  });
}

/** Each instalment with how much of it is paid. Payments fill instalments in order. */
export function getPlanStatus(
  invoice: Partial<Pick<Invoice, 'paymentPlan' | 'grandTotal' | 'depositAmount'>>,
  today: string = todayInputValue(),
): InstallmentStatus[] {
  const plan = invoice.paymentPlan ?? [];
  const grandTotal = invoice.grandTotal ?? 0;
  let unallocated = Math.min(invoice.depositAmount ?? 0, grandTotal);
  return planAmounts(grandTotal, plan).map((amount, i) => {
    const installment = plan[i];
    const paid = round2(Math.min(amount, Math.max(0, unallocated)));
    unallocated = round2(unallocated - paid);
    const remaining = round2(amount - paid);
    const due = installment.dueDate ? toDateInputValue(installment.dueDate) : null;
    const state: InstallmentState = remaining <= 0 ? 'paid'
      : due && due < today ? 'overdue'
      : due === today ? 'due-today'
      : paid > 0 ? 'part-paid'
      : 'upcoming';
    return { installment, amount, paid, remaining, state };
  });
}

/** Unpaid amount of instalments whose date has passed. */
export function getPlanOverdueAmount(invoice: Partial<Pick<Invoice, 'paymentPlan' | 'grandTotal' | 'depositAmount'>>, today: string = todayInputValue()): number {
  if (!invoice.paymentPlan?.length) return 0;
  return round2(getPlanStatus(invoice, today).filter(s => s.state === 'overdue').reduce((sum, s) => sum + s.remaining, 0));
}

/** How much is overdue: the whole balance once past the due date, else any missed instalments. */
export function getOverdueAmount(invoice: Invoice, today: string = todayInputValue()): number {
  if (!isOverdue(invoice, today)) return 0;
  if (invoice.dueDate && toDateInputValue(invoice.dueDate) < today) return getBalance(invoice);
  return getPlanOverdueAmount(invoice, today);
}

/** The first instalment not yet fully paid, or null when the plan is settled (or there is none). */
export function nextInstallment(invoice: Partial<Pick<Invoice, 'paymentPlan' | 'grandTotal' | 'depositAmount'>>, today: string = todayInputValue()): InstallmentStatus | null {
  return getPlanStatus(invoice, today).find(s => s.remaining > 0) ?? null;
}

/**
 * What to ask the client for now: with a plan, the missed and due instalments
 * (or else the next one); without a plan, the whole balance.
 */
export function getAmountToRequest(invoice: Invoice, today: string = todayInputValue()): number {
  if (invoice.voidedAt) return 0;
  if (!invoice.paymentPlan?.length) return getBalance(invoice);
  const statuses = getPlanStatus(invoice, today);
  const dueNow = round2(statuses.filter(s => s.state === 'overdue' || s.state === 'due-today').reduce((sum, s) => sum + s.remaining, 0));
  return dueNow > 0 ? dueNow : statuses.find(s => s.remaining > 0)?.remaining ?? 0;
}

export interface PlanDraftStep {
  label: string;
  percent: number;
  dueDate: string; // '' = no fixed date
}

/** Error message for a plan being entered, or null when it is valid (an empty plan is valid). */
export function validatePlan(plan: PlanDraftStep[]): string | null {
  if (plan.length === 0) return null;
  if (plan.length === 1) return 'A payment plan needs at least two instalments.';
  if (plan.some(step => !(toNumber(step.percent) > 0))) return 'Each instalment needs a percentage above 0.';
  const total = round2(plan.reduce((sum, step) => sum + toNumber(step.percent), 0));
  if (Math.abs(total - 100) > 0.01) return `Instalments add up to ${total}%. They must add up to 100%.`;
  return null;
}

/** Moves plan dates along with the invoice date (for duplicates and converted quotes). */
function shiftPlan(plan: PlanDraftStep[], fromDate: string, toDate: string): PlanDraftStep[] {
  const offset = daysBetween(fromDate, toDate);
  return plan.map(step => ({ ...step, dueDate: step.dueDate ? addDays(step.dueDate, offset) : '' }));
}

// ---------- Invoice form <-> stored invoice ----------

export interface InvoiceDraft {
  customerId: string;
  invoiceNumber: string;
  currency: Invoice['currency'];
  dateIssued: string;
  dueDate: string; // '' = no due date
  items: { description: string; quantity: number; unitPrice: number }[];
  discountType: DiscountType;
  discountRate: number;
  taxRate: number;
  taxLabel: string;
  notes: string;
  deliveryDate: string; // '' = none
  plan: PlanDraftStep[]; // [] = no payment plan
  costs: { description: string; amount: number }[]; // private job costs
  depositAmount: number; // Only used when creating; edits keep the recorded payments
}

/**
 * Builds the document to store. With `existing`, keeps its identity, kind and payment history.
 * Quotes never carry payments.
 */
export function composeInvoice(draft: InvoiceDraft, existing?: Invoice, now: Date = new Date(), kind: DocumentKind = 'invoice'): Invoice {
  const docKind = existing ? kindOf(existing) : kind;
  const amountPaid = docKind === 'quote'
    ? 0
    : existing ? existing.depositAmount : round2(Math.max(0, toNumber(draft.depositAmount)));
  const totals = calculateTotals({ ...draft, amountPaid });

  const payments: PaymentRecord[] = docKind === 'quote'
    ? []
    : existing
    ? getPaymentHistory(existing)
    : amountPaid > 0
      ? [{ id: crypto.randomUUID(), date: calendarDayMoment(draft.dateIssued).toISOString(), amount: amountPaid, note: 'Initial Deposit' }]
      : [];

  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    kind: docKind,
    customerId: draft.customerId,
    invoiceNumber: draft.invoiceNumber.trim(),
    items: draft.items.map(item => ({
      id: crypto.randomUUID(),
      description: item.description.trim(),
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      total: lineTotal(item.quantity, item.unitPrice),
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    discountRate: toNumber(draft.discountRate),
    discountType: draft.discountType,
    tax: totals.tax,
    taxRate: clampPercent(draft.taxRate),
    taxLabel: draft.taxLabel.trim() || 'Tax',
    grandTotal: totals.grandTotal,
    depositAmount: amountPaid,
    payments,
    currency: draft.currency,
    status: deriveStatus(totals.grandTotal, amountPaid),
    dateIssued: new Date(draft.dateIssued),
    dueDate: draft.dueDate ? new Date(draft.dueDate) : undefined,
    notes: draft.notes.trim() || undefined,
    deliveryDate: draft.deliveryDate ? new Date(draft.deliveryDate) : undefined,
    costs: draft.costs.some(c => toNumber(c.amount) > 0)
      ? draft.costs
        .filter(c => toNumber(c.amount) > 0)
        .map(c => ({ id: crypto.randomUUID(), description: c.description.trim() || 'Cost', amount: round2(toNumber(c.amount)) }))
      : undefined,
    paymentPlan: draft.plan.length > 0
      ? draft.plan.map((step, i) => ({
        id: crypto.randomUUID(),
        label: step.label.trim() || `Instalment ${i + 1}`,
        percent: toNumber(step.percent),
        dueDate: step.dueDate ? new Date(step.dueDate) : undefined,
      }))
      : undefined,
    // New invoices start in progress; edits keep their stage (untracked ones stay untracked)
    orderStage: docKind === 'quote' ? undefined : existing ? existing.orderStage : 'in_progress',
    isSynced: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Form values for editing an existing invoice. */
export function invoiceToDraft(invoice: Invoice): InvoiceDraft {
  return {
    customerId: invoice.customerId,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    dateIssued: toDateInputValue(invoice.dateIssued),
    dueDate: invoice.dueDate ? toDateInputValue(invoice.dueDate) : '',
    items: invoice.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
    discountType: invoice.discountType ?? 'percentage',
    discountRate: invoice.discountRate ?? 0,
    taxRate: invoice.taxRate ?? 0,
    taxLabel: invoice.taxLabel ?? 'Tax',
    notes: invoice.notes ?? '',
    deliveryDate: invoice.deliveryDate ? toDateInputValue(invoice.deliveryDate) : '',
    costs: (invoice.costs ?? []).map(({ description, amount }) => ({ description, amount })),
    plan: (invoice.paymentPlan ?? []).map(step => ({
      label: step.label,
      percent: step.percent,
      dueDate: step.dueDate ? toDateInputValue(step.dueDate) : '',
    })),
    depositAmount: invoice.depositAmount,
  };
}

/** Form values for a copy: new number, issued today, unpaid, same payment terms length. */
export function duplicateDraft(invoice: Invoice, invoiceNumber: string, today: string = todayInputValue()): InvoiceDraft {
  const draft = invoiceToDraft(invoice);
  const termDays = draft.dueDate ? daysBetween(draft.dateIssued, draft.dueDate) : null;
  return {
    ...draft,
    invoiceNumber,
    dateIssued: today,
    dueDate: termDays === null ? '' : addDays(today, termDays),
    deliveryDate: '',
    plan: shiftPlan(draft.plan, draft.dateIssued, today),
    depositAmount: 0,
  };
}

// ---------- Receipts ----------

export interface ReceiptInfo {
  payment: PaymentRecord;
  receiptNumber: string; // e.g. "INV-004-R2"
  paidToDate: number;
  balanceAfter: number;
}

/** Details for a receipt for one payment, as of that payment (not today's balance). */
export function getReceiptInfo(invoice: Invoice, paymentId: string): ReceiptInfo | null {
  const history = getConfirmedPayments(invoice);
  const index = history.findIndex(p => p.id === paymentId);
  if (index === -1) return null;
  const paidToDate = round2(history.slice(0, index + 1).reduce((sum, p) => sum + p.amount, 0));
  return {
    payment: history[index],
    receiptNumber: `${invoice.invoiceNumber}-R${index + 1}`,
    paidToDate,
    balanceAfter: Math.max(0, round2(invoice.grandTotal - paidToDate)),
  };
}

/** Form values for turning a quote into an invoice: same items and pricing, invoice numbering and terms. */
export function convertQuoteDraft(quote: Invoice, invoiceNumber: string, defaultDueDays?: number, today: string = todayInputValue()): InvoiceDraft {
  const draft = invoiceToDraft(quote);
  return {
    ...draft,
    plan: shiftPlan(draft.plan, draft.dateIssued, today),
    invoiceNumber,
    dateIssued: today,
    dueDate: defaultDueDays !== undefined ? addDays(today, defaultDueDays) : '',
    depositAmount: 0,
  };
}
