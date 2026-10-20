import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

const RECOVERY_CODE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

// S4: protecting the data you cannot get back: backup, erase, restore, and the App Lock.
test.describe('protect and recover', () => {
  test('backup, erase everything, restore: nothing is lost', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 20000 }] });
    await app.goSettings('Data and security');

    // Back up
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save Backup' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^merchmate-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = test.info().outputPath('backup.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    expect(backup.data.invoices).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain('"pin"'); // App Lock secrets never travel in a backup

    // Erase everything (needs ERASE typed)
    await page.getByRole('button', { name: /Erase everything on this device/ }).click();
    const erase = page.getByRole('button', { name: 'Erase everything', exact: true });
    await expect(erase).toBeDisabled();
    await page.getByLabel('Type ERASE to confirm').fill('ERASE');
    await Promise.all([page.waitForEvent('load'), erase.click()]);
    await expect(app.nav('Home')).toBeVisible();
    expect(await app.recordCount()).toBe(0);

    // Restore
    await app.goSettings('Data and security');
    await page.locator('input[type=file][accept*="json"]').setInputFiles(backupPath);
    const confirmRestore = page.getByRole('alertdialog', { name: 'Restore this backup?' });
    await expect(confirmRestore).toContainText('REPLACES everything');
    await confirmRestore.getByRole('button', { name: 'Replace everything' }).click();
    await expect(page.getByText('Restored 1 invoices and 1 clients.')).toBeVisible();
    await app.go('Invoices');
    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(page.getByText('Due: ₦30,000.00')).toBeVisible();
  });

  test('a hostile backup is refused and nothing changes', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 1000 }] });
    await app.goSettings('Data and security');
    await page.locator('input[type=file][accept*="json"]').setInputFiles({
      name: 'evil.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'merchmate-backup', version: 1, exportedAt: new Date().toISOString(),
        data: { businessProfile: [{ businessName: 'x', logoUrl: 'https://tracker.example/p.png' }], customers: [], invoices: [], catalog: [] },
      })),
    });
    await expect(page.getByText(/damaged or incomplete/)).toBeVisible();
    await app.go('Invoices');
    await expect(page.getByText('#INV-001')).toBeVisible();
  });

  test('App Lock: set up, lock on open, wrong PIN, recovery code, new PIN', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 1000 }] });
    await app.goSettings('Data and security');

    // Turn on (mismatched PINs are refused)
    await page.getByRole('button', { name: 'Turn on App Lock' }).click();
    await page.getByLabel('Choose a PIN (4 to 8 digits)').fill('4821');
    await page.getByLabel('Repeat the PIN').fill('4822');
    await expect(page.getByText('The two PINs are different.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on', exact: true })).toBeDisabled();
    await page.getByLabel('Repeat the PIN').fill('4821');
    await page.getByRole('button', { name: 'Turn on', exact: true }).click();

    // The recovery code is shown once and must be acknowledged
    const code = (await page.locator('p.font-mono').innerText()).trim();
    expect(code).toMatch(RECOVERY_CODE);
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByLabel('I have saved my recovery code').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Back up your data now')).toBeVisible();
    await page.getByRole('button', { name: 'Later' }).click();
    const stored = await page.evaluate(() => localStorage.getItem('appLock') ?? '');
    expect(stored).not.toContain('4821');
    expect(stored).not.toContain(code.replace(/-/g, ''));

    // Reopening shows only the lock: no client data in the page
    await page.reload();
    await expect(page.getByRole('heading', { name: 'MerchMate is locked' })).toBeVisible();
    expect(await page.content()).not.toContain('INV-001');
    await page.getByLabel('PIN', { exact: true }).fill('0000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Wrong PIN. 4 tries left before a wait.')).toBeVisible();

    // Forgot the PIN: the recovery code sets a new one and issues a new code
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();
    await page.getByLabel('Recovery code').fill(code.toLowerCase());
    await page.getByLabel('New PIN (4 to 8 digits)').fill('9753');
    await page.getByRole('button', { name: 'Set new PIN' }).click();
    const newCode = (await page.locator('p.font-mono').innerText()).trim();
    expect(newCode).toMatch(RECOVERY_CODE);
    expect(newCode).not.toBe(code);
    await page.getByLabel('I have saved my recovery code').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(app.nav('Home')).toBeVisible();

    // The old PIN is gone, the new one works
    await page.reload();
    await page.getByLabel('PIN', { exact: true }).fill('4821');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText(/Wrong PIN/)).toBeVisible();
    await page.getByLabel('PIN', { exact: true }).fill('9753');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(app.nav('Home')).toBeVisible();
  });

  test('App Lock: five wrong guesses force a wait; losing the PIN and code ends in erase', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 1000 }] });
    await app.goSettings('Data and security');
    await page.getByRole('button', { name: 'Turn on App Lock' }).click();
    await page.getByLabel('Choose a PIN (4 to 8 digits)').fill('2468');
    await page.getByLabel('Repeat the PIN').fill('2468');
    await page.getByRole('button', { name: 'Turn on', exact: true }).click();
    await page.getByLabel('I have saved my recovery code').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Later' }).click();
    await page.reload();

    const unlock = page.getByRole('button', { name: 'Unlock' });
    const wrongGuess = async (expected: string | RegExp) => {
      await page.getByLabel('PIN', { exact: true }).fill('0000');
      await unlock.click();
      await expect(page.getByRole('alert')).toContainText(expected);
    };
    await wrongGuess('4 tries left');
    await wrongGuess('3 tries left');
    await wrongGuess('2 tries left');
    await wrongGuess('1 try left');
    await wrongGuess(/Try again in/);
    await page.getByLabel('PIN', { exact: true }).fill('2468'); // even the right PIN waits
    await expect(page.getByRole('button', { name: 'Unlock' })).toBeDisabled();
    await page.reload();
    await expect(page.getByText(/Try again in/)).toBeVisible(); // the wait survives a reload

    await page.getByRole('button', { name: 'Forgot PIN?' }).click();
    await page.getByRole('button', { name: 'I lost my code' }).click();
    const erase = page.getByRole('button', { name: 'Erase this device' });
    await expect(erase).toBeDisabled();
    await page.getByLabel('Type ERASE to confirm').fill('ERASE');
    await erase.click();
    await expect(app.nav('Home')).toBeVisible();
    expect(await app.recordCount()).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('appLock'))).toBeNull();
  });
});
