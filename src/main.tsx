import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { DialogProvider } from './components/ui/DialogProvider';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installErrorCapture } from './lib/diagnostics';
import './index.css';

// FIX: Polyfill Buffer for @react-pdf/renderer
import { Buffer } from 'buffer';

// TypeScript will now accept this because of window.d.ts
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

installErrorCapture();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Honour the phone's "reduce motion" setting for Framer Motion animations too */}
      <MotionConfig reducedMotion="user">
        <DialogProvider>
          <App />
        </DialogProvider>
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>,
);