import { expect, test } from './fixtures';

// Editing, copying and converting documents, payment plans, private job costs, order stages and
// list filters. These screens are the most intricate in the app, so they get their own checks.

const PLAN = [{ label: 'Deposit', percent: 50, dueInDays: -2 }, { label: 'Balance', percent: 50, dueInDays: 20 }];
const COSTS = [{ description: 'Secret fabric supplier', amount: 30000 }];

test.describe('documents', () => {
  test('editing shows what was saved, keeps payments, and the profit panel adds up', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 100000, paid: 40000, plan: PLAN, costs: COSTS }] });
    await app.go('Invoices');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    await expect(page.getByRole('heading', { name: 'Edit Invoice' })).toBeVisible();
    await expect(page.getByLabel('Invoice #')).toHaveValue('INV-001');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Aso Oke set');
    await expect(page.getByLabel('Instalment name')).toHaveCount(2);
    await expect(page.getByLabel('Instalment name').first()).toHaveValue('Deposit');
    await expect(page.getByLabel('Percentage').nth(1)).toHaveValue('50');
    await expect(page.getByLabel('Cost description')).toHaveValue('Secret fabric supplier');
    await expect(page.getByText('Paid so far:')).toContainText('₦40,000.00');
    // price 100,000 less costs 30,000: profit 70,000 at 70%
    const profit = page.getByText('Profit', { exact: true }).locator('..');
    await expect(profit).toContainText('₦70,000.00');
    await expect(profit).toContainText('70%');

    await page.getByLabel(/^Notes/).fill('Collect on Friday');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(page.getByText('+₦40,000.00')).toBeVisible(); // payments untouched
    await expect(page.getByText('Due: ₦60,000.00')).toBeVisible();
  });

  test('payment plan presets split the total and must add up to 100%', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('New');
    await page.getByLabel('Customer').selectOption({ index: 1 });
    await page.getByPlaceholder(/^Item description/).fill('Aso Oke set');
    await page.getByPlaceholder('Price').fill('100000');

    await page.getByRole('button', { name: '50 / 50' }).click();
    await expect(page.getByLabel('Instalment name')).toHaveCount(2);
    await expect(page.getByText('₦50,000.00')).toHaveCount(2); // each instalment's share
    await expect(page.getByText('Total 100%')).toBeVisible();

    await page.getByLabel('Percentage').first().fill('60');
    await expect(page.getByText('Total 110% (must be 100%)')).toBeVisible();
    await page.getByRole('button', { name: /Generate Invoice/ }).click();
    await expect(page.getByRole('alert')).toContainText('Instalments add up to 110%');
    await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible(); // nothing was saved

    await page.getByLabel('Percentage').first().fill('50');
    await page.getByRole('button', { name: /Generate Invoice/ }).click();
    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(page.getByText(/Next: Deposit/)).toBeVisible();
  });

  test('a duplicate gets the next number and starts unpaid', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 20000 }] });
    await app.go('Invoices');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();

    await expect(page.getByRole('heading', { name: 'Duplicate Invoice' })).toBeVisible();
    await expect(page.getByLabel('Invoice #')).toHaveValue('INV-002');
    await expect(page.getByLabel('Deposit / Initial Payment')).toHaveValue('0');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Aso Oke set');
    await page.getByRole('button', { name: 'Create Invoice' }).click();

    await expect(page.getByText('#INV-002')).toBeVisible();
    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(page.getByText('Due: ₦50,000.00')).toBeVisible(); // the copy is unpaid
    await expect(page.getByText('Due: ₦30,000.00')).toBeVisible(); // the original is untouched
  });

  test('a quote converts into an invoice and cannot be converted twice', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'q1', number: 'QUO-001', total: 80000, kind: 'quote' }] });
    await app.go('Invoices');
    await page.getByRole('tab', { name: 'quotes' }).click();
    await expect(page.getByText('#QUO-001')).toBeVisible();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Convert to Invoice' }).click();

    await expect(page.getByRole('heading', { name: 'Convert Quote to Invoice' })).toBeVisible();
    await expect(page.getByLabel('Invoice #')).toHaveValue('INV-001'); // invoices are numbered on their own
    await page.getByRole('button', { name: 'Create Invoice' }).click();

    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(page.getByText('Due: ₦80,000.00')).toBeVisible();
    await page.getByRole('tab', { name: 'quotes' }).click();
    await expect(page.getByText('Converted', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Convert to Invoice' })).toHaveCount(0);
  });

  test('order stages move forward, the ready message differs, and delivering an unpaid order asks first', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 20000 }] });
    await app.go('Invoices');

    await page.getByRole('button', { name: /Order In progress/ }).click();
    await expect(page.getByRole('button', { name: /Order Ready/ })).toBeVisible();
    const link = page.getByRole('link', { name: /order is ready/i });
    await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/2348035554444\?text=/);
    expect(decodeURIComponent((await link.getAttribute('href')) ?? '')).toMatch(/ready/i);

    await page.getByRole('button', { name: /Order Ready/ }).click();
    const ask = page.getByRole('alertdialog', { name: 'Mark as delivered?' });
    await expect(ask).toContainText('still owes ₦30,000.00');
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: /Order Ready/ })).toBeVisible(); // declined: unchanged

    await page.getByRole('button', { name: /Order Ready/ }).click();
    await page.getByRole('alertdialog', { name: 'Mark as delivered?' }).getByRole('button', { name: 'Mark delivered' }).click();
    await expect(page.getByRole('button', { name: /Order delivered/i })).toBeVisible();
  });

  test('search and filters narrow the list', async ({ app, page }) => {
    await app.open();
    await app.seed({
      customers: [{ id: 'c1', name: 'Mrs. Adebayo', phone: '08035554444' }, { id: 'c2', name: 'Chief Okafor', phone: '08036667777' }],
      invoices: [
        { id: 'i1', number: 'INV-001', total: 10000, paid: 10000, customerId: 'c1' },
        { id: 'i2', number: 'INV-002', total: 20000, customerId: 'c2', dueInDays: -5 },
        { id: 'i3', number: 'INV-003', total: 30000, customerId: 'c1' },
      ],
    });
    await app.go('Invoices');
    await expect(page.getByText(/^#INV-00\d/)).toHaveCount(3);

    await page.getByRole('tab', { name: 'Paid', exact: true }).click();
    await expect(page.getByText(/^#INV-00\d/)).toHaveCount(1);
    await page.getByRole('tab', { name: 'Overdue' }).click();
    await expect(page.getByText('#INV-002')).toBeVisible();
    await expect(page.getByText(/^#INV-00\d/)).toHaveCount(1);
    await page.getByRole('tab', { name: 'Unpaid' }).click();
    await expect(page.getByText(/^#INV-00\d/)).toHaveCount(2);
    await page.getByRole('tab', { name: 'All' }).click();

    await page.getByRole('searchbox').fill('okafor');
    await expect(page.getByText(/^#INV-00\d/)).toHaveCount(1);
    await page.getByRole('searchbox').fill('INV-003');
    await expect(page.getByText('#INV-003')).toBeVisible();
    await page.getByRole('searchbox').fill('nobody');
    await expect(page.getByText('No invoices match your search.')).toBeVisible();
  });

  test('private costs and profit never reach what the client is sent', async ({ app, page }) => {
    await app.open();
    await app.seed({ logo: true, invoices: [{ id: 'i1', number: 'INV-001', total: 100000, costs: COSTS }] });
    await app.go('Invoices');
    await expect(page.getByText(/Profit: ₦70,000.00/)).toBeVisible(); // visible to the owner in the list
    await page.getByRole('button', { name: 'Share PDF' }).click();
    const whatsapp = page.getByRole('link', { name: 'Send as WhatsApp Text' });
    await expect(whatsapp).toBeVisible({ timeout: 40_000 });
    const message = decodeURIComponent((await whatsapp.getAttribute('href')) ?? '');
    expect(message).toContain('INV-001');
    expect(message).not.toContain('Secret fabric');
    expect(message).not.toMatch(/profit|cost|30,000/i);
  });
});
