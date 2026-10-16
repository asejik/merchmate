import { z } from 'zod';
import type { BusinessProfile, CatalogItem, Customer, Invoice } from '../types';

export const BACKUP_FORMAT = 'merchmate-backup';
export const BACKUP_VERSION = 1;
/** No real backup is anywhere near this: it only stops a huge file from freezing the phone. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupData {
  businessProfile: BusinessProfile[];
  customers: Customer[];
  invoices: Invoice[];
  catalog: CatalogItem[];
}

export interface BackupSummary {
  exportedAt: Date;
  customers: number;
  invoices: number;
  hasProfile: boolean;
}

// JSON has no Date type: these fields are written as ISO strings and revived on restore.
const isoDate = z.union([z.string(), z.number(), z.date()])
  .transform(value => new Date(value))
  .refine(date => !Number.isNaN(date.getTime()), 'Invalid date');

// A backup is the one way untrusted data enters the app: anyone can send you a "backup", and a
// restore replaces everything. So every field the app reads is checked for its type here. A
// value of the wrong type would otherwise be stored and then crash the screens on every load.
const text = z.string();
const num = z.number().finite();
const currency = z.enum(['NGN', 'USD', 'GBP', 'EUR']);
// Logos are stored as data URLs. Anything else (a web address) would make the app, and the PDF
// engine, fetch that address, which lets a sender track you.
const imageDataUrl = z.string().regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*$/i, 'Logo must be an embedded image').max(4_000_000);

const customerSchema = z.object({
  id: text,
  name: text,
  phone: text,
  email: text.optional(),
  address: text.optional(),
  city: text.optional(),
  country: text.optional(),
  isInternational: z.boolean().optional(),
  createdAt: isoDate,
}).passthrough();

const itemSchema = z.object({ description: text, quantity: num, unitPrice: num, total: num.optional() }).passthrough();
const paymentSchema = z.object({ id: text, date: text, amount: num, note: text.optional(), unconfirmed: z.boolean().optional() }).passthrough();
const costSchema = z.object({ description: text, amount: num }).passthrough();
const planStepSchema = z.object({ label: text, percent: num, dueDate: isoDate.optional() }).passthrough();

const invoiceSchema = z.object({
  id: text,
  kind: z.enum(['invoice', 'quote']).optional(),
  customerId: text,
  invoiceNumber: text,
  items: z.array(itemSchema),
  subtotal: num.optional(),
  discount: num.optional(),
  discountRate: num.optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  tax: num.optional(),
  taxRate: num.optional(),
  taxLabel: text.optional(),
  grandTotal: num,
  depositAmount: num,
  payments: z.array(paymentSchema).optional(),
  currency,
  status: z.enum(['pending', 'partial', 'paid']),
  notes: text.optional(),
  convertedInvoiceId: text.optional(),
  costs: z.array(costSchema).optional(),
  paymentPlan: z.array(planStepSchema).optional(),
  orderStage: z.enum(['in_progress', 'ready', 'delivered']).optional(),
  isSynced: z.boolean().optional(),
  dateIssued: isoDate,
  dueDate: isoDate.optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate,
  lastReminderAt: isoDate.optional(),
  voidedAt: isoDate.optional(),
  deliveryDate: isoDate.optional(),
}).passthrough();

const businessProfileSchema = z.object({
  id: num.optional(),
  businessName: text,
  address: text.optional(),
  phone: text.optional(),
  email: text.optional(),
  ownerName: text.optional(),
  logoUrl: imageDataUrl.optional(),
  bankName: text.optional(),
  accountNumber: text.optional(),
  accountName: text.optional(),
  invoiceFooterText: text.optional(),
  taxLabel: text.optional(),
  defaultTaxRate: num.optional(),
  defaultDueDays: num.optional(),
  defaultCountryCode: text.optional(),
  brandColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Brand colour must look like #RRGGBB').optional(),
  invoiceTemplate: z.enum(['classic', 'modern']).optional(),
  dateFormat: z.enum(['dmy', 'mdy', 'ymd', 'long']).optional(),
}).passthrough();

const catalogSchema = z.object({
  id: text,
  name: text,
  unitPrice: num,
  currency,
  usageCount: num.optional(),
  updatedAt: isoDate,
}).passthrough();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION, 'This backup was made by a newer version of MerchMate. Update the app first.'),
  exportedAt: isoDate,
  data: z.object({
    businessProfile: z.array(businessProfileSchema),
    customers: z.array(customerSchema),
    invoices: z.array(invoiceSchema),
    catalog: z.array(catalogSchema).default([]), // absent in backups made before the catalog existed
  }),
});

export function serializeBackup(data: BackupData, now: Date = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data });
}

/** Parses and validates a backup file. Throws an Error with a user-readable message if it is not valid. */
export function parseBackup(fileText: string): { data: BackupData; summary: BackupSummary } {
  if (fileText.length > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a MerchMate backup.');
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch {
    throw new Error('This file is not a MerchMate backup (invalid JSON).');
  }

  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
    throw new Error(issue.path[0] === 'format'
      ? 'This file is not a MerchMate backup.'
      : `Backup file is damaged or incomplete: ${issue.message}${where}`);
  }

  const { data, exportedAt } = result.data;
  const invoices = data.invoices.map(inv => ({ ...inv, createdAt: inv.createdAt ?? inv.updatedAt })) as unknown as Invoice[];
  const backup: BackupData = {
    businessProfile: data.businessProfile as unknown as BusinessProfile[],
    customers: data.customers as unknown as Customer[],
    invoices,
    catalog: data.catalog as unknown as CatalogItem[],
  };

  return {
    data: backup,
    summary: {
      exportedAt,
      customers: backup.customers.length,
      invoices: backup.invoices.length,
      hasProfile: backup.businessProfile.length > 0,
    },
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `merchmate-backup-${now.toISOString().slice(0, 10)}.json`;
}
