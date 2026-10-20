import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Tells the user a new version is ready and lets them choose when to reload, so an update never
 * wipes a half-filled invoice. Also re-checks hourly: an installed app can stay open for days.
 */
export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => { registration.update().catch(() => undefined); }, UPDATE_CHECK_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed bottom-28 md:bottom-6 inset-x-4 md:left-auto md:right-6 md:w-80 z-[55] flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-2xl">
      <span className="text-sm text-ink">A new version of MerchMate is ready.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
      >
        <RefreshCw size={14} /> Update
      </button>
    </div>
  );
}
