import { expect, test } from './fixtures';

// S2: getting paid, receipts, unconfirmed transfers, and what happens to paid invoices.
test.describe('payments', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000 }] });
    await app.go('Invoices');
    await expect(app.page.getByText('#INV-001')).toBeVisible();
  });

  test('a cash payment lowers the balance and offers a receipt', async ({ page }) => {
    await page.getByRole('button', { name: 'Record payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Payment' });
    await dialog.getByLabel('New Amount').fill('20000');
    await dialog.getByRole('radio', { name: 'Cash' }).click();
    await dialog.getByRole('button', { name: 'Confirm Payment' }).click();

    await expect(page.getByRole('dialog', { name: 'Payment Recorded' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog')).toContainText('New balance: ₦30,000.00');
    await page.keyboard.press('Escape');

    await expect(page.getByText('Due: ₦30,000.00')).toBeVisible();
    await expect(page.getByText('+₦20,000.00')).toBeVisible();
    await expect(page.getByText('Partly paid', { exact: true })).toBeVisible();
  });

  test('a transfer you have not checked is held aside until you confirm it', async ({ page }) => {
    await page.getByRole('button', { name: 'Record payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Payment' });
    await dialog.getByLabel('New Amount').fill('50000');
    // Transfer is the default method and the bank check box is unticked
    await expect(dialog.getByRole('button', { name: 'Save as Awaiting Confirmation' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save as Awaiting Confirmation' }).click();

    await expect(page.getByText('₦50,000.00 unconfirmed')).toBeVisible();
    await expect(page.getByText('Due: ₦50,000.00')).toBeVisible(); // balance untouched

    await page.getByRole('button', { name: /Mark ₦50,000.00 transfer as received/ }).click();
    await expect(page.getByRole('dialog', { name: 'Payment Recorded' })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('span').getByText('Paid', { exact: true })).toBeVisible();
    await expect(page.getByText('unconfirmed')).toHaveCount(0);
  });

  test('an invoice with payments cannot be deleted, only voided and reinstated', async ({ page }) => {
    await page.getByRole('button', { name: 'Record payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Payment' });
    await dialog.getByLabel('New Amount').fill('10000');
    await dialog.getByRole('radio', { name: 'Cash' }).click();
    await dialog.getByRole('button', { name: 'Confirm Payment' }).click();
    await expect(page.getByRole('dialog', { name: 'Payment Recorded' })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Void' }).click();
    const confirmVoid = page.getByRole('alertdialog', { name: 'Void this invoice?' });
    await expect(confirmVoid).toContainText('handle any refund yourself');
    await confirmVoid.getByRole('button', { name: 'Void invoice' }).click();
    await expect(page.getByText('Void', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Reinstate' }).click();
    await expect(page.getByText('Due: ₦40,000.00')).toBeVisible();
  });
});
