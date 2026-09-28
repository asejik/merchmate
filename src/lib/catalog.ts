import type { CatalogItem, CurrencyCode, InvoiceItem } from '../types';

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Upserts for the catalog after saving a document: every priced line item is remembered
 * (per currency) with its latest price. Returns only the entries that changed.
 */
export function learnFromItems(
  catalog: CatalogItem[],
  items: Pick<InvoiceItem, 'description' | 'unitPrice'>[],
  currency: CurrencyCode,
  now: Date = new Date(),
): CatalogItem[] {
  const byKey = new Map(catalog.filter(c => c.currency === currency).map(c => [normalize(c.name), c]));
  const changed = new Map<string, CatalogItem>();

  for (const item of items) {
    const name = item.description.trim().replace(/\s+/g, ' ');
    if (!name || !(item.unitPrice > 0)) continue;
    const key = normalize(name);
    const current = changed.get(key) ?? byKey.get(key);
    changed.set(key, current
      ? { ...current, unitPrice: item.unitPrice, usageCount: current.usageCount + 1, updatedAt: now }
      : { id: crypto.randomUUID(), name, unitPrice: item.unitPrice, currency, usageCount: 1, updatedAt: now });
  }
  return [...changed.values()];
}

/** Exact (case-insensitive) match for auto-filling a price when a suggestion is picked. */
export function findCatalogItem(catalog: CatalogItem[], description: string, currency: CurrencyCode): CatalogItem | undefined {
  const key = normalize(description);
  return key ? catalog.find(c => c.currency === currency && normalize(c.name) === key) : undefined;
}

/** Most used first, then alphabetical. */
export function sortCatalog(catalog: CatalogItem[]): CatalogItem[] {
  return [...catalog].sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
}
