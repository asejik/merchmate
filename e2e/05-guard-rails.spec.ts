import { expect, test } from './fixtures';

// S5: unsaved-work protection, keyboard behaviour of windows, accessibility, reduced motion.
test.describe('guard rails', () => {
  test('leaving an edit of an existing invoice asks first; saving or an untouched form does not', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000 }] });
    const ask = page.getByRole('alertdialog', { name: 'Discard your changes?' });
    const openEditor = async () => {
      await app.go('Invoices');
      await page.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await expect(page.getByRole('heading', { name: 'Edit Invoice' })).toBeVisible();
    };

    // Untouched edit form: leave freely
    await openEditor();
    await app.go('Home');
    await expect(ask).toHaveCount(0);

    // Changed something: tab bar, Back arrow and "New" all ask, and "Keep editing" keeps the change
    await openEditor();
    await page.getByLabel(/^Notes/).fill('Collect on Friday');
    for (const leave of [() => app.go('Home'), () => page.getByRole('button', { name: 'Back' }).click(), () => app.go('New')]) {
      await leave();
      await expect(ask).toContainText('unsaved changes');
      await ask.getByRole('button', { name: 'Keep editing' }).click();
      await expect(page.getByLabel(/^Notes/)).toHaveValue('Collect on Friday');
    }

    // Saving does not ask
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('#INV-001')).toBeVisible();
    await expect(ask).toHaveCount(0);

    // Choosing Discard leaves, and the change is not saved
    await openEditor();
    await page.getByLabel(/^Notes/).fill('temporary');
    await app.go('Home');
    await ask.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Invoice' })).toHaveCount(0);
    await openEditor();
    await expect(page.getByLabel(/^Notes/)).toHaveValue('Collect on Friday'); // the saved note, not "temporary"
  });

  test('windows close with Escape and give focus back', async ({ app, page }) => {
    await app.open();
    await app.seed({ logo: true, invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 10000 }] });
    await app.go('Invoices');

    const pay = page.getByRole('button', { name: 'Record payment' });
    await pay.click();
    await expect(page.getByRole('dialog', { name: 'Record Payment' })).toBeVisible();
    await expect(page.getByLabel('New Amount')).toBeFocused(); // focus moves in
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(pay).toBeFocused(); // and back out

    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Share PDF' }).click();
    await expect(page.getByRole('dialog', { name: 'Ready to Send' })).toBeVisible({ timeout: 40_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('key screens have no accessibility violations (WCAG 2.2 AA)', async ({ app, page }) => {
    test.setTimeout(180_000); // several strict scans in one test: slow runners need the room
    await app.open();
    await app.seed({ invoices: [
      { id: 'i1', number: 'INV-001', total: 50000, paid: 20000, dueInDays: -3 },
      { id: 'i2', number: 'INV-002', total: 30000 },
    ] });

    const screens: [string, () => Promise<void>][] = [
      ['dashboard', async () => { await app.go('Home'); await expect(page.getByText('Recent Activity')).toBeVisible(); }],
      ['invoice list', async () => { await app.go('Invoices'); await expect(page.getByText('#INV-002')).toBeVisible(); }],
      ['new invoice', async () => { await app.go('New'); await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible(); }],
      ['clients', async () => { await app.go('Clients'); await expect(page.getByText('Mrs. Adebayo')).toBeVisible(); }],
      ['settings: your business', async () => { await app.goSettings('Your business'); await expect(page.getByText('Brand identity')).toBeVisible(); }],
      ['settings: data and security', async () => { await app.goSettings('Data and security'); await expect(page.getByText('Erase All Data')).toBeVisible(); }],
    ];
    for (const [name, show] of screens) {
      await show();
      expect(await app.accessibilityViolations(), name).toEqual([]);
    }

    await app.go('Invoices');
    await page.getByRole('button', { name: 'Record payment' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await app.accessibilityViolations(), 'payment window').toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(await app.accessibilityViolations(), 'confirmation dialog').toEqual([]);
  });

  test('with "reduce motion" on, nothing keeps animating', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 1000 }] });
    const running = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => {
      const style = getComputedStyle(el);
      const ms = style.animationDuration.split(',').map(d => (d.trim().endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000));
      return style.animationName !== 'none' && Math.max(...ms) >= 1;
    }).length);
    expect(running).toBe(0);
  });
});
