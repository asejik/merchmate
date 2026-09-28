export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';
export type DiscountType = 'percentage' | 'fixed';
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'partial';

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
}

export interface Customer {
  id?: string; // UUID
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
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
  customerId: string;
  invoiceNumber: string; // e.g., INV-0001
  items: InvoiceItem[];

  // Financials
  subtotal: number;
  discount: number;
  discountRate?: number;
  discountType?: DiscountType;
  tax: number;
  grandTotal: number;
  depositAmount: number; // Running total of all payments received, not just the first deposit
  payments?: PaymentRecord[];

  // Meta
  currency: CurrencyCode;
  status: InvoiceStatus;
  dateIssued: Date;
  dueDate?: Date;
  notes?: string;

  // Sync Status (Critical for Offline Mode)
  isSynced: boolean;
  createdAt: Date; // Backfilled for pre-v2 invoices by the Dexie upgrade
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string; // Optional: e.g., "Bank Transfer", "Cash"
}
export type AppTab = 'dashboard' | 'invoices' | 'create' | 'customers' | 'settings';
