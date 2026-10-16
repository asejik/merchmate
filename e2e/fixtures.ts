import { readFileSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---- production headers -------------------------------------------------------------------------
// The deployed site sends the headers in vercel.json (including a strict Content-Security-Policy).
// Apply the very same ones here, so a feature that only breaks under them (PDFs need WebAssembly)
// fails in this suite instead of for a user.
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map(h => [h.key.toLowerCase(), h.value]));

declare global {
  interface Window {
    __reportCsp: (message: string) => void;
  }
}

export const test = base.extend<{ app: App }>({
  // Every test runs with the production headers, and fails if the app logs an error or breaks the CSP.
  page: async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    await page.route(`${baseURL}/**`, async route => {
      // The local preview server occasionally resets a connection under parallel load: retry once
      const response = await route.fetch().catch(() => route.fetch());
      await route.fulfill({ response, headers: { ...response.headers(), ...securityHeaders } });
    });
    await page.exposeFunction('__reportCsp', (message: string) => problems.push(`CSP violation: ${message}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => window.__reportCsp(`${e.violatedDirective} ${e.blockedURI}`));
    });
    page.on('pageerror', e => problems.push(`page error: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
    await use(page);
    expect(problems, 'the app must run without errors or CSP violations').toEqual([]);
  },
  app: async ({ page }, use) => use(new App(page)),
});

export { expect };

// ---- test data ----------------------------------------------------------------------------------
export const PNG_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export interface SeedInvoice {
  id: string;
  number: string;
  customerId?: string;
  total: number;
  paid?: number;
  issuedDaysAgo?: number;
  dueInDays?: number;
  kind?: 'invoice' | 'quote';
  /** Instalments as percentages; the first is due today unless dueInDays says otherwise. */
  plan?: { label: string; percent: number; dueInDays?: number }[];
  /** Private job costs. */
  costs?: { description: string; amount: number }[];
  orderStage?: 'in_progress' | 'ready' | 'delivered';
  description?: string;
}

/** A well-formed stored invoice (what the app itself would save). */
function storedInvoice(i: SeedInvoice) {
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const paid = i.paid ?? 0;
  return {
    id: i.id, kind: i.kind ?? 'invoice', customerId: i.customerId ?? 'c1', invoiceNumber: i.number,
    items: [{ id: `${i.id}-item`, description: i.description ?? 'Aso Oke set', quantity: 1, unitPrice: i.total, total: i.total }],
    subtotal: i.total, discount: 0, tax: 0, grandTotal: i.total, depositAmount: paid,
    payments: paid ? [{ id: `${i.id}-pay`, date: new Date().toISOString(), amount: paid, note: 'Cash' }] : [],
    currency: 'NGN', status: paid >= i.total ? 'paid' : paid > 0 ? 'partial' : 'pending',
    dateIssued: day(-(i.issuedDaysAgo ?? 1)), dueDate: day(i.dueInDays ?? 14),
    createdAt: new Date(), updatedAt: new Date(), isSynced: false,
    ...(i.kind === 'quote' ? {} : { orderStage: i.orderStage ?? 'in_progress' }),
    ...(i.costs ? { costs: i.costs.map((c, n) => ({ id: `${i.id}-cost${n}`, ...c })) } : {}),
    ...(i.plan ? { paymentPlan: i.plan.map((p, n) => ({ id: `${i.id}-step${n}`, label: p.label, percent: p.percent, dueDate: day(p.dueInDays ?? 0) })) } : {}),
  };
}

export const BUSINESS = {
  businessName: 'Ade Fabrics', phone: '08031112222', address: '12 Market Road, Ibadan',
  bankName: 'Demo Bank', accountNumber: '0123456789', accountName: 'Ade Fabrics',
};

// ---- helpers for driving the app -----------------------------------------------------------------
export class App {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open(path = '/') {
    await this.page.goto(path);
    await expect(this.page.getByRole('navigation').getByRole('button', { name: 'Home' })).toBeVisible();
  }

  nav(name: 'Home' | 'Invoices' | 'New' | 'Clients' | 'Settings') {
    return this.page.getByRole('navigation').getByRole('button', { name, exact: true });
  }

  async go(name: 'Home' | 'Invoices' | 'New' | 'Clients' | 'Settings') {
    await this.nav(name).click();
  }

  /** Writes records straight into the app's database, as if the user had created them earlier. */
  async seed(data: { business?: boolean; logo?: boolean; customers?: { id: string; name: string; phone: string }[]; invoices?: SeedInvoice[] }) {
    const rows = {
      business: data.business === false ? null : { id: 1, ...BUSINESS, ...(data.logo ? { logoUrl: PNG_LOGO } : {}) },
      customers: (data.customers ?? [{ id: 'c1', name: 'Mrs. Adebayo', phone: '08035554444' }]).map(c => ({ ...c, createdAt: new Date() })),
      invoices: (data.invoices ?? []).map(storedInvoice),
    };
    await this.page.evaluate(rows => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('AsoOkeInvoiceDB');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(['businessProfile', 'customers', 'invoices'], 'readwrite');
        if (rows.business) tx.objectStore('businessProfile').put(rows.business);
        rows.customers.forEach(c => tx.objectStore('customers').put(c));
        rows.invoices.forEach(i => tx.objectStore('invoices').put(i));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    }), rows);
    await this.page.reload();
    await expect(this.nav('Home')).toBeVisible();
  }

  async saveBusinessDetails() {
    const p = this.page;
    await p.locator('input[name=businessName]').fill(BUSINESS.businessName);
    await p.locator('input[name=phone]').fill(BUSINESS.phone);
    await p.locator('[name=address]').fill(BUSINESS.address);
    await p.locator('input[name=bankName]').fill(BUSINESS.bankName);
    await p.locator('input[name=accountNumber]').fill(BUSINESS.accountNumber);
    await p.locator('input[name=accountName]').fill(BUSINESS.accountName);
    await p.getByRole('button', { name: 'Save Settings' }).click();
    await expect(p.getByText('Settings saved successfully!')).toBeVisible();
  }

  /** Counts every record in the three data tables. */
  async recordCount(): Promise<number> {
    return this.page.evaluate(() => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open('AsoOkeInvoiceDB');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const names = ['businessProfile', 'customers', 'invoices'];
        let total = 0, done = 0;
        for (const name of names) {
          const count = open.result.transaction(name).objectStore(name).count();
          count.onsuccess = () => { total += count.result; if (++done === names.length) resolve(total); };
        }
      };
    }));
  }

  /** Accessibility violations (WCAG 2.2 AA) on the current screen. */
  async accessibilityViolations() {
    const result = await new AxeBuilder({ page: this.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    return result.violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`);
  }
}
