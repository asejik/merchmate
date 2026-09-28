import { db } from './index';
import type { BackupData } from '../lib/backup';

const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_REMINDER_DAYS = 14;

export async function exportAllData(): Promise<BackupData> {
  const [businessProfile, customers, invoices, catalog] = await Promise.all([
    db.businessProfile.toArray(),
    db.customers.toArray(),
    db.invoices.toArray(),
    db.catalog.toArray(),
  ]);
  return { businessProfile, customers, invoices, catalog };
}

/** Replaces everything on this device with the backup, atomically: on any error nothing changes. */
export async function restoreAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.businessProfile, db.customers, db.invoices, db.catalog], async () => {
    await Promise.all([db.businessProfile.clear(), db.customers.clear(), db.invoices.clear(), db.catalog.clear()]);
    await db.businessProfile.bulkPut(data.businessProfile);
    await db.customers.bulkPut(data.customers);
    await db.invoices.bulkPut(data.invoices);
    await db.catalog.bulkPut(data.catalog);
  });
}

// Per-device reminder only, so localStorage is fine; it is not part of the data.
export function getLastBackupAt(): Date | null {
  try {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

export function markBackedUp(now: Date = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
  } catch {
    // Storage unavailable: the reminder will just show again
  }
}

export function isBackupDue(now: Date = new Date()): boolean {
  const last = getLastBackupAt();
  return !last || now.getTime() - last.getTime() > BACKUP_REMINDER_DAYS * 86_400_000;
}
