import { useMemo, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DocumentGoneError, NumberInUseError, saveDocument } from '../../db/mutations';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '../ui/styles';
import { failed } from '../../lib/messages';
import { formatDate } from '../../lib/dates';
import { clearDraft, loadDraft, restoreValues, saveDraft } from '../../lib/drafts';
import type { DocumentKind } from '../../types';
import { calculateTotals, todayInputValue, validatePlan, type InvoiceDraft } from '../../lib/invoice';
import { EMPTY_ITEM, loadInitialValues, titles, type InitialState, type InvoiceEditorMode } from './form/formState';
import { DetailsSection } from './form/DetailsSection';
import { ItemsSection } from './form/ItemsSection';
import { TotalsSection } from './form/TotalsSection';
import { PlanSection } from './form/PlanSection';
import { CostsSection } from './form/CostsSection';

export type { InvoiceEditorMode } from './form/formState';

interface Props {
  mode: InvoiceEditorMode;
  /** Invoice/quote to edit, copy or convert (ignored when creating). */
  sourceInvoiceId?: string;
  onComplete: (kind: DocumentKind) => void;
  onCancel: () => void;
  onAddClient: () => void;
  /** Lets the app warn before an unsaved invoice is thrown away by leaving the screen. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function InvoiceForm({ mode, sourceInvoiceId, onComplete, onCancel, onAddClient, onDirtyChange }: Props) {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray());
  const [initial, setInitial] = useState<Omit<InitialState, 'values'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // New invoices and quotes keep an auto-saved draft; editing, duplicating and converting do not
  const draftKind: DocumentKind | null = mode === 'create' ? 'invoice' : mode === 'create-quote' ? 'quote' : null;
  const [restoredFrom, setRestoredFrom] = useState<Date | null>(null);
  const existing = initial?.existing;
  const kind = initial?.kind ?? (mode === 'create-quote' ? 'quote' : 'invoice');
  const isQuoteDoc = kind === 'quote';
  const noun = isQuoteDoc ? 'Quote' : 'Invoice';
  const text = titles(mode, kind);

  const { register, control, handleSubmit, setValue, reset, subscribe, getValues, formState: { errors, isDirty } } = useForm<InvoiceDraft>({
    defaultValues: {
      currency: 'NGN',
      items: [EMPTY_ITEM],
      discountType: 'percentage',
      discountRate: 0,
      taxRate: 0,
      taxLabel: 'VAT',
      depositAmount: 0,
    }
  });

  const items = useWatch({ control, name: "items" });
  const deposit = useWatch({ control, name: "depositAmount" });
  const currency = useWatch({ control, name: "currency" });
  const discountRate = useWatch({ control, name: "discountRate" });
  const discountType = useWatch({ control, name: "discountType" });
  const taxRate = useWatch({ control, name: "taxRate" });
  const taxLabel = useWatch({ control, name: "taxLabel" });
  const dateIssued = useWatch({ control, name: "dateIssued" });

  useEffect(() => {
    let cancelled = false;
    loadInitialValues(mode, sourceInvoiceId)
      .then(async ({ values, ...rest }) => {
        if (cancelled) return;
        const stored = draftKind ? loadDraft(draftKind) : null;
        if (stored) {
          // Pick up where the user left off (the number is replaced if someone has used it since)
          const numberTaken = !!(await db.invoices.where('invoiceNumber').equals(stored.values.invoiceNumber).first());
          if (cancelled) return;
          reset(values);
          reset(restoreValues(stored, values, todayInputValue(), numberTaken), { keepDefaultValues: true });
          setRestoredFrom(new Date(stored.savedAt));
        } else {
          reset(values);
        }
        setInitial(rest);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setError('Could not load this document. It may have been deleted.');
      });
    return () => { cancelled = true; };
  }, [mode, sourceInvoiceId, reset, draftKind]);

  // Save the draft on every change (a few kilobytes), so closing or losing the app never loses what was typed
  useEffect(() => {
    if (!draftKind || !initial) return;
    return subscribe({ formState: { values: true }, callback: () => saveDraft(draftKind, getValues()) });
  }, [draftKind, initial, subscribe, getValues]);

  /** Throws the draft away and returns to a blank form. */
  const startOver = async () => {
    if (!draftKind) return;
    clearDraft(draftKind);
    setRestoredFrom(null);
    const fresh = await loadInitialValues(mode, sourceInvoiceId);
    reset(fresh.values);
  };

