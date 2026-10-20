import { AlertTriangle, RefreshCw } from 'lucide-react';

interface FatalErrorProps {
  title: string;
  children: React.ReactNode;
}

/** Full-screen stop sign for failures the app cannot work around. Plain markup on purpose: it must render even when other UI is what broke. */
export function FatalError({ title, children }: FatalErrorProps) {
  return (
    <main role="alert" className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-line bg-sunken p-6 text-center space-y-4">
        <AlertTriangle className="mx-auto text-warning" size={36} />
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <div className="text-sm text-muted space-y-2">{children}</div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-medium"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </main>
  );
}
