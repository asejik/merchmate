// Daily backup reminder. Everything lives on this device, so a recent backup is the only safety net
// (lost phone, cleared browser, forgotten App Lock PIN). Days are the user's local calendar days.

const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** True until a backup has been saved on the current local day. */
export function isBackupDue(lastBackupAt: Date | null, now: Date = new Date()): boolean {
  return !lastBackupAt || localDay(lastBackupAt) < localDay(now);
}

/** Midnight at the start of the next local day: when "Not today" stops applying. */
export function nextLocalMidnight(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function isSnoozed(snoozedUntil: Date | null, now: Date = new Date()): boolean {
  return !!snoozedUntil && !Number.isNaN(snoozedUntil.getTime()) && now.getTime() < snoozedUntil.getTime();
}

/** Whether to show the reminder banner. Nothing to back up yet means nothing to remind about. */
export function shouldRemindBackup(input: { hasData: boolean; lastBackupAt: Date | null; snoozedUntil: Date | null; now?: Date }): boolean {
  const now = input.now ?? new Date();
  return input.hasData && isBackupDue(input.lastBackupAt, now) && !isSnoozed(input.snoozedUntil, now);
}
