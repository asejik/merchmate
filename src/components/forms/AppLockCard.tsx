import { useState } from 'react';
import { DatabaseBackup, Lock, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PinField } from '../ui/PinField';
import { RecoveryCodePanel } from '../ui/RecoveryCodePanel';
import { saveBackup } from '../../db/backup';
import { changePin, disableLock, enableLock, failureMessage, isLockEnabled, isValidPin } from '../../lib/appLock';

type Mode = 'idle' | 'enable' | 'show-code' | 'backup-nudge' | 'change' | 'disable';

const primary = 'flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40';
const secondary = 'flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40';

export function AppLockCard({ onLockNow }: { onLockNow?: () => void }) {
  const [enabled, setEnabled] = useState(isLockEnabled);
  const [mode, setMode] = useState<Mode>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = (to: Mode = 'idle') => { setMode(to); setCurrent(''); setNext(''); setConfirm(''); setMessage(null); };
  const mismatch = next !== '' && confirm !== '' && next !== confirm;
  const newPinReady = isValidPin(next) && next === confirm;

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinReady) return;
    setBusy(true);
    try {
      const result = await enableLock(next);
      if (!result.ok) { setMessage({ kind: 'error', text: failureMessage(result) }); return; }
      setCode(result.recoveryCode);
      reset('show-code');
      setEnabled(true);
    } catch (error) {
      console.error(error);
      setMessage({ kind: 'error', text: 'Could not turn the lock on. This browser may be blocking storage.' });
    } finally {
      setBusy(false);
    }
  };

  const backUpNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveBackup();
      setMessage({ kind: 'ok', text: `Backup saved: ${saved.invoices} invoices, ${saved.customers} clients.` });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setMessage({ kind: 'error', text: 'Could not create the backup. You can try again from Backup & Restore above.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinReady) return;
    setBusy(true);
    const result = await changePin(current, next);
    setBusy(false);
    if (!result.ok) { setMessage({ kind: 'error', text: failureMessage(result) }); return; }
    reset();
    setMessage({ kind: 'ok', text: 'PIN changed. Your recovery code is still the same.' });
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await disableLock(current);
    setBusy(false);
    if (!result.ok) { setMessage({ kind: 'error', text: failureMessage(result) }); return; }
    setEnabled(false);
    reset();
    setMessage({ kind: 'ok', text: 'App Lock is off.' });
  };

  return (
    <GlassCard className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Lock size={20} className="text-indigo-400" /> App Lock
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Ask for a PIN when MerchMate opens and after it has been in the background for a minute. It keeps casual snoopers out of your clients and bank details.
        It does not encrypt your data, so keep your phone's own lock on too.
      </p>

      {mode === 'idle' && !enabled && (
        <button type="button" onClick={() => reset('enable')} className={`${primary} w-full`}>Turn on App Lock</button>
      )}

      {mode === 'idle' && enabled && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-green-400"><ShieldCheck size={16} /> App Lock is on</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {onLockNow && <button type="button" onClick={onLockNow} className={primary}>Lock now</button>}
            <button type="button" onClick={() => reset('change')} className={secondary}>Change PIN</button>
            <button type="button" onClick={() => reset('disable')} className={secondary}>Turn off</button>
          </div>
        </div>
      )}

      {mode === 'enable' && (
        <form onSubmit={handleEnable} className="space-y-4">
          <PinField label="Choose a PIN (4 to 8 digits)" value={next} onChange={setNext} autoFocus />
          <PinField label="Repeat the PIN" value={confirm} onChange={setConfirm} />
          {mismatch && <p role="alert" className="text-sm text-amber-300">The two PINs are different.</p>}
          <p className="text-xs text-slate-400">Next you will get a recovery code. It is the only way back in if you forget the PIN, apart from erasing this device and restoring a backup.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => reset()} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy || !newPinReady} className={primary}>Turn on</button>
          </div>
        </form>
      )}

      {mode === 'show-code' && <RecoveryCodePanel code={code} onDone={() => { setCode(''); reset('backup-nudge'); }} />}

      {mode === 'backup-nudge' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><DatabaseBackup size={18} className="text-orange-300" /> Back up your data now</h3>
          <p className="text-sm text-slate-300">
            App Lock is on. If you ever lose both your PIN and your recovery code, the only way back is to erase this device and restore a backup, so a recent one matters.
            Save one now, and again each day you use the app (we will remind you).
          </p>
          {message && <p role="status" className={`text-sm ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => reset()} className={secondary}>{message?.kind === 'ok' ? 'Done' : 'Later'}</button>
            {message?.kind !== 'ok' && <button type="button" onClick={backUpNow} disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save backup now'}</button>}
          </div>
        </div>
      )}

      {mode === 'change' && (
        <form onSubmit={handleChange} className="space-y-4">
          <PinField label="Current PIN" value={current} onChange={setCurrent} autoFocus />
          <PinField label="New PIN (4 to 8 digits)" value={next} onChange={setNext} />
          <PinField label="Repeat the new PIN" value={confirm} onChange={setConfirm} />
          {mismatch && <p role="alert" className="text-sm text-amber-300">The two PINs are different.</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => reset()} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy || !newPinReady || current.length < 4} className={primary}>Change PIN</button>
          </div>
        </form>
      )}

      {mode === 'disable' && (
        <form onSubmit={handleDisable} className="space-y-4">
          <PinField label="Enter your PIN to turn the lock off" value={current} onChange={setCurrent} autoFocus />
          <div className="flex gap-3">
            <button type="button" onClick={() => reset()} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy || current.length < 4} className={primary}>Turn off</button>
          </div>
        </form>
      )}

      {message && mode !== 'show-code' && mode !== 'backup-nudge' && (
        <p role="status" className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
      )}
    </GlassCard>
  );
}
