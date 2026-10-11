import { z } from 'zod';
import type { BusinessProfile, CatalogItem, Customer, Invoice } from '../types';

export const BACKUP_FORMAT = 'merchmate-backup';
export const BACKUP_VERSION = 1;

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

const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  createdAt: isoDate,
}).passthrough();

const invoiceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  invoiceNumber: z.string(),
  items: z.array(z.object({}).passthrough()),
  grandTotal: z.number(),
  depositAmount: z.number(),
  currency: z.string(),
  status: z.string(),
  dateIssued: isoDate,
  dueDate: isoDate.optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate,
  lastReminderAt: isoDate.optional(),
  deliveryDate: isoDate.optional(),
}).passthrough();

const catalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
  updatedAt: isoDate,
}).passthrough();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION, 'This backup was made by a newer version of MerchMate. Update the app first.'),
  exportedAt: isoDate,
  data: z.object({
    businessProfile: z.array(z.object({ businessName: z.string() }).passthrough()),
    customers: z.array(customerSchema),
    invoices: z.array(invoiceSchema),
    catalog: z.array(catalogSchema).default([]), // absent in backups made before the catalog existed
  }),
});

export function serializeBackup(data: BackupData, now: Date = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data });
}

/** Parses and validates a backup file. Throws an Error with a user-readable message if it is not valid. */
export function parseBackup(text: string): { data: BackupData; summary: BackupSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
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
