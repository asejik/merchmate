import { defineConfig } from '@playwright/test';

// Smoke tests of the real, built app in a real browser at phone width. Run with `npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0, // a retry on CI shows up as "flaky" in the report rather than hiding
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
    serviceWorkers: 'block', // the offline worker has its own check; it would only get in the way here
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
