import Dexie, { type Table } from 'dexie';
import type { BusinessProfile, Customer, Invoice } from '../types';
import { backfillCreatedAt } from '../lib/invoice';

class InvoiceDatabase extends Dexie {
  // Declare implicit table properties.
  // (We don't instantiate them here, Dexie does that for us)
  businessProfile!: Table<BusinessProfile>;
  customers!: Table<Customer>;
  invoices!: Table<Invoice>;

  constructor() {
    // Legacy name kept on purpose: renaming it would orphan existing users' data.
    super('AsoOkeInvoiceDB');

    // Define the schema
    // ++id means auto-incrementing primary key
    // &id means unique primary key
    this.version(1).stores({
      businessProfile: '++id',
      customers: '&id, name, phone',
      invoices: '&id, customerId, status, dateIssued, isSynced'
    });

    // v2 (additive): index createdAt for newest-first lists and invoiceNumber for numbering.
    // Invoices saved before v2 never had createdAt, so backfill it.
    this.version(2).stores({
      invoices: '&id, customerId, status, dateIssued, isSynced, createdAt, invoiceNumber'
    }).upgrade(tx =>
      tx.table('invoices').toCollection().modify(backfillCreatedAt)
    );
  }
}

export const db = new InvoiceDatabase();
