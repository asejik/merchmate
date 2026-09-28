import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // Import 1
import { VitePWA } from 'vite-plugin-pwa';                 // Import 2

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
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false // Disable PWA logic in local dev to prevent caching issues
      },
      manifest: {
        name: 'MerchMate - Smart Invoicing',
        short_name: 'MerchMate',
        description: 'Offline-first invoicing for small businesses. Create, share and track invoices from your phone.',

        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png', // Must match your filename in /public
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // Must match your filename in /public
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Good for Android adaptive icons
          }
        ]
      }
    })
  ],
  define: {
    global: 'window',
  },
});