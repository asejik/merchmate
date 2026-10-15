# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server at http://localhost:5173 (PWA service worker disabled in dev)
npm run build     # Production build to dist/ (does NOT type-check)
npm run typecheck # tsc -b (strict, noUnusedLocals/Parameters)
npm run lint      # ESLint (flat config)
npm test          # Vitest, single run
npx vitest run src/lib/invoice.test.ts -t "applyPayment"   # single file / test name
npm run preview   # Serve the production build (use this to test PWA/offline behavior)
```

- Tests cover pure logic in `src/lib/` only (no DOM/IndexedDB environment is set up).
- `typescript-eslint` is pinned to `~8.70` because 8.71.0's dependency tarballs were missing from npm.
- WSL: if `npm` resolves to `/mnt/c/...` (Windows) it fails on WSL paths; put the nvm Node first in `PATH`.

## Architecture

MerchMate: offline-first invoicing PWA for small businesses (originally built for Nigerian Aso Oke textile sellers). React 18 + Vite + TypeScript + Tailwind v4 + Dexie (IndexedDB). There is no backend: all data lives in the browser.

- **Navigation**: no router. `App.tsx` holds an `activeTab: AppTab` (persisted to `localStorage`) and switches between `dashboard`, `invoices`, `create`, `customers`, `settings`. `AppShell` renders the nav and calls `onTabChange`.
- **Data layer**: `src/db/index.ts` defines the Dexie DB `AsoOkeInvoiceDB` (this legacy name must never change: it would orphan existing users' data) with tables `businessProfile` (single row, `++id`), `customers` and `invoices` (UUID string ids from `crypto.randomUUID()`). Types live in `src/types/index.ts`. Components read via `useLiveQuery` from `dexie-react-hooks` and write directly with `db.<table>.add/update` — there is no service/store layer. Only indexed fields can be used with `orderBy`/`where`; changing indexes requires a new `this.version(n)` block.
- **Schema versions**: v1 is the original; v2 adds `createdAt` and `invoiceNumber` indexes and backfills `createdAt` (`backfillCreatedAt`). New schema changes go in a new `version(n)` block; never edit an existing one.
- **Money logic lives in `src/lib/invoice.ts`** and must not be re-implemented in components: `calculateTotals` (subtotal → percentage/fixed discount capped at subtotal → `grandTotal`), `deriveStatus`, `getBalance`, `getAmountCollected`, `applyPayment`, `nextInvoiceNumber`, all rounded with `round2`. `depositAmount` is the running total paid, not just the initial deposit. Older invoices may have no `payments` array; always read history through `getPaymentHistory`, which synthesizes an "Initial Deposit" record. Quantities, prices and discounts may be decimals.
- **Quotes** live in the `invoices` table with `kind: 'quote'` (`kind` undefined = invoice; always test with `isQuote`/`kindOf`). They are numbered separately (`QUO-`), never carry payments, are excluded from dashboard money, and show derived `open`/`expired`/`converted` statuses. Converting sets `convertedInvoiceId` on the quote in the same transaction that saves the invoice.
- **Unconfirmed transfers** (fake-alert protection): a transfer not yet seen in the bank is a `PaymentRecord` with `unconfirmed: true`. It is excluded from `depositAmount`, status, receipts, reports and CSV: read money through `getConfirmedPayments`, not `getPaymentHistory`. `confirmPayment` moves it to the end of the history so already-issued receipt numbers never shift; `removeUnconfirmedPayment` drops one that never arrived.
- **Payment plans**: optional `paymentPlan: PlanInstallment[]` stored as **percentages** (amounts follow edits to the total; `planAmounts` gives the last instalment the rounding remainder). Payments fill instalments in order (`getPlanStatus`). `isOverdue` is true past `dueDate` *or* when an instalment with a past date is unpaid; use `getOverdueAmount` for overdue money and `getAmountToRequest` for what reminders ask for (never the whole balance when a plan exists). Instalments without a date are never overdue. Duplicates and conversions shift plan dates with the invoice date.
- **Order tracking**: invoices carry `orderStage` (`in_progress` → `ready` → `delivered`) and an optional `deliveryDate`; logic in `src/lib/orders.ts`. New invoices start `in_progress`; `undefined` means untracked (saved before tracking existed) and must stay untracked on edit. Quotes never have a stage. When an order is `ready`, the WhatsApp button sends `buildReadyMessage` instead of the payment reminder (`buildClientMessage` picks).
- **Today list** (dashboard `FollowUps`): `buildFollowUps` in `src/lib/followups.ts` lists invoices with unconfirmed transfers, ready orders, overdue balances or due/late deliveries. Its WhatsApp button uses the same `clientWhatsAppLink` as the invoice card and sets `lastReminderAt`, which moves message-only items to the bottom as done for the day.
- **Catalog** (Dexie v3 `catalog` table): learned automatically on every save via `learnFromItems` (per currency, latest price); suggested through a `<datalist>` in the form.
- **Invoice editor**: `InvoiceForm` has `create` / `create-quote` / `edit` / `duplicate` / `convert` modes driven by `EditorState` in `App.tsx` (the "New" nav button always resets to create). Form values are an `InvoiceDraft`; `composeInvoice` turns a draft into a stored `Invoice` and, on edit, preserves `id`, `createdAt`, `payments` and `depositAmount` (payments are only added via `applyPayment`). Tax is applied after the discount. "Overdue" is never stored; it is derived from `dueDate` with `getDisplayStatus`. Business-level defaults (tax label/rate, payment terms) live on `BusinessProfile`.
- **Dates**: always display through `formatDate` (`src/lib/dates.ts`) with `business.dateFormat`, never `toLocaleDateString` (device locale varies). Calendar dates (issued/due/delivery) are UTC midnight and read in UTC; pass `{ moment: true }` for real timestamps (payments, backups). WhatsApp messages and the invoice image always use the unambiguous `'long'` format.
- **Money display**: `formatMoney` in `src/lib/currency.ts`. In-app uses symbols (₦); PDFs must pass `{ code: true }` ("NGN 1,000.00") because react-pdf's Helvetica has no ₦ glyph.
- **PDF + sharing**: `InvoicePDF.tsx` is an `@react-pdf/renderer` document. Always render through `renderInvoicePdf` in `src/lib/pdf.tsx`, which dynamic-imports the ~1.3 MB renderer so it stays out of the main bundle. `shareOrDownload` uses `navigator.share` (WhatsApp on mobile) with a download fallback. The PWA precaches the lazy chunk (`workbox.maximumFileSizeToCacheInBytes` in `vite.config.ts`) so PDFs still work offline. The business logo is stored as a data URL in `businessProfile.logoUrl` so it works offline and in the PDF.
- **Invoice image and text**: `renderInvoiceImage` (`src/lib/invoiceImage.ts`) draws a phone-shaped PNG on a canvas (no library; system fonts have ₦, so it uses symbols). It draws twice: once to measure height, once to paint. `buildInvoiceText` (`src/lib/whatsapp.ts`) is the whole invoice as a WhatsApp message. Both are offered alongside the PDF in the share dialog (`ShareState.links` holds link actions).
- **Sharing gotcha**: `navigator.share` needs a recent user tap, so PDFs are generated *before* the share modal opens and the modal's button calls `shareOrDownload` (`src/lib/share.ts`) directly. WhatsApp reminders are plain `<a href="https://wa.me/...">` links built at render time (`src/lib/whatsapp.ts`) for the same reason (popup blockers).
- **Receipts**: one per payment, numbered `<invoiceNumber>-R<n>`, showing totals as of that payment (`getReceiptInfo`); `ReceiptPDF.tsx` is lazy-loaded like the invoice PDF.
- **Backup/restore**: `src/lib/backup.ts` (pure: versioned JSON format, zod validation, date revival) + `src/db/backup.ts` (Dexie IO; restore is a single transaction that replaces all tables). When adding a Date field to a stored type, add it to the backup schema so it is revived on restore. Last-backup time is per-device in `localStorage`.
- **Reports / statements / CSV**: pure builders in `src/lib/reports.ts` (monthly cash by *payment* date, top clients), `src/lib/statement.ts` (per-currency groups: never add amounts across currencies) and `src/lib/csv.ts` (formula-injection escaping, UTF-8 BOM). The dashboard chart is plain divs (no chart lib) using `bg-indigo-500`, which passed the dataviz palette validator on the dark surface; `indigo-400` fails its lightness band.
- **PDF theming**: `pdfTheme(business)` in `src/lib/color.ts` gives accent / on-accent text / tint from `brandColor`; `invoiceTemplate: 'modern'` draws a brand-colour header band. Bold text must use `fontFamily: 'Helvetica-Bold'`: react-pdf's built-in Helvetica ignores `fontWeight`.
- **Previewing PDFs without a browser**: a throwaway Vitest file can call `renderToFile` from `@react-pdf/renderer` (the Node build resolves under Vitest) and the resulting PDF can be inspected directly.
- **isSynced**: invoices carry an `isSynced` flag for a planned remote sync (Supabase env vars in `.env.example`), but no sync code exists yet.

## Constraints

- **React must stay on 18.3.1** (enforced via `overrides` in `package.json`). `@react-pdf/renderer` breaks on React 19 (`__SECRET_INTERNALS...` error). If React 19 gets installed, delete `node_modules` and `package-lock.json` and reinstall.
- **Node polyfills are required for PDF generation**: `vite.config.ts` uses `vite-plugin-node-polyfills` (buffer, process, stream, util) and `define: { global: 'window' }`; `main.tsx` also assigns `window.Buffer`, typed via `src/types/window.d.ts`. Don't remove these.

## Style conventions (from `.cursorrules`)

Note: `.cursorrules` mentions a `src/features/...` layout; the actual code uses `src/components/<area>/`. Follow the code.

- Dark glassmorphism UI (`GlassCard`, `bg-white/5`, `border-white/10`, slate/indigo palette), Framer Motion for animation (`AnimatePresence` for unmounts, `layout` for lists).
- Tailwind v4: theme tokens go in `@theme` in `src/index.css`; there is no `tailwind.config`.
- Don't use `useEffect` for derived state — use `useMemo`/derived variables.
- Type props explicitly with `interface`/`type`.
- Read secrets only through `import.meta.env`.
