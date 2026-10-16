# Refactor: split the two largest components (2026-10-16)

**Why:** `InvoiceForm.tsx` (709 lines) and `InvoiceList.tsx` (690) each mixed data loading, business decisions and markup. They were the hardest files to change safely (finding A1 in the P05 review).
**Rule:** behaviour must not change.

## What moved

| Before | After |
|---|---|
| `InvoiceList.tsx` (690) | `InvoiceList.tsx` (188: tabs, search, filters, layout), `list/InvoiceCard.tsx` (one card and its menu), `list/useInvoiceActions.ts` (share, pay, deliver, void, delete handlers), `list/documents.ts` (PDF and share helpers), `list/invoiceRow.ts` (row type, filters, styles) |
| `InvoiceForm.tsx` (709) | `InvoiceForm.tsx` (168: form setup, totals, submit), `form/DetailsSection.tsx`, `form/ItemsSection.tsx`, `form/TotalsSection.tsx`, `form/PlanSection.tsx`, `form/CostsSection.tsx`, `form/formState.ts` (titles and the initial-values loader), `form/formStyles.ts` |

Markup and handlers were cut and pasted by script, not retyped. Props are the only new code. `PlanSection` and `CostsSection` now own their field arrays and compute their own breakdowns (`planAmounts`, `computeProfit`), as only they used them.

## Evidence that nothing changed

1. **Identical page HTML.** The original code (commit `14e61cb`) and the refactored code were built side by side and driven through the same 16 screen states: the invoice list, an open actions menu (normal and voided invoice), the five filters, the quotes tab, the payment window, and all five form modes (new, new and filled in with a plan, costs, discount and tax, edit, duplicate, convert, new quote). The HTML of each was identical, character for character (React-generated ids and fade-in animation styles normalised).
2. 23 Playwright smoke tests pass, including the 7 added first for edit, duplicate, convert, plans, costs, orders and filters.
3. 182 unit tests, typecheck, lint and build pass.

## One bug found along the way (fixed separately, before the split)
The refactor changed timing slightly and made an existing race visible: the client dropdown could mount before the client list loaded, so editing, duplicating or converting opened with no client chosen. Fixed in its own commit (`Fix the invoice form opening with no client selected...`).

## Manual checklist (about 10 minutes, at phone width)
Tick each on the deployed build or `npm run preview`.

**Invoice list**
- [ ] Invoices and Quotes tabs switch; counts and "Create your first..." empty states show
- [ ] Search by client and by number; the five filters; "No invoices match" message
- [ ] A card shows status chip, due or delivery date, balance, unconfirmed amount, profit, next instalment
- [ ] The three-dot menu opens (upwards near the bottom), closes with Escape and by tapping outside
- [ ] Menu: Edit, Duplicate, Order stages, and Delete (no payments) / Void (payments) / Reinstate (voided)
- [ ] Quote menu has Convert to Invoice, and not after converting
- [ ] Record payment: cash updates balance and offers a receipt; transfer waits as "unconfirmed" until "Received?"
- [ ] Share PDF opens PDF / image / WhatsApp text; Download PDF downloads; receipt button works
- [ ] WhatsApp reminder link; "ready" message when the order is ready
- [ ] Marking a part-paid order Delivered asks first

**Invoice form** (new invoice, new quote, edit, duplicate, convert)
- [ ] Opens with the right title, number, client chosen, dates, items, plan rows, costs
- [ ] Currency switch, due-date presets, discount type toggle, tax, deposit (new only), notes
- [ ] Items: add and remove, saved-item suggestions fill the price, totals update live
- [ ] Payment plan presets, add and remove instalment, "must be 100%" message, error on save
- [ ] My Costs: add and remove, profit and margin update; never appear on the shared invoice
- [ ] Validation: missing client, duplicate number, due before issue date, zero total
- [ ] Leaving with typing asks to discard; saving does not
