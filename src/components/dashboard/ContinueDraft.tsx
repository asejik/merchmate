import { useReducer } from 'react';
import { FilePen } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { clearDraft, loadDraft } from '../../lib/drafts';
import { formatDate } from '../../lib/dates';
import { calculateTotals } from '../../lib/invoice';
import { formatMoney } from '../../lib/currency';
import type { DateFormat } from '../../types';

/** Offers to finish an invoice that was started and left. Read from storage on every render, so it stays current. */
export function ContinueDraft({ dateFormat, onContinue }: { dateFormat?: DateFormat; onContinue: () => void }) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const draft = loadDraft('invoice');
  if (!draft) return null;

  const { values } = draft;
  const total = calculateTotals({ items: values.items, discountType: values.discountType, discountRate: values.discountRate, taxRate: values.taxRate, amountPaid: 0 }).grandTotal;
  const first = values.items.find(item => item.description?.trim())?.description?.trim();
  return (
    <GlassCard className="p-4" role="region" aria-label="Unfinished invoice">
      <div className="flex items-start gap-3">
        <FilePen size={20} className="text-indigo-300 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-white">You have an unfinished invoice</p>
          <p className="text-xs text-slate-400">
            {first ?? 'No items yet'}{total > 0 ? ` · ${formatMoney(total, values.currency)}` : ''} · saved {formatDate(draft.savedAt, dateFormat, { moment: true })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <button onClick={onContinue} className="flex-1 min-h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Continue</button>
        <button onClick={() => { clearDraft('invoice'); refresh(); }} className="min-h-11 px-4 rounded-xl text-sm text-slate-300 hover:bg-white/10">Discard</button>
      </div>
    </GlassCard>
  );
}
