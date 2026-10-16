import { useMemo, useState, type ReactNode } from 'react';
import { DialogContext, type ConfirmOptions, type DialogApi } from './dialogContext';
import { useDialog } from './useDialog';

interface Pending {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string; // none = a notice with a single button
  danger: boolean;
  resolve: (confirmed: boolean) => void;
}

let nextId = 1;

function DialogWindow({ pending, onClose }: { pending: Pending; onClose: (confirmed: boolean) => void }) {
  // Escape means "no" for a question and "got it" for a notice
  const ref = useDialog<HTMLDivElement>(() => onClose(!pending.cancelLabel));
  const titleId = `dialog-title-${pending.id}`;
  const messageId = `dialog-message-${pending.id}`;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-white">{pending.title}</h2>
        <p id={messageId} className="mt-2 whitespace-pre-line text-sm text-slate-300">{pending.message}</p>
        <div className="mt-6 flex gap-3">
          {pending.cancelLabel && (
            <button type="button" onClick={() => onClose(false)} className="flex-1 min-h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium">
              {pending.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`flex-1 min-h-11 rounded-xl text-white font-medium ${pending.danger ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Provides confirm() and alert() to the whole app and shows them one at a time. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Pending[]>([]);

  const api = useMemo<DialogApi>(() => ({
    confirm: (options: ConfirmOptions) => new Promise<boolean>(resolve => {
      setQueue(q => [...q, {
        id: nextId++,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Yes',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve,
      }]);
    }),
    alert: (message: string, title = 'Notice') => new Promise<void>(resolve => {
      setQueue(q => [...q, { id: nextId++, title, message, confirmLabel: 'OK', danger: false, resolve: () => resolve() }]);
    }),
  }), []);

  const current = queue[0];
  const close = (confirmed: boolean) => {
    current?.resolve(confirmed);
    setQueue(q => q.slice(1));
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogWindow key={current.id} pending={current} onClose={close} />}
    </DialogContext.Provider>
  );
}
