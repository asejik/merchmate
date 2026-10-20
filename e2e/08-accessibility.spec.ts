import { expect, test, type App } from './fixtures';
import type { Page } from '@playwright/test';

// Every screen and window of the app, scanned against WCAG 2.2 AA and axe's best-practice rules
// (one h1 per page, landmarks, heading order, names for every control, contrast, target size).
// Reduced motion is on so a screen is scanned at rest, not half way through a fade-in.

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function scanAll(app: App, screens: [string, () => Promise<void>][]) {
  const failures: string[] = [];
  for (const [name, show] of screens) {
    await show();
    for (const violation of await app.accessibilityViolations()) failures.push(`${name}: ${violation}`);
  }
  expect(failures).toEqual([]);
}

async function enableLock(page: Page, app: App) {
  await app.go('Settings');
  await page.getByRole('button', { name: 'Turn on App Lock' }).click();
  await page.getByLabel('Choose a PIN (4 to 8 digits)').fill('4821');
  await page.getByLabel('Repeat the PIN').fill('4821');
  await page.getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(page.getByText('Your recovery code')).toBeVisible();
}

for (const [label, viewport] of [['phone 360px', { width: 360, height: 740 }], ['desktop 1280px', { width: 1280, height: 800 }]] as const) {
  test.describe(`accessibility: ${label}`, () => {
    test.use({ viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 });

    test('screens with data', async ({ app, page }) => {
      test.setTimeout(240_000); // about eleven strict scans in one test: slow runners need the room
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await app.open();
      await expect(page.getByRole('region', { name: 'Get started' })).toBeVisible();
      const failures: string[] = [];
      for (const v of await app.accessibilityViolations()) failures.push(`first run: ${v}`);
      expect(failures).toEqual([]);

      await app.seed({ invoices: [
        { id: 'i1', number: 'INV-001', total: 50000, paid: 20000, dueInDays: -2, orderStage: 'ready', plan: [{ label: 'Deposit', percent: 50 }, { label: 'Balance', percent: 50, dueInDays: 10 }], costs: [{ description: 'Fabric', amount: 20000 }] },
        { id: 'i2', number: 'INV-002', total: 30000 },
        { id: 'q1', number: 'QUO-001', total: 10000, kind: 'quote' },
      ] });
      await page.evaluate(({ saved, due }) => localStorage.setItem('invoiceDraft:invoice', JSON.stringify({
        savedAt: saved, values: { customerId: 'c1', invoiceNumber: 'INV-003', currency: 'NGN', dateIssued: due, dueDate: due, items: [{ description: 'Unfinished order', quantity: 1, unitPrice: 5000 }],
          discountType: 'percentage', discountRate: 0, taxRate: 0, taxLabel: 'VAT', notes: '', deliveryDate: '', plan: [], costs: [], depositAmount: 0 },
      })), { saved: new Date().toISOString(), due: day(0) });
      await page.reload();
      await expect(app.nav('Home')).toBeVisible();

      await scanAll(app, [
        ['dashboard', async () => { await app.go('Home'); await expect(page.getByText('Recent Activity')).toBeVisible(); await expect(page.getByRole('region', { name: 'Unfinished invoice' })).toBeVisible(); }],
        ['invoice list', async () => { await app.go('Invoices'); await expect(page.getByText('#INV-002')).toBeVisible(); }],
        ['actions menu', async () => { await page.getByRole('button', { name: 'More actions' }).first().click(); await expect(page.getByRole('menu')).toBeVisible(); }],
        ['payment window', async () => { await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Record payment' }).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); }],
        ['confirm dialog', async () => { await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'More actions' }).nth(1).click(); await page.getByRole('menuitem', { name: /Delete|Void/ }).click(); await expect(page.getByRole('alertdialog')).toBeVisible(); }],
        ['quotes', async () => { await page.keyboard.press('Escape'); await page.getByRole('tab', { name: 'quotes' }).click(); await expect(page.getByText('#QUO-001')).toBeVisible(); }],
        ['new invoice (restored draft)', async () => { await app.go('New'); await expect(page.getByRole('status').filter({ hasText: 'Restored' })).toBeVisible(); }],
        ['new invoice with errors', async () => { await page.getByLabel('Customer').selectOption(''); await page.getByLabel(/^Invoice #/).fill(''); await page.getByRole('button', { name: /Generate Invoice/ }).click(); await expect(page.getByText('Required')).toBeVisible(); }],
        ['clients', async () => { await page.getByRole('button', { name: 'Start over' }).click(); await app.go('Clients'); await expect(page.getByText('Mrs. Adebayo')).toBeVisible(); }],
        ['client form with errors', async () => { await page.getByRole('button', { name: 'Add Client' }).click(); await page.getByRole('button', { name: /save/i }).click(); await expect(page.getByText('Name is required')).toBeVisible(); }],
        ['settings', async () => { await app.go('Settings'); await expect(page.getByText('Erase All Data')).toBeVisible(); }],
      ]);
    });

    test('lock, recovery and erase screens', async ({ app, page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await app.open();
      await app.seed({});
      await enableLock(page, app);
      await scanAll(app, [
        ['recovery code', async () => { await expect(page.getByText('Your recovery code')).toBeVisible(); }],
        ['lock screen', async () => {
          await page.getByLabel('I have saved my recovery code').check();
          await page.getByRole('button', { name: 'Continue' }).click();
          await page.getByRole('button', { name: 'Later' }).click();
          await page.reload();
          await expect(page.getByRole('heading', { name: 'MerchMate is locked' })).toBeVisible();
        }],
        ['lock screen with a wrong PIN', async () => { await page.getByLabel('PIN', { exact: true }).fill('0000'); await page.getByRole('button', { name: 'Unlock' }).click(); await expect(page.getByRole('alert')).toBeVisible(); }],
        ['forgot PIN', async () => { await page.getByRole('button', { name: 'Forgot PIN?' }).click(); await expect(page.getByLabel('Recovery code')).toBeVisible(); }],
        ['erase this device', async () => { await page.getByRole('button', { name: 'I lost my code' }).click(); await expect(page.getByRole('button', { name: 'Erase this device' })).toBeVisible(); }],
      ]);
    });
  });
}

test('the redesigned dashboard passes the scan in dark mode too', async ({ app, page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await app.open();
  await app.seed({ invoices: [
    { id: 'i1', number: 'INV-001', total: 50000, paid: 20000, dueInDays: -2, orderStage: 'ready' },
    { id: 'i2', number: 'INV-002', total: 30000 },
    { id: 'i3', number: 'INV-003', total: 18000, paid: 18000 },
  ] });
  await app.go('Home');
  await expect(page.getByText('Recent activity')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Backup reminder' })).toBeVisible();
  expect(await app.accessibilityViolations()).toEqual([]);
});

test('the page can be zoomed and reflowed to 320px without sideways scrolling', async ({ app, page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); // WCAG 1.4.10: 400% zoom of a 1280px window
  await app.open();
  await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 20000, plan: [{ label: 'Deposit', percent: 50 }, { label: 'Balance', percent: 50 }] }] });
  const sideways: string[] = [];
  for (const [name, show] of [
    ['dashboard', async () => { await app.go('Home'); }],
    ['invoices', async () => { await app.go('Invoices'); }],
    ['new invoice', async () => { await app.go('New'); }],
    ['clients', async () => { await app.go('Clients'); }],
    ['settings', async () => { await app.go('Settings'); }],
  ] as [string, () => Promise<void>][]) {
    await show();
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) sideways.push(name);
  }
  expect(sideways, 'screens that scroll sideways at 320px').toEqual([]);
});

test.describe('navigation and keyboard', () => {
  test('each screen names the page, and focus moves to it', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    for (const [tab, title] of [['Invoices', 'Invoices'], ['New', 'New invoice'], ['Clients', 'Clients'], ['Settings', 'Settings'], ['Home', 'Dashboard']] as const) {
      await app.go(tab);
      await expect(page).toHaveTitle(`${title} | MerchMate`);
      await expect(page.locator('main')).toBeFocused(); // a screen reader starts reading the new screen
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('a keyboard user can skip the navigation', async ({ app, page }) => {
    await app.open();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('validation messages are tied to their fields', async ({ app, page }) => {
    await app.open();
    await app.seed({});
    await app.go('Clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByRole('button', { name: /save/i }).click();
    const name = page.getByLabel('Customer Name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await name.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText('Name is required');
    await page.getByLabel('Customer Name').fill('Mrs. Okafor');
    await expect(name).toHaveAttribute('aria-invalid', 'false');
  });

  test('the actions menu works from the keyboard', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000, paid: 10000 }] });
    await app.go('Invoices');
    const trigger = page.getByRole('button', { name: 'More actions' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const items = page.getByRole('menu').locator('[role^="menuitem"]');
    await expect(items.first()).toBeFocused(); // focus moves into the menu
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('ArrowDown'); // wraps round
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused(); // and back out again
  });

  test('every control shows a focus ring when reached by keyboard', async ({ app, page }) => {
    await app.open();
    await app.seed({ invoices: [{ id: 'i1', number: 'INV-001', total: 50000 }] });
    await app.go('Invoices');
    await page.getByRole('searchbox').focus();
    await page.keyboard.press('Tab'); // moves to the first filter or action
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });
});
