import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

interface RecoveryCodePanelProps {
  code: string;
  onDone: () => void;
  /** 1 when it is the whole screen (lock screen), 3 inside a settings card. */
  headingLevel?: 1 | 3;
}

/** Shows the recovery code once. Nobody, including us, can show it again: only a new one can be made. */
export function RecoveryCodePanel({ code, onDone, headingLevel = 3 }: RecoveryCodePanelProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h3';
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
      <Heading className="text-lg font-bold text-ink flex items-center gap-2"><KeyRound size={20} className="text-warning" /> Your recovery code</Heading>
      <p className="text-sm text-muted">
        If you forget your PIN, this code is the only way back in without erasing your data. It will <strong>not be shown again</strong>.
        Write it down or keep it in a password manager, somewhere other people cannot find it.
      </p>
      <p className="select-all rounded-xl border border-line bg-warning-tint py-4 text-center font-mono text-2xl font-bold tracking-widest text-warning">{code}</p>
      <button type="button" onClick={copy} className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover">
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy code'}
      </button>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-1" />
        I have saved my recovery code
      </label>
      <button
        type="button"
        onClick={onDone}
        disabled={!saved}
        className="w-full bg-primary hover:bg-primary-hover text-on-primary px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
