import { useEffect, useRef } from 'react';
import { Home, FileText, Settings, Plus, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { AppTab } from '../../types';
import { Logo } from '../ui/Logo';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (id: AppTab) => void;
}

/** Names shown in the browser tab and announced by screen readers when the screen changes. */
const SCREEN_TITLES: Record<AppTab, string> = {
  dashboard: 'Dashboard',
  invoices: 'Invoices',
  create: 'New invoice',
  customers: 'Clients',
  settings: 'Settings',
};

/** Screens already in the new design. The others are still written for a dark surface (see index.css). */
const REDESIGNED: AppTab[] = ['dashboard', 'invoices'];

const NAV_ITEMS: { id: AppTab; label: string; icon: LucideIcon; isPrimary?: boolean }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'create', label: 'New', icon: Plus, isPrimary: true },
  { id: 'customers', label: 'Clients', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Name the page, and move keyboard and screen-reader focus to the new screen when it changes
  useEffect(() => {
    document.title = `${SCREEN_TITLES[activeTab]} | MerchMate`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [activeTab]);

  return (
    <div data-surface={REDESIGNED.includes(activeTab) ? undefined : 'dark'} className="min-h-screen bg-paper text-ink selection:bg-primary-tint">
      <a
        href="#main"
        onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Skip to main content
      </a>

      {/* Phone header: the desktop sidebar carries the logo instead */}
      <header className="md:hidden px-4 pt-4 pb-2">
        <Logo wordmark size={28} />
      </header>

      <div className="md:pl-64">
        <main id="main" ref={mainRef} tabIndex={-1} className="pb-28 pt-4 px-4 md:px-10 md:pt-10 md:pb-12 max-w-4xl mx-auto focus:outline-none">
          {children}
        </main>
      </div>

      {/* Phone: bottom navigation */}
      <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-line bg-surface">
        <div className="flex items-center gap-1 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return item.isPrimary ? (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="shrink-0 flex items-center gap-1 min-h-11 px-3 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover transition-colors duration-150"
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            ) : (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-1 min-w-11 flex-col items-center justify-center min-h-11 px-0.5 pt-1 text-xs font-medium transition-colors duration-150 ${active ? 'text-primary' : 'text-muted hover:text-ink'}`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-marker"
                    aria-hidden="true"
                    className="absolute -top-2 h-[3px] w-6 rounded-full bg-accent"
                    transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
                  />
                )}
                <item.icon size={22} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop: labelled sidebar */}
      <nav aria-label="Main" className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col gap-1 px-4 py-8 border-r border-line bg-surface">
        <div className="px-2 pb-8">
          <Logo wordmark size={32} />
        </div>
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return item.isPrimary ? (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="my-2 flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-hover transition-colors duration-150"
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </button>
          ) : (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 min-h-11 px-3 rounded-xl text-sm font-medium transition-colors duration-150 ${active ? 'bg-primary-tint text-primary' : 'text-muted hover:bg-sunken hover:text-ink'}`}
            >
              <item.icon size={20} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
