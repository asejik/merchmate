import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
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
    <GlassCard className="p-6 md:p-8 mt-6 border-red-500/20">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Trash2 size={20} className="text-red-400" /> Erase All Data
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Deletes every client, invoice, quote and setting stored on this device, including App Lock. Use it before selling or giving away this phone, or to start again.
        There is no way to undo it except restoring a backup.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-medium">
          Erase everything on this device…
        </button>
      ) : (
        <form onSubmit={erase} className="space-y-4">
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {lastBackup ? `Your last backup from this device was on ${formatDate(lastBackup, 'long', { moment: true })}. Anything newer will be lost.` : 'You have not saved a backup from this device. Everything will be lost.'}
          </p>
          <button type="button" onClick={backUpFirst} className="min-h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium">Save a backup first</button>
          <div>
            <label htmlFor="erase-all-confirm" className="block text-xs font-medium text-slate-400 mb-1 uppercase">Type ERASE to confirm</label>
            <input
              id="erase-all-confirm"
              value={text}
              onChange={e => setText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-400"
            />
          </div>
          {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => { setOpen(false); setText(''); setMessage(''); }} className="flex-1 min-h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium">Cancel</button>
            <button type="submit" disabled={!ready || busy} className="flex-1 min-h-11 rounded-xl bg-red-700 hover:bg-red-600 text-white font-medium disabled:opacity-40">Erase everything</button>
          </div>
        </form>
      )}
    </GlassCard>
  );
}
