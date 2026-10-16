import { expect, test } from './fixtures';

// S3: PDFs, images and receipts are produced with the production security headers applied.
// This is the check that catches a Content-Security-Policy that quietly breaks the PDF engine.
test.describe('sharing', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.seed({ logo: true, invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 20000 }] });
  });

  test('an invoice is offered as PDF, image and WhatsApp text', async ({ app, page }) => {
    await app.go('Invoices');
    await page.getByRole('button', { name: 'Share PDF' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ready to Send' });
    await expect(dialog).toBeVisible({ timeout: 40_000 });
    await expect(dialog.getByRole('button', { name: 'Share as PDF' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Share as Image' })).toBeVisible();
    const whatsapp = dialog.getByRole('link', { name: 'Send as WhatsApp Text' });
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/2348035554444\?text=/);
    await expect(whatsapp).toHaveAttribute('rel', /noopener/);
  });

  test('the invoice PDF downloads', async ({ app, page }) => {
    await app.go('Invoices');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 40_000 }),
      page.getByRole('button', { name: 'Download PDF' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('INV-001.pdf');
  });

  test('a payment has a receipt', async ({ app, page }) => {
    await app.go('Invoices');
    await page.getByRole('button', { name: /Receipt for payment of ₦20,000/ }).click();
    await expect(page.getByRole('dialog', { name: 'Receipt Ready' })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('dialog')).toContainText('INV-001-R1');
  });

  test('a client statement is produced', async ({ app, page }) => {
    await app.go('Clients');
    await page.getByRole('button', { name: /Account statement for Mrs. Adebayo/ }).click();
    await expect(page.getByRole('dialog', { name: 'Statement Ready' })).toBeVisible({ timeout: 40_000 });
  });
});
