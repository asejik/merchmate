import { useReducer } from 'react';
import { FilePen } from 'lucide-react';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '../ui/styles';
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
    <div className="rounded-2xl border border-line bg-primary-tint p-4" role="region" aria-label="Unfinished invoice">
      <div className="flex items-start gap-3">
        <FilePen size={20} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-ink">You have an unfinished invoice</p>
          <p className="text-xs text-muted">
            {first ?? 'No items yet'}{total > 0 ? ` · ${formatMoney(total, values.currency)}` : ''} · saved {formatDate(draft.savedAt, dateFormat, { moment: true })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <button onClick={onContinue} className={`flex-1 ${BUTTON_PRIMARY}`}>Continue</button>
        <button onClick={() => { clearDraft('invoice'); refresh(); }} className={BUTTON_GHOST}>Discard</button>
      </div>
    </div>
  );
}
