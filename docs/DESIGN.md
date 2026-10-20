# MerchMate design system: "Adire"

Direction chosen 2026-10-20 (P06): **Adire**, structured and trustworthy with a heritage indigo. Light first; dark follows the phone's setting. The source of truth for every value below is `src/index.css` (tokens) and `src/components/ui/` (components). If this file and the code disagree, the code wins: fix this file.

## Personality

Trustworthy, calm and clear, warm, sharp. Stripe-like in structure (one dominant number per screen, flat surfaces, hairline borders), with warmth from a cream "paper" background, a saffron accent used sparingly, and plain, friendly wording.

The colour story: indigo-dyed cloth (adire, aso oke) is the real heritage of the first users. The cream is paper, the saffron is the gold thread. It deliberately avoids the purple Nigerian fintech apps lean towards, and the generic Tailwind indigo-on-slate look the app had before.

## Rules

1. **Tokens only.** No colour, radius, shadow or duration written in a component. Use the utilities (`bg-paper`, `text-ink`, `border-line`, `bg-primary`, ...). Raw values live in `:root` of `src/index.css`.
2. **One dominant element per screen.** The dashboard's is "Owed to you". Size and weight before colour.
3. **One filled primary action per screen** (`BUTTON_PRIMARY`). Others are `BUTTON_SECONDARY` or `BUTTON_GHOST`. The nav's "New" is the app's standing primary.
4. **Flat.** Hairline borders, at most the card shadow. No glass, no blur, no ghost icons, no gradients.
5. **Saffron is decoration** (the active-tab marker, the logo's fold). It is 2:1 on paper: never text, never the only signal.
6. **Status is never colour alone**: always a word ("Overdue", "Paid"), then colour.
7. **Money**: use the `money` class (tabular figures) and `formatMoney`. Overviews pass `trimZeros` ("₦205,000"); lists, documents and PDFs keep both decimals.
8. **Text sizes**: nothing under 12px (`text-xs`). Inputs and tap targets stay 44px (see CLAUDE.md).
9. **Motion** communicates or marks one moment: 150ms (hover, press), 250ms (nav marker), 400ms (a bar filling once). One easing, `--ease-out`. All of it collapses under "reduce motion" (`index.css`, `MotionConfig`). Content is visible by default.
10. **Dark mode is not an afterthought**: every token has a dark value, and `e2e/08-accessibility.spec.ts` scans the redesigned screens in dark.

## Tokens

Light values; the dark column is what `prefers-color-scheme: dark` swaps in. Contrast is measured (WCAG 2.2 AA needs 4.5:1 for text, 3:1 for UI).

| Token (utility) | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#FBF9F5` | `#0E1226` | Page background |
| `surface` | `#FFFFFF` | `#171C38` | Cards, nav |
| `sunken` | `#EEEAE0` | `#1F2547` | Progress tracks, hover on quiet controls |
| `line` | `#E6E1D8` | `#2A3157` | Hairlines (decorative) |
| `line-strong` | `#B9B1A1` | `#5A6498` | Borders of controls (3:1 or better) |
| `ink` | `#151B33` | `#EEF0FA` | Primary text (16.2:1 / 16.3:1 on paper) |
| `muted` | `#5A6275` | `#A3AAC8` | Secondary text (5.8:1 / 8.1:1 on paper; 5.1 / 6.5 on sunken) |
| `primary` | `#27358F` | `#8C9BFF` | Actions, links, key bars (10.0:1 / 7.3:1 on paper) |
| `primary-hover` | `#1D2972` | `#A6B2FF` | Hover on primary |
| `on-primary` | `#FFFFFF` | `#0E1226` | Text on primary (10.5:1 / 7.3:1) |
| `primary-tint` | `#E8EBFA` | `#232B57` | Info chips, hover on secondary (primary text on it 8.9:1 / 5.3:1) |
| `accent` | `#E8A317` | `#F2B63D` | Decoration only |
| `success` / `success-tint` | `#17724A` / `#E4F4EA` | `#5FD59B` / `#12352A` | Paid (5.2:1 / 7.3:1 on its tint) |
| `warning` / `warning-tint` | `#8F5200` / `#FCF0D6` | `#F2B63D` / `#3A2E10` | Partly paid, check-your-bank (5.5:1 / 7.3:1) |
| `danger` / `danger-tint` | `#B3261E` / `#FBE9E7` | `#FF8A80` / `#3E1B1E` | Overdue, errors (5.6:1 / 6.7:1) |

Other tokens: `--elev-card` (`shadow-card`, a 1px hairline shadow, none in dark), `--elev-raised` (`shadow-raised`, menus and dialogs), `--dur-fast/base/slow` (150/250/400ms), `--ease-out` (`cubic-bezier(0.2, 0.7, 0.2, 1)`).

### Type
**Plus Jakarta Sans** only, self-hosted (`src/assets/fonts/`, 62 KB in three unicode-range subsets, licence in `OFL-PlusJakartaSans.txt`). Chosen over the first candidates because it is the only one tested that has the naira sign, the Yoruba and Igbo letters (ẹ ọ ṣ ị ụ) and tabular figures at this size; Hausa hooked letters (ɓ ɗ ƙ) fall back to the system font. Weights 400-800.

| Role | Class | Size / weight |
|---|---|---|
| Hero number | `text-4xl font-extrabold tracking-tight money` | 36 / 800 |
| Tile number, profit | `text-xl` to `text-3xl font-bold` | 20-30 / 700-800 |
| Section heading (h2) | `text-base font-bold` | 16 / 700 |
| Body | `text-sm` | 14 / 400-600 |
| Label, caption, chip | `text-xs` | 12 / 500-600 |

### Shape
Cards `rounded-2xl` (16px) with `border-line` and `shadow-card`. Controls and buttons `rounded-xl` (12px). Chips and the progress bar `rounded-full`. Spacing is Tailwind's 4px scale: 16px page gutter on phones, 24px between sections (`space-y-6`), 20px inside hero cards.

### Components (`src/components/ui/`)
- `Card`: the flat surface. `Chip` (`neutral | primary | success | warning | danger`): small status label. `Logo`: mark (and optional wordmark) from tokens.
- `BUTTON_PRIMARY | BUTTON_SECONDARY | BUTTON_GHOST` in `styles.ts`: 44px, 12px radius.
- Notices (`InstallHint`, `ContinueDraft`, `GetStarted`, `BackupReminder`): `primary-tint` for information, `warning-tint` for "do this today".
- `FIELD_CLASS`, `FIELD_LABEL`, `OVERLAY_CLASS` (`styles.ts`): fields and window backdrop. `INPUT_CLASS`/`LABEL_CLASS` are the old dark pair for the screens not yet moved. Status words and tones for invoices: `STATUS_LABELS`/`STATUS_TONES` in `invoices/list/invoiceRow.ts`; tone colours in `ui/chipTones.ts`.
- Navigation: phone bottom bar (surface, hairline top, saffron marker slides to the active tab, "New" is the primary pill); desktop 256px sidebar with logo and labelled items.
- Legacy: `GlassCard` and the dark classes still exist for screens not yet moved. They sit inside `data-surface="dark"` (see below).

## Brand

**Mark**: a folded page holding an M (indigo page, cream M, saffron fold). It says "invoice" before it says anything else, works in one colour, and holds at 16px (checked: favicon and tab).
**Wordmark**: "Merch" in `ink`, "Mate" in `primary`, Plus Jakarta Sans 800.
**Icons**: `public/favicon.svg` (follows light/dark), `favicon.ico`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`: an indigo square with the cream page (page height 62% of the icon, 50% for maskable so it survives masking). They are drawn from the same shapes as `Logo.tsx`; change them together. They replaced the earlier 345 KB of icons with about 15 KB.
**Colours**: `theme-color` is paper (light) and `#0E1226` (dark); the manifest's theme is primary and its splash is paper.

## Signature moments
Built: the saffron marker that slides between tabs (250ms); the "paid of invoiced" bar filling once (400ms).
Planned with the invoice screens: a PAID stamp that presses onto an invoice once when it is settled.

## Wording
Plain, sentence case, verbs first, no "please", no exclamation marks. "Owed to you", not "Pending / Outstanding". Errors say what happened and what to do (`failed()` in `lib/messages.ts`).

## Migration status (as of 2026-10-20)
Moved to the new design: app shell (nav, header, logo), Dashboard (hero, Today list, tiles, recent activity, reports, notices), Invoices list (cards, status chips, actions menu), the payment window and share window, icons and favicon.
Not yet moved: New invoice form, Clients, Settings, the confirm/alert dialogs (`DialogProvider`), lock screen, fatal error screen, update banner. They keep their dark styling inside `data-surface="dark"`, so the app works while the move happens one screen at a time. When the last one moves, delete the `[data-surface='dark']` block in `index.css`, the attribute in `AppShell`, `LockScreen`, `FatalError`, and `GlassCard`.

## Known gaps
- Hausa hooked letters have no glyph in the font (fallback only).
- The font and wordmark have not been checked on a real low-end Android phone.
- Desktop is a single centred column (max 896px); a two-column dashboard is a later option.
