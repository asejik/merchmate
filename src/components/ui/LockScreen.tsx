import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { PinField } from './PinField';
import { RecoveryCodePanel } from './RecoveryCodePanel';
import { failureMessage, formatWait, lockoutRemainingMs, resetPinWithRecovery, verifyPin } from '../../lib/appLock';
import { eraseAllData, getLastBackupAt } from '../../db/backup';
import { formatDate } from '../../lib/dates';

interface LockScreenProps {
  /** `erased` is true when the device was wiped, so the app can point the user at Restore. */
  onUnlock: (erased: boolean) => void;
}

type Mode = 'pin' | 'recover' | 'new-code' | 'erase';

const buttonClass = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40';
const linkClass = 'text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2';

/** Shown instead of the app while it is locked. It deliberately shows nothing about the business. */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(() => Date.now() + lockoutRemainingMs());
  const [now, setNow] = useState(() => Date.now());
  const waitMs = Math.max(0, retryAt - now);
  const lastBackup = getLastBackupAt();

  // Ticks the "try again in" countdown while a wait is running
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);

  const noteWait = (retryInMs: number) => {
    if (retryInMs > 0) { setRetryAt(Date.now() + retryInMs); setNow(Date.now()); }
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || waitMs > 0 || !pin) return;
    setBusy(true);
    const result = await verifyPin(pin);
    setBusy(false);
    setPin('');
    if (result.ok) { onUnlock(false); return; }
    noteWait(result.retryInMs);
    setMessage(failureMessage(result));
  };

  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || waitMs > 0) return;
    setBusy(true);
    const result = await resetPinWithRecovery(code, newPin);
    setBusy(false);
    if (result.ok) {
      setNewCode(result.recoveryCode);
      setCode(''); setNewPin(''); setMessage('');
      setMode('new-code');
      return;
    }
    noteWait(result.retryInMs);
    setMessage(failureMessage(result, result.reason === 'invalid' && newPin.length < 4 ? 'PIN' : 'recovery code'));
  };

  const erase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || confirmText.trim().toUpperCase() !== 'ERASE') return;
    setBusy(true);
    try {
      await eraseAllData();
      onUnlock(true);
    } catch (error) {
      console.error(error);
      setMessage('Could not erase this device. Close other MerchMate tabs and try again.');
      setBusy(false);
    }
  };

  const go = (next: Mode) => { setMode(next); setMessage(''); setPin(''); setCode(''); setNewPin(''); setConfirmText(''); };
  const waiting = waitMs > 0 ? `Too many wrong tries. Try again in ${formatWait(waitMs)}.` : message;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        {mode === 'pin' && (
          <form onSubmit={unlock} className="space-y-4">
            <div className="text-center space-y-2">
              <Lock className="mx-auto text-indigo-300" size={32} />
              <h1 className="text-xl font-bold text-white">MerchMate is locked</h1>
            </div>
            <PinField label="PIN" value={pin} onChange={setPin} autoFocus />
            {waiting && <p role="alert" className="text-sm text-amber-300">{waiting}</p>}
            <button type="submit" disabled={busy || waitMs > 0 || pin.length < 4} className={buttonClass}>Unlock</button>
            <p className="text-center"><button type="button" onClick={() => go('recover')} className={linkClass}>Forgot PIN?</button></p>
          </form>
        )}

        {mode === 'recover' && (
          <form onSubmit={recover} className="space-y-4">
            <h1 className="text-lg font-bold text-white">Reset with your recovery code</h1>
            <div>
              <label htmlFor="recovery-code" className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Recovery code</label>
              <input
                id="recovery-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center font-mono tracking-widest focus:outline-none focus:border-indigo-500"
              />
            </div>
            <PinField label="New PIN (4 to 8 digits)" value={newPin} onChange={setNewPin} />
            {waiting && <p role="alert" className="text-sm text-amber-300">{waiting}</p>}
            <button type="submit" disabled={busy || waitMs > 0 || code.trim().length < 12 || newPin.length < 4} className={buttonClass}>Set new PIN</button>
            <div className="flex justify-between">
              <button type="button" onClick={() => go('pin')} className={linkClass}>Back</button>
              <button type="button" onClick={() => go('erase')} className={linkClass}>I lost my code</button>
            </div>
          </form>
        )}

        {mode === 'new-code' && <RecoveryCodePanel code={newCode} onDone={() => onUnlock(false)} headingLevel={1} />}

        {mode === 'erase' && (
          <form onSubmit={erase} className="space-y-4">
            <h1 className="text-lg font-bold text-white">Erase this device</h1>
            <p className="text-sm text-slate-300">
              Without the PIN or the recovery code there is no way in. You can erase everything MerchMate stores on this device and start fresh, then restore your latest backup file from Settings.
            </p>
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              This deletes all clients, invoices and settings on this device. It cannot be undone. Anything not in a backup is lost.
              {' '}{lastBackup ? `The last backup saved from this device was on ${formatDate(lastBackup, 'long', { moment: true })}. Anything newer will be lost.` : 'No backup has been saved from this device, so nothing can be restored afterwards.'}
            </p>
            <div>
              <label htmlFor="erase-confirm" className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Type ERASE to confirm</label>
              <input
                id="erase-confirm"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:border-red-400"
              />
            </div>
            {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
            <button type="submit" disabled={busy || confirmText.trim().toUpperCase() !== 'ERASE'} className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40">
              Erase this device
            </button>
            <p className="text-center"><button type="button" onClick={() => go('recover')} className={linkClass}>Back</button></p>
          </form>
        )}
      </div>
    </main>
  );
}
