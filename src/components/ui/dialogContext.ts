import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Marks a destructive action: shown in red, and the safe choice is focused first. */
  danger?: boolean;
}

export interface DialogApi {
  /** Asks a yes/no question. Resolves true on confirm, false on cancel or Escape. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Tells the user something and waits for them to acknowledge it. */
  alert: (message: string, title?: string) => Promise<void>;
}

export const DialogContext = createContext<DialogApi | null>(null);

/** In-app replacement for window.confirm and window.alert (styled, keyboard-friendly, never blocks the browser). */
export function useDialogs(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialogs needs a <DialogProvider> above it');
  return api;
}
