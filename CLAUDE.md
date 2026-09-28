# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server at http://localhost:5173 (PWA service worker disabled in dev)
npm run build     # Production build to dist/ (does NOT type-check)
npx tsc -b        # Type-check (strict mode, noUnusedLocals/Parameters)
npm run preview   # Serve the production build (use this to test PWA/offline behavior)
```

- There is no test suite.
- `npm run lint` is configured (`eslint.config.js`) but `eslint`, `@eslint/js`, `typescript-eslint` and the react-hooks/react-refresh plugins are not in `devDependencies`, so it fails until they are installed.

## Architecture

Offline-first invoicing PWA for Aso Oke (Nigerian textile) merchants. React 18 + Vite + TypeScript + Tailwind v4 + Dexie (IndexedDB). There is no backend: all data lives in the browser.

- **Navigation**: no router. `App.tsx` holds an `activeTab` string (persisted to `localStorage`) and switches between `dashboard`, `invoices`, `create`, `customers`, `settings`. `AppShell` renders the nav and calls `onTabChange`.
- **Data layer**: `src/db/index.ts` defines the Dexie DB `AsoOkeInvoiceDB` with tables `businessProfile` (single row, `++id`), `customers` and `invoices` (UUID string ids from `crypto.randomUUID()`). Types live in `src/types/index.ts`. Components read via `useLiveQuery` from `dexie-react-hooks` and write directly with `db.<table>.add/update` — there is no service/store layer. Only indexed fields can be used with `orderBy`/`where`; changing indexes requires a new `this.version(n)` block.
- **Invoice money model**: totals are computed in `InvoiceForm` (`subtotal` → discount, either `percentage` or `fixed` via `discountType`/`discountRate` → `grandTotal`; `tax` is always 0). `depositAmount` is the running total paid, not just the initial deposit. Recording a payment (in `InvoiceList`) appends to `payments[]`, adds to `depositAmount`, and recomputes `status` (`pending` / `partial` / `paid`). Older invoices may have no `payments` array — code synthesizes a single "Initial Deposit" record from `depositAmount` in that case (see `InvoiceList` and `PaymentModal`). Quantities and discounts may be decimals.
- **PDF + sharing**: `InvoicePDF.tsx` is an `@react-pdf/renderer` document. `InvoiceList` calls `pdf(<InvoicePDF/>).toBlob()` and shares the file via `navigator.share` (WhatsApp on mobile), with a download fallback. The business logo is stored as a data URL in `businessProfile.logoUrl` so it works offline and in the PDF.
- **isSynced**: invoices carry an `isSynced` flag for a planned remote sync (Supabase env vars in `.env.example`), but no sync code exists yet.

## Constraints

- **React must stay on 18.3.1** (enforced via `overrides` in `package.json`). `@react-pdf/renderer` breaks on React 19 (`__SECRET_INTERNALS...` error). If React 19 gets installed, delete `node_modules` and `package-lock.json` and reinstall.
- **Node polyfills are required for PDF generation**: `vite.config.ts` uses `vite-plugin-node-polyfills` (buffer, process, stream, util) and `define: { global: 'window' }`; `main.tsx` also assigns `window.Buffer`, typed via `src/types/window.d.ts`. Don't remove these.
- The PWA manifest in `vite.config.ts` references `pwa-192x192.png` / `pwa-512x512.png`, but `public/` contains `pwa-192.png` / `pwa-512.png`.

## Style conventions (from `.cursorrules`)

Note: `.cursorrules` mentions React 19, Supabase, and a `src/features/...` layout — the actual code uses React 18, no Supabase, and `src/components/<area>/`. Follow the code.

- Dark glassmorphism UI (`GlassCard`, `bg-white/5`, `border-white/10`, slate/indigo palette), Framer Motion for animation (`AnimatePresence` for unmounts, `layout` for lists).
- Tailwind v4: theme tokens go in `@theme` in `src/index.css`; there is no `tailwind.config`.
- Don't use `useEffect` for derived state — use `useMemo`/derived variables.
- Type props explicitly with `interface`/`type`.
- Lazy-load heavy components like the PDF renderer.
- Read secrets only through `import.meta.env`.
