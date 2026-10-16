import { useReducer, useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { getLastBackupAt, isBackupReminderVisible, saveBackup, snoozeBackupReminder } from '../../db/backup';
import { isLockEnabled } from '../../lib/appLock';
import { formatDate } from '../../lib/dates';

/** Daily nudge on the dashboard until a backup has been saved today. "Not today" hides it until tomorrow. */
export function BackupReminder({ hasData }: { hasData: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Whether to show is read from storage on every render (the data may only arrive after the first
  // one); this forces a render after saving or snoozing, which change storage but not React state
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  if (!isBackupReminderVisible(hasData)) return null;

  const backUp = async () => {
    setBusy(true);
    setError('');
    try {
      await saveBackup();
      refresh();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error(e);
        setError('Could not create the backup. Try again from Settings.');
      }
    } finally {
      setBusy(false);
    }
  };

  const notToday = () => {
    snoozeBackupReminder();
    refresh();
  };

  const last = getLastBackupAt();
  return (
    <div role="region" aria-label="Backup reminder" className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <DatabaseBackup size={20} className="text-orange-300 shrink-0 mt-0.5" />
        <div className="text-sm text-orange-100 space-y-1">
          <p><strong>Back up your data today.</strong> Everything is stored only on this device. {last ? `Your last backup was on ${formatDate(last, 'long', { moment: true })}.` : 'You have not saved a backup yet.'}</p>
          {isLockEnabled() && <p className="text-orange-200/80">App Lock is on: a recent backup is your safety net if you forget both your PIN and your recovery code.</p>}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-3">
        <button onClick={backUp} disabled={busy} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-slate-950 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Back up now
        </button>
        <button onClick={notToday} disabled={busy} className="px-4 py-2.5 rounded-xl text-sm text-orange-100 hover:bg-white/10">Not today</button>
      </div>
    </div>
  );
}
