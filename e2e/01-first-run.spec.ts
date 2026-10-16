import { expect, test } from './fixtures';

// S1: a brand-new user goes from an empty app to a first invoice.
test('first run: from an empty app to a first invoice', async ({ app, page }) => {
  await app.open();

  // The guide tells a new user where to begin
  const guide = page.getByRole('region', { name: 'Get started' });
  await expect(guide).toContainText('Add your business details');

  // Step 1: business details (and the form refuses bad input)
  await guide.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('input[name=businessName]').fill('Ade Fabrics');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Valid phone number required')).toBeVisible();
  await app.saveBusinessDetails();

  // Step 2: a client (an empty form is refused with a clear message)
  await app.go('Home');
  await expect(guide).toContainText('Add a client');
  await app.go('Clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Name is required')).toBeVisible();
  await page.getByPlaceholder('e.g. Mrs. Adebayo').fill('Mrs. Adebayo');
  await page.getByPlaceholder('080...').fill('08035554444');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Mrs. Adebayo')).toBeVisible();

  // Step 3: the invoice. Totals update as you type.
  await app.go('New');
  await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible();
  await page.getByLabel('Customer').selectOption({ index: 1 });
  await page.getByPlaceholder(/^Item description/).fill('Aso Oke set');
  await page.getByPlaceholder('Qty').fill('2');
  await page.getByPlaceholder('Price').fill('25000');
  await expect(page.getByText('₦50,000.00').first()).toBeVisible();
  await page.getByRole('button', { name: /Generate Invoice/ }).click();

  // It is listed with the first number and the right balance
  await expect(page.getByText('#INV-001')).toBeVisible();
  await expect(page.getByText('Mrs. Adebayo')).toBeVisible();
  await expect(page.getByText('Due: ₦50,000.00')).toBeVisible();

  // Setup is complete: the guide is gone
  await app.go('Home');
  await expect(page.getByText('Recent Activity')).toBeVisible();
  await expect(guide).toHaveCount(0);
});
