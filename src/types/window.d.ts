import type { Buffer } from 'buffer';

declare global {
  /** Build time, injected by Vite (`define` in vite.config.ts). */
  const __BUILD__: string;

  interface Window {
    Buffer: typeof Buffer;
  }
}
