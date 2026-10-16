import { describe, expect, it } from 'vitest';
import { clearAllDrafts, clearDraft, hasContent, loadDraft, restoreValues, saveDraft, type DraftStorage } from './drafts';
import type { InvoiceDraft } from './invoice';

const memory = (): DraftStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) };
};

const blank: InvoiceDraft = {
  customerId: '', invoiceNumber: 'INV-005', currency: 'NGN', dateIssued: '2026-10-16', dueDate: '2026-10-30',
  items: [{ description: '', quantity: 1, unitPrice: 0 }], discountType: 'percentage', discountRate: 0, taxRate: 0, taxLabel: 'VAT',
  notes: '', deliveryDate: '', plan: [], costs: [], depositAmount: 0,
};
const typed: InvoiceDraft = { ...blank, customerId: 'c1', items: [{ description: 'Aso Oke set', quantity: 2, unitPrice: 25000 }] };
const at = new Date('2026-10-16T09:00:00Z');

describe('hasContent', () => {
  it('treats an untouched form as nothing', () => {
    expect(hasContent(blank)).toBe(false);
  });

  it('notices anything the user entered', () => {
    expect(hasContent({ ...blank, customerId: 'c1' })).toBe(true);
    expect(hasContent({ ...blank, items: [{ description: 'x', quantity: 1, unitPrice: 0 }] })).toBe(true);
    expect(hasContent({ ...blank, items: [{ description: '', quantity: 1, unitPrice: 500 }] })).toBe(true);
    expect(hasContent({ ...blank, notes: 'Collect Friday' })).toBe(true);
    expect(hasContent({ ...blank, depositAmount: 100 })).toBe(true);
    expect(hasContent({ ...blank, costs: [{ description: '', amount: 0 }] })).toBe(true);
    expect(hasContent({ ...blank, notes: '   ' })).toBe(false);
  });
});

describe('saving and loading', () => {
  it('round-trips a draft, one per kind', () => {
    const storage = memory();
    saveDraft('invoice', typed, at, storage);
    saveDraft('quote', { ...typed, invoiceNumber: 'QUO-002' }, at, storage);
    expect(loadDraft('invoice', storage)?.values.invoiceNumber).toBe('INV-005');
    expect(loadDraft('quote', storage)?.values.invoiceNumber).toBe('QUO-002');
    expect(loadDraft('invoice', storage)?.savedAt).toBe(at.toISOString());
  });

  it('removes the draft when the form is emptied again', () => {
    const storage = memory();
    saveDraft('invoice', typed, at, storage);
    saveDraft('invoice', blank, at, storage);
    expect(loadDraft('invoice', storage)).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('can be cleared one at a time or all together', () => {
    const storage = memory();
    saveDraft('invoice', typed, at, storage);
    saveDraft('quote', typed, at, storage);
    clearDraft('invoice', storage);
    expect(loadDraft('invoice', storage)).toBeNull();
    expect(loadDraft('quote', storage)).not.toBeNull();
    clearAllDrafts(storage);
    expect(loadDraft('quote', storage)).toBeNull();
  });

  it('throws away damaged data instead of crashing', () => {
    const storage = memory();
    storage.setItem('invoiceDraft:invoice', '{not json');
    expect(loadDraft('invoice', storage)).toBeNull();
    expect(storage.data.has('invoiceDraft:invoice')).toBe(false);
    storage.setItem('invoiceDraft:invoice', JSON.stringify({ savedAt: at.toISOString(), values: { items: 'x' } }));
    expect(loadDraft('invoice', storage)).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const broken: DraftStorage = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(() => saveDraft('invoice', typed, at, broken)).not.toThrow();
    expect(loadDraft('invoice', broken)).toBeNull();
    expect(() => clearAllDrafts(broken)).not.toThrow();
  });
});

describe('restoreValues', () => {
  const fresh = { ...blank, invoiceNumber: 'INV-007', dateIssued: '2026-10-18', dueDate: '2026-11-01' };
  const stored = (values: InvoiceDraft, savedAt = at) => ({ savedAt: savedAt.toISOString(), values });

  it('keeps everything the user typed, on the same day', () => {
    const restored = restoreValues(stored(typed), fresh, '2026-10-16', false);
    expect(restored.items[0].description).toBe('Aso Oke set');
    expect(restored.customerId).toBe('c1');
    expect(restored.invoiceNumber).toBe('INV-005');
    expect(restored.dateIssued).toBe('2026-10-16');
  });

  it('gives a new number when the old one has since been used', () => {
    expect(restoreValues(stored(typed), fresh, '2026-10-16', true).invoiceNumber).toBe('INV-007');
  });

  it('does not backdate an old draft: dates restart from today with the same terms', () => {
    const old = { ...typed, dateIssued: '2026-10-10', dueDate: '2026-10-24', deliveryDate: '2026-10-17',
      plan: [{ label: 'Deposit', percent: 50, dueDate: '2026-10-10' }, { label: 'Balance', percent: 50, dueDate: '' }] };
    const restored = restoreValues(stored(old, new Date('2026-10-10T12:00:00Z')), fresh, '2026-10-16', false);
    expect(restored.dateIssued).toBe('2026-10-16');
    expect(restored.dueDate).toBe('2026-10-30'); // 14-day terms kept
    expect(restored.deliveryDate).toBe('2026-10-23'); // 7 days after issue kept
    expect(restored.plan[0].dueDate).toBe('2026-10-16');
    expect(restored.plan[1].dueDate).toBe('');
  });
});
