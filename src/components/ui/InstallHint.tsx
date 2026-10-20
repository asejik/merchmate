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
    <div role="note" className="rounded-2xl border border-line bg-primary-tint p-4 flex items-start gap-3">
      <Smartphone size={20} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-ink">Add MerchMate to your Home Screen to keep your data safe</p>
        <p className="mt-1 text-xs text-muted">On iPhone, Safari can erase the data of websites you have not installed. {IOS_INSTALL_STEPS.map((step, i) => `${i + 1}. ${step}.`).join(' ')}</p>
      </div>
      <button onClick={dismiss} className="inline-flex items-center justify-center min-h-11 min-w-11 -mt-2 -mr-2 rounded-xl text-muted hover:bg-sunken hover:text-ink" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
