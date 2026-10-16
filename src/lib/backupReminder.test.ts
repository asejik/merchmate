import { describe, expect, it } from 'vitest';
import { isBackupDue, isSnoozed, nextLocalMidnight, shouldRemindBackup } from './backupReminder';

// Local-time dates on purpose: "today" means the user's calendar day, wherever they are
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute);

describe('isBackupDue (once per local day)', () => {
  it('is due when no backup was ever made', () => {
    expect(isBackupDue(null, at(16))).toBe(true);
  });

  it('is not due after a backup earlier the same day', () => {
    expect(isBackupDue(at(16, 7), at(16, 22))).toBe(false);
    expect(isBackupDue(at(16, 0, 0), at(16, 23, 59))).toBe(false);
  });

  it('is due again the next morning, even a minute after midnight', () => {
    expect(isBackupDue(at(16, 23, 59), at(17, 0, 1))).toBe(true);
    expect(isBackupDue(at(16, 21), at(17, 8))).toBe(true);
  });

  it('stays due while days pass without a backup', () => {
    expect(isBackupDue(at(10), at(16))).toBe(true);
  });
});

describe('"Not today"', () => {
  it('lasts until the start of the next local day', () => {
    const until = nextLocalMidnight(at(16, 15));
    expect(until).toEqual(new Date(2026, 9, 17, 0, 0));
    expect(isSnoozed(until, at(16, 23, 59))).toBe(true);
    expect(isSnoozed(until, at(17, 0, 0))).toBe(false);
  });

  it('rolls over month ends', () => {
    expect(nextLocalMidnight(new Date(2026, 9, 31, 20))).toEqual(new Date(2026, 10, 1));
  });

  it('ignores a missing or damaged value', () => {
    expect(isSnoozed(null, at(16))).toBe(false);
    expect(isSnoozed(new Date('garbage'), at(16))).toBe(false);
  });
});

describe('shouldRemindBackup', () => {
  const base = { hasData: true, lastBackupAt: at(15), snoozedUntil: null as Date | null, now: at(16) };

  it('reminds when there is data and no backup today', () => {
    expect(shouldRemindBackup(base)).toBe(true);
  });

  it('stays quiet with nothing to back up, after a backup today, or while snoozed', () => {
    expect(shouldRemindBackup({ ...base, hasData: false })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastBackupAt: at(16, 8) })).toBe(false);
    expect(shouldRemindBackup({ ...base, snoozedUntil: nextLocalMidnight(at(16)) })).toBe(false);
  });

  it('comes back the next day after "Not today"', () => {
    const snoozedUntil = nextLocalMidnight(at(16));
    expect(shouldRemindBackup({ ...base, snoozedUntil, now: at(17, 9) })).toBe(true);
  });
});
