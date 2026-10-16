import { useRef, useState } from 'react';
import { formatDate } from '../../lib/dates';
import { DatabaseBackup, Download, Upload, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useDialogs } from '../ui/dialogContext';
import { exportAllData, getLastBackupAt, isBackupDue, restoreAllData, saveBackup } from '../../db/backup';
import { MAX_BACKUP_BYTES, parseBackup } from '../../lib/backup';
import { failed } from '../../lib/messages';

export function BackupCard() {
  const { confirm } = useDialogs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [lastBackup, setLastBackup] = useState(getLastBackupAt);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const due = isBackupDue();

  const handleExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const saved = await saveBackup();
      setLastBackup(getLastBackupAt());
      setMessage({ kind: 'ok', text: `Backup saved: ${saved.invoices} invoices, ${saved.customers} clients.` });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setMessage({ kind: 'error', text: failed('create the backup') });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;

    setMessage(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ kind: 'error', text: 'This file is too large to be a MerchMate backup.' });
      return;
    }
    let parsed: ReturnType<typeof parseBackup>;
    try {
      parsed = parseBackup(await file.text());
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
      return;
    }

    const { summary } = parsed;
    const current = await exportAllData();
    const ok = await confirm({
      title: 'Restore this backup?',
      message:
        `Backup from ${summary.exportedAt.toLocaleString()}, with ${summary.invoices} invoices and ${summary.customers} clients.\n\n` +
        `This REPLACES everything on this device (currently ${current.invoices.length} invoices and ${current.customers.length} clients). ` +
        `If unsure, cancel and save a backup first.`,
      confirmLabel: 'Replace everything',
      danger: true,
    });
    if (!ok) return;

    setBusy('import');
    try {
      await restoreAllData(parsed.data);
      setMessage({ kind: 'ok', text: `Restored ${summary.invoices} invoices and ${summary.customers} clients.` });
    } catch (error) {
      console.error(error);
      setMessage({ kind: 'error', text: 'Restore failed. Your existing data was not changed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <DatabaseBackup size={20} className="text-indigo-400" /> Backup & Restore
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Your data is stored only on this device. Clearing browser data or losing your phone deletes it.
        Save a backup to Google Drive, email or WhatsApp every day you use the app. You can also use it to move to a new phone.
      </p>

      <div className={`mb-4 flex items-center gap-2 text-xs ${due ? 'text-orange-300' : 'text-green-400'}`}>
        {due ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        {lastBackup ? `Last backup on this device: ${formatDate(lastBackup, 'long', { moment: true })}` : 'No backup made on this device yet'}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
        >
          {busy === 'export' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          Save Backup
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
        >
          {busy === 'import' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Restore from File
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
      </div>

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
      )}
    </GlassCard>
  );
}
