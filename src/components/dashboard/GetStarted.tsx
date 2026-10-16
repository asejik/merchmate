import { useState } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { getSetupSteps, nextSetupStep, type SetupState, type SetupStepId } from '../../lib/onboarding';
import type { AppTab } from '../../types';

const DISMISSED_KEY = 'setupGuideDismissed';
const DESTINATION: Record<SetupStepId, AppTab> = { business: 'settings', client: 'customers', invoice: 'create' };

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Shown to a new user until business details, a client and a first invoice exist. */
export function GetStarted({ state, onNavigate }: { state: SetupState; onNavigate: (tab: AppTab) => void }) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const steps = getSetupSteps(state);
  const next = nextSetupStep(steps);
  if (dismissed || !next) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // It will just show again next time
    }
  };

  return (
    <GlassCard className="p-5" role="region" aria-label="Get started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Welcome to MerchMate</h2>
          <p className="text-sm text-slate-400 mt-1">Three quick steps and you can send your first invoice.</p>
        </div>
        <button onClick={dismiss} className="inline-flex items-center justify-center min-h-11 min-w-11 -mt-2 -mr-2 rounded-lg text-slate-500 hover:text-white" aria-label="Hide the getting started guide">
          <X size={16} />
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map(step => (
          <li key={step.id} className="flex items-start gap-3">
            {step.done
              ? <Check size={20} className="text-green-400 mt-0.5 shrink-0" aria-label="Done" />
              : <Circle size={20} className="text-slate-600 mt-0.5 shrink-0" aria-hidden="true" />}
            <div className="flex-1">
              <p className={step.done ? 'text-sm text-slate-500 line-through' : 'text-sm font-medium text-white'}>{step.title}</p>
              {!step.done && <p className="text-xs text-slate-500">{step.hint}</p>}
            </div>
            {step.id === next.id && (
              <button onClick={() => onNavigate(DESTINATION[step.id])} className="shrink-0 min-h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
                Start
              </button>
            )}
          </li>
        ))}
      </ol>
    </GlassCard>
  );
}
