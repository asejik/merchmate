import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { eraseAllData, getLastBackupAt, saveBackup } from '../../db/backup';
import { formatDate } from '../../lib/dates';
import { failed } from '../../lib/messages';

/** Deletes everything on this device. Typing ERASE guards against a stray tap. */
export function EraseDataCard() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lastBackup = getLastBackupAt();
  const ready = text.trim().toUpperCase() === 'ERASE';

  const backUpFirst = async () => {
    setMessage('');
    try {
      await saveBackup();
      setMessage('Backup saved. Keep that file somewhere safe before you erase.');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setMessage(failed('create the backup'));
      }
    }
  };

  const erase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await eraseAllData();
      window.location.reload(); // start clean: nothing from the erased data stays on screen
    } catch (error) {
      console.error(error);
      setMessage(failed('erase the data'));
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 md:p-8 mt-6 border-danger/30">
      <h2 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
        <Trash2 size={20} className="text-danger" /> Erase All Data
      </h2>
      <p className="text-xs text-muted mb-4">
        Deletes every client, invoice, quote and setting stored on this device, including App Lock. Use it before selling or giving away this phone, or to start again.
        There is no way to undo it except restoring a backup.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-xl bg-danger-tint hover:bg-danger-tint text-danger text-sm font-medium">
          Erase everything on this device…
        </button>
      ) : (
        <form onSubmit={erase} className="space-y-4">
          <p className="rounded-lg border border-danger/30 bg-danger-tint p-3 text-sm text-danger">
            {lastBackup ? `Your last backup from this device was on ${formatDate(lastBackup, 'long', { moment: true })}. Anything newer will be lost.` : 'You have not saved a backup from this device. Everything will be lost.'}
          </p>
          <button type="button" onClick={backUpFirst} className="min-h-11 px-4 rounded-xl bg-sunken hover:bg-primary-tint text-ink text-sm font-medium">Save a backup first</button>
          <div>
            <label htmlFor="erase-all-confirm" className="block text-xs font-medium text-muted mb-1">Type ERASE to confirm</label>
            <input
              id="erase-all-confirm"
              value={text}
              onChange={e => setText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full min-h-11 rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink focus:outline-none focus:border-danger"
            />
          </div>
          {message && <p role="status" className="text-sm text-muted">{message}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => { setOpen(false); setText(''); setMessage(''); }} className="flex-1 min-h-11 rounded-xl bg-sunken hover:bg-primary-tint text-ink font-medium">Cancel</button>
            <button type="submit" disabled={!ready || busy} className="flex-1 min-h-11 rounded-xl bg-danger hover:opacity-90 text-on-primary font-medium disabled:opacity-40">Erase everything</button>
          </div>
        </form>
      )}
    </Card>
  );
}
