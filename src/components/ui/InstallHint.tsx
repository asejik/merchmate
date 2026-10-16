import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { currentPlatform, IOS_INSTALL_STEPS, shouldSuggestInstall } from '../../lib/platform';

const DISMISSED_KEY = 'installHintDismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** On iPhone/iPad browsers, explains why installing matters: Safari erases data of sites that are not installed. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed || !shouldSuggestInstall(currentPlatform())) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // It will just show again next time
    }
  };

  return (
    <div role="note" className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4 flex items-start gap-3">
      <Smartphone size={20} className="text-indigo-300 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-white">Add MerchMate to your Home Screen to keep your data safe</p>
        <p className="mt-1 text-xs text-slate-300">On iPhone, Safari can erase the data of websites you have not installed. {IOS_INSTALL_STEPS.map((step, i) => `${i + 1}. ${step}.`).join(' ')}</p>
      </div>
      <button onClick={dismiss} className="p-1 text-slate-400 hover:text-white" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
