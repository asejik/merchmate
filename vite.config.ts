import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // Import 1
import { VitePWA } from 'vite-plugin-pwa';                 // Import 2
import { execSync } from 'node:child_process';

/**
 * Names this version of the code for problem reports. It comes from the source files, not the clock:
 * a build time would change the main bundle on every deploy, so every installed app would download
 * it again (and offer an update) even for a docs-only commit.
 */
function sourceId(): string {
  try {
    const git = (command: string) => execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return git('git status --porcelain -- src') === '' ? git('git rev-parse --short=8 HEAD:src') : 'local';
  } catch {
    return 'unknown'; // no git here (a source download): the report still works
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 1. Node Polyfills for PDF generation
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    // 2. PWA Configuration
    VitePWA({
      // 'prompt': the new version waits until the user taps Update (see UpdateBanner)
      registerType: 'prompt',
      workbox: {
        // The lazily loaded PDF engine (~1.3 MB) must be precached or PDFs fail offline.
        // Workbox silently skips files above its 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false // Disable PWA logic in local dev to prevent caching issues
      },
      manifest: {
        id: '/',
        name: 'MerchMate - Smart Invoicing',
        short_name: 'MerchMate',
        description: 'Offline-first invoicing for small businesses. Create, share and track invoices from your phone.',

        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  test: {
    // Browser tests in e2e/ are run by Playwright (npm run test:e2e), not Vitest
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
  define: {
    global: 'window',
    // Shown in the problem report so a bug can be matched to a release
    __BUILD__: JSON.stringify(sourceId()),
  },
});