  // Tell the app whether there is unsaved work, and clear it when this screen goes away
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // On edit, the amount paid comes from recorded payments, not the form. Quotes are never paid.
  const amountPaid = isQuoteDoc ? 0 : existing ? existing.depositAmount : deposit;

  const totals = useMemo(
    () => calculateTotals({ items: items ?? [], discountType, discountRate, taxRate, amountPaid }),
    [items, amountPaid, discountRate, discountType, taxRate]
  );

  const onSubmit = async (data: InvoiceDraft) => {
    setError('');
    const planError = validatePlan(data.plan);
    if (planError) {
      setError(planError);
      return;
    }
    if (data.dueDate && data.dueDate < data.dateIssued) {
      setError(`${isQuoteDoc ? 'Valid-until' : 'Due'} date cannot be before the ${noun.toLowerCase()} date.`);
      return;
    }
    if (totals.grandTotal <= 0) {
      setError(`The ${noun.toLowerCase()} total must be more than 0. Enter a price for each item.`);
      return;
    }

    setSaving(true);
    try {
      await saveDocument(data, existing, kind, initial?.convertFrom?.id);
      if (draftKind) clearDraft(draftKind);
      onDirtyChange?.(false); // saved: leaving is not losing anything
      onComplete(kind);
    } catch (err) {
      if (err instanceof NumberInUseError) {
        setError(`Number ${err.number} is already used. Choose another.`);
      } else if (err instanceof DocumentGoneError) {
        setError(`This ${noun.toLowerCase()} was deleted, so your changes were not saved.`);
      } else {
        console.error(err);
        setError(failed(`save this ${noun.toLowerCase()}`));
      }
    } finally {
      setSaving(false);
    }
  };
  // Wait for the client list too: a <select> mounted before its options exist cannot show the
  // saved client, so editing, duplicating or converting would open with no client chosen
  if (!initial || !customers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
        {error ? <p className="text-danger">{error}</p> : <Loader2 className="animate-spin" size={28} />}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink" aria-label="Back">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{text.title}</h1>
          <p className="text-muted text-sm">{text.subtitle}</p>
        </div>
        {draftKind && isDirty && (
          <button type="button" onClick={startOver} className={clsx(BUTTON_GHOST, "ml-auto shrink-0 whitespace-nowrap")}>
            Start over
          </button>
        )}
      </div>

      {restoredFrom && (
        <p role="status" className="mb-6 rounded-xl bg-primary-tint px-4 py-3 text-sm text-primary">
          Restored your unsaved {noun.toLowerCase()} (saved on this device {formatDate(restoredFrom, 'long', { moment: true })}). It is saved automatically as you type.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <DetailsSection register={register} errors={errors} setValue={setValue} currency={currency} dateIssued={dateIssued} noun={noun} isQuoteDoc={isQuoteDoc} customers={customers} onAddClient={onAddClient} />

        <ItemsSection control={control} register={register} setValue={setValue} items={items} currency={currency} />

        <TotalsSection register={register} setValue={setValue} currency={currency} noun={noun} isQuoteDoc={isQuoteDoc} existing={existing} discountType={discountType} discountRate={discountRate} taxRate={taxRate} taxLabel={taxLabel} totals={totals} amountPaid={amountPaid} />

        <PlanSection control={control} register={register} currency={currency} dateIssued={dateIssued} grandTotal={totals.grandTotal} />

        <CostsSection control={control} register={register} currency={currency} taxLabel={taxLabel} totals={totals} />

        <div className="flex flex-col items-end gap-3 pt-4">
          {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
          <button type="submit" disabled={saving} className={clsx(BUTTON_PRIMARY, "w-full sm:w-auto sm:px-8")}>
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {text.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
