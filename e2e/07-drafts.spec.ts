import { expect, test } from './fixtures';

// A new invoice or quote saves itself as you type, so a phone call, a crash or the system closing the
// app never loses it. Editing an existing document is different: it asks before discarding.

test.describe('drafts', () => {
  test('a half-typed invoice is kept when you leave, and when the app is closed', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('New');
    await page.getByLabel('Customer').selectOption({ index: 1 });
    await page.getByPlaceholder(/^Item description/).fill('Aso Oke set');
    await page.getByPlaceholder('Price').fill('45000');

    // Leaving does not ask: nothing is lost
    await app.go('Home');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const card = page.getByRole('region', { name: 'Unfinished invoice' });
    await expect(card).toContainText('Aso Oke set');
    await expect(card).toContainText('₦45,000.00');

    // Continue picks up exactly where it was left
    await card.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Restored your unsaved invoice' })).toBeVisible();
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Aso Oke set');
    await expect(page.getByPlaceholder('Price')).toHaveValue('45000');
    await expect(page.getByLabel('Customer')).not.toHaveValue('');

    // Closing the app entirely (a full reload) keeps it too
    await page.reload();
    await app.go('New');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Aso Oke set');
    await expect(page.getByLabel('Customer')).not.toHaveValue('');
  });

  test('saving removes the draft, and an untouched form never leaves one', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('New');
    await app.go('Home'); // visit and leave without typing
    await expect(page.getByRole('region', { name: 'Unfinished invoice' })).toHaveCount(0);

    await app.go('New');
    await page.getByLabel('Customer').selectOption({ index: 1 });
    await page.getByPlaceholder(/^Item description/).fill('Aso Oke set');
    await page.getByPlaceholder('Price').fill('1000');
    await page.getByRole('button', { name: /Generate Invoice/ }).click();
    await expect(page.getByText('#INV-001')).toBeVisible();

    await app.go('Home');
    await expect(page.getByRole('region', { name: 'Unfinished invoice' })).toHaveCount(0);
    await app.go('New');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue(''); // a fresh form
    await expect(page.getByLabel(/^Invoice #/)).toHaveValue('INV-002');
  });

  test('Start over and Discard both throw the draft away', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('New');
    await page.getByPlaceholder(/^Item description/).fill('Draft one');
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('');
    await page.reload();
    await app.go('New');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('');

    await page.getByPlaceholder(/^Item description/).fill('Draft two');
    await app.go('Home');
    await page.getByRole('region', { name: 'Unfinished invoice' }).getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('region', { name: 'Unfinished invoice' })).toHaveCount(0);
    await app.go('New');
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('');
  });

  test('quotes keep their own draft, separate from invoices', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('Invoices');
    await page.getByRole('tab', { name: 'quotes' }).click();
    await page.getByRole('button', { name: /Create your first quote/ }).click();
    await expect(page.getByRole('heading', { name: 'New Quote' })).toBeVisible();
    await page.getByPlaceholder(/^Item description/).fill('Quote draft');

    await app.go('Invoices'); // leave: no question, nothing lost
    await page.getByRole('tab', { name: 'quotes' }).click();
    await page.getByRole('button', { name: /Create your first quote/ }).click();
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Quote draft');

    await app.go('New'); // a new INVOICE is a different form with its own (empty) draft
    await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible();
    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('');
  });

  test('an old draft does not backdate the invoice or reuse a number that is now taken', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-005', total: 1000 }] });
    const tenDaysAgo = new Date(Date.now() - 10 * 864e5);
    const day = tenDaysAgo.toISOString().slice(0, 10);
    const due = new Date(tenDaysAgo.getTime() + 14 * 864e5).toISOString().slice(0, 10);
    await page.evaluate(({ savedAt, day, due }) => localStorage.setItem('invoiceDraft:invoice', JSON.stringify({
      savedAt,
      values: {
        customerId: 'c1', invoiceNumber: 'INV-005', currency: 'NGN', dateIssued: day, dueDate: due,
        items: [{ description: 'Old order', quantity: 1, unitPrice: 9000 }], discountType: 'percentage', discountRate: 0,
        taxRate: 0, taxLabel: 'VAT', notes: '', deliveryDate: '', plan: [], costs: [], depositAmount: 0,
      },
    })), { savedAt: tenDaysAgo.toISOString(), day, due });
    await page.reload();
    await app.go('New');

    await expect(page.getByPlaceholder(/^Item description/)).toHaveValue('Old order');
    await expect(page.getByLabel(/^Invoice #/)).toHaveValue('INV-006'); // INV-005 has been used since
    const today = new Date(); // the form uses the phone's local calendar day
    const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await expect(page.getByLabel(/^Invoice Date/)).toHaveValue(local);
  });

  test('erasing all data also erases drafts', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('New');
    await page.getByPlaceholder(/^Item description/).fill('Secret order');
    await app.goSettings('Data and security');
    await page.getByRole('button', { name: /Erase everything on this device/ }).click();
    await page.getByLabel('Type ERASE to confirm').fill('ERASE');
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Erase everything', exact: true }).click()]);
    expect(await page.evaluate(() => localStorage.getItem('invoiceDraft:invoice'))).toBeNull();
  });
});
