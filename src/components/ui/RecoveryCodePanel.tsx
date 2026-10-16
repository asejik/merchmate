import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

interface RecoveryCodePanelProps {
  code: string;
  onDone: () => void;
}

/** Shows the recovery code once. Nobody, including us, can show it again: only a new one can be made. */
export function RecoveryCodePanel({ code, onDone }: RecoveryCodePanelProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // the code is on screen: it can still be written down
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2"><KeyRound size={20} className="text-amber-300" /> Your recovery code</h2>
      <p className="text-sm text-slate-300">
        If you forget your PIN, this code is the only way back in without erasing your data. It will <strong>not be shown again</strong>.
        Write it down or keep it in a password manager, somewhere other people cannot find it.
      </p>
      <p className="select-all rounded-xl border border-amber-400/30 bg-amber-500/10 py-4 text-center font-mono text-2xl font-bold tracking-widest text-amber-100">{code}</p>
      <button type="button" onClick={copy} className="flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200">
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy code'}
      </button>
      <label className="flex items-start gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-1" />
        I have saved my recovery code
      </label>
      <button
        type="button"
        onClick={onDone}
        disabled={!saved}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
