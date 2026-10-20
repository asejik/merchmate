import { useState } from 'react';
import { Bug, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { db } from '../../db';
import { getLastBackupAt } from '../../db/backup';
import { buildReport, clearErrors, readErrors, reportFileName } from '../../lib/diagnostics';
import { currentPlatform } from '../../lib/platform';
import { getPersistence } from '../../lib/storage';
import { isQuote } from '../../lib/invoice';
import { shareOrDownload } from '../../lib/share';

export function ProblemReportCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const [docs, clients, persisted] = await Promise.all([db.invoices.toArray(), db.customers.count(), getPersistence()]);
      const quotes = docs.filter(isQuote).length;
      const now = new Date();
      const text = buildReport({
        now,
        build: __BUILD__,
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
        installed: currentPlatform().standalone,
        persisted,
        dbVersion: db.verno,
        counts: { clients, invoices: docs.length - quotes, quotes },
        lastBackupAt: getLastBackupAt(),
        errors: readErrors(),
      });
      await shareOrDownload(new File([text], reportFileName(now), { type: 'text/plain' }), 'MerchMate problem report', 'MerchMate problem report. No client or money details inside.');
      clearErrors();
      setMessage({ kind: 'ok', text: 'Report ready. Send it to whoever supports you.' });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        setMessage({ kind: 'error', text: "Couldn't create the report. Please try again, or email info@asejik.com and describe what happened." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
        <Bug size={20} className="text-primary" /> Report a Problem
      </h2>
      <p className="text-xs text-muted mb-4">
        Something not working? This makes a small text file about your phone, the app version and recent errors, which you can send on WhatsApp.
        It has no client names, phone numbers, amounts or bank details, and nothing is sent unless you choose to share it.
      </p>
      <button
        type="button"
        onClick={handleSend}
        disabled={busy}
        className="flex items-center justify-center gap-2 bg-sunken hover:bg-primary-tint text-ink px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Bug size={18} />}
        Create Problem Report
      </button>
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
      )}
    </Card>
  );
}
