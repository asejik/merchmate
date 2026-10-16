import { db } from './index';
import { backupFileName, serializeBackup, type BackupData } from '../lib/backup';
import { isBackupDue as isDueOn, nextLocalMidnight, shouldRemindBackup } from '../lib/backupReminder';
import { shareOrDownload } from '../lib/share';
import { clearLock } from '../lib/appLock';
import { clearAllDrafts } from '../lib/drafts';

const LAST_BACKUP_KEY = 'lastBackupAt';
const SNOOZE_KEY = 'backupSnoozedUntil';

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

/**
 * Deletes everything on this device, including the app lock. The last resort when the PIN and the
 * recovery code are both lost: the data is gone, so restore it from a backup file afterwards.
 */
export async function eraseAllData(): Promise<void> {
  await db.transaction('rw', [db.businessProfile, db.customers, db.invoices, db.catalog], async () => {
    await Promise.all([db.businessProfile.clear(), db.customers.clear(), db.invoices.clear(), db.catalog.clear()]);
  });
  clearLock();
  clearAllDrafts();
  try {
    localStorage.removeItem(LAST_BACKUP_KEY);
  } catch {
    // storage unavailable: nothing to remove
  }
}

// Per-device reminder state only, so localStorage is fine; it is not part of the data.
function readDate(key: string): Date | null {
  try {
    const value = localStorage.getItem(key);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

function writeDate(key: string, date: Date): void {
  try {
    localStorage.setItem(key, date.toISOString());
  } catch {
    // Storage unavailable: the reminder will just show again
  }
}

export function getLastBackupAt(): Date | null {
  return readDate(LAST_BACKUP_KEY);
}

export function markBackedUp(now: Date = new Date()): void {
  writeDate(LAST_BACKUP_KEY, now);
}

/** No backup yet today. */
export function isBackupDue(now: Date = new Date()): boolean {
  return isDueOn(getLastBackupAt(), now);
}

/** Whether the dashboard should nag: due today and not snoozed with "Not today". */
export function isBackupReminderVisible(hasData: boolean, now: Date = new Date()): boolean {
  return shouldRemindBackup({ hasData, lastBackupAt: getLastBackupAt(), snoozedUntil: readDate(SNOOZE_KEY), now });
}

/** "Not today": hides the reminder until tomorrow. */
export function snoozeBackupReminder(now: Date = new Date()): void {
  writeDate(SNOOZE_KEY, nextLocalMidnight(now));
}

/**
 * Builds the backup file and hands it to the share sheet (or downloads it), then records the time.
 * Needs a recent tap to open the share sheet. Throws AbortError if the user cancels the sheet.
 */
export async function saveBackup(): Promise<{ invoices: number; customers: number }> {
  const data = await exportAllData();
  const now = new Date();
  const file = new File([serializeBackup(data, now)], backupFileName(now), { type: 'application/json' });
  await shareOrDownload(file, 'MerchMate backup', 'MerchMate backup file. Keep it somewhere safe.');
  markBackedUp(now);
  return { invoices: data.invoices.length, customers: data.customers.length };
}
