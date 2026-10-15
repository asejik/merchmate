export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';
export type DiscountType = 'percentage' | 'fixed';
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'partial';
export type DocumentKind = 'invoice' | 'quote';
export type InvoiceTemplate = 'classic' | 'modern';
export type DateFormat = 'dmy' | 'mdy' | 'ymd' | 'long';
export type OrderStage = 'in_progress' | 'ready' | 'delivered';

export interface BusinessProfile {
  id?: number; // Dexie uses auto-incrementing numbers by default
  businessName: string;
  address: string;
  phone: string;
  email?: string;
  logoUrl?: string; // We will store the Blob URL here temporarily
  ownerName?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  invoiceFooterText?: string;
  // Invoice defaults
  taxLabel?: string; // e.g. "VAT"
  defaultTaxRate?: number; // percent
  defaultDueDays?: number; // payment terms; 0 = due on receipt
  defaultCountryCode?: string; // for WhatsApp links from local numbers, e.g. "234"
  // PDF branding
  brandColor?: string; // "#RRGGBB"
  invoiceTemplate?: InvoiceTemplate;
  dateFormat?: DateFormat; // undefined = day first (dmy)
}

export interface Customer {
  id?: string; // UUID
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  isInternational?: boolean; // UI toggle for the address fields
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id?: string; // UUID
  kind?: DocumentKind; // undefined = invoice (records saved before quotes existed)
  convertedInvoiceId?: string; // quotes only: the invoice created from this quote
  customerId: string;
  invoiceNumber: string; // e.g., INV-0001
  items: InvoiceItem[];

  // Financials
  subtotal: number;
  discount: number;
  discountRate?: number;
  discountType?: DiscountType;
  tax: number; // Tax amount, applied after discount
  taxRate?: number; // percent
  taxLabel?: string;
  grandTotal: number;
  depositAmount: number; // Running total of all payments received, not just the first deposit
  payments?: PaymentRecord[];

  // Meta
  currency: CurrencyCode;
  status: InvoiceStatus;
  dateIssued: Date;
  dueDate?: Date; // for quotes: valid until
  notes?: string;
  lastReminderAt?: Date;

  // Private job costs (materials, labour, transport). Never shown to the client.
  costs?: JobCost[];

  // Optional instalments, e.g. 50% now, 30% at fitting, 20% on collection
  paymentPlan?: PlanInstallment[];

  // Order tracking (invoices only). undefined = not tracked (saved before order tracking existed)
  orderStage?: OrderStage;
  deliveryDate?: Date; // promised delivery / pickup day

  // Sync Status (Critical for Offline Mode)
  isSynced: boolean;
  createdAt: Date; // Backfilled for pre-v2 invoices by the Dexie upgrade
  updatedAt: Date;
}

export interface JobCost {
  id: string;
  description: string;
  amount: number;
}

/** One stage of a payment plan. Stored as a percentage so it follows edits to the total. */
export interface PlanInstallment {
  id: string;
  label: string; // e.g. "Deposit", "At fitting"
  percent: number;
  dueDate?: Date; // none = no fixed date (e.g. "on collection")
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string; // Optional: e.g., "Bank Transfer", "Cash"
  // Transfer not yet seen in the bank account (guards against fake alerts).
  // Excluded from depositAmount, totals and receipts until confirmed.
  unconfirmed?: boolean;
}
export type AppTab = 'dashboard' | 'invoices' | 'create' | 'customers' | 'settings';
export type ListView = 'invoices' | 'quotes';

/** Remembered line item, learned from saved invoices and quotes. */
export interface CatalogItem {
  id: string;
  name: string;
  unitPrice: number;
  currency: CurrencyCode;
  usageCount: number;
  updatedAt: Date;
}
