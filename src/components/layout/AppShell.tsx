import { LayoutDashboard, FileText, Settings, PlusCircle, Menu, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { AppTab } from '../../types';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (id: AppTab) => void;
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  const navItems: { id: AppTab; label: string; icon: LucideIcon; isPrimary?: boolean }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'create', label: 'New', icon: PlusCircle, isPrimary: true },
    { id: 'customers', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen text-white/90 selection:bg-indigo-500/30">

      {/* Background Ambient Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      {/* Main Content Area */}
      <main className="pb-24 pt-8 px-4 md:pl-24 md:pt-12 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="mx-4 mb-4 rounded-2xl border border-[var(--color-glass-border)] bg-[#0f172a]/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex justify-around items-center p-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
                  activeTab === item.id ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white/5 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <item.icon
                  size={item.isPrimary ? 28 : 24}
                  className={item.isPrimary ? "text-indigo-400 drop-shadow-lg" : ""}
                />
                <span className="text-[10px] font-medium mt-1 opacity-80">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-8 border-r border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-md">
        <div className="mb-8 p-2 bg-indigo-500/20 rounded-lg">
          <Menu size={24} className="text-indigo-400" />
        </div>

        <div className="flex flex-col gap-6 w-full px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`group relative flex items-center justify-center p-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-white/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <item.icon size={24} className="transition-transform group-hover:scale-110" />
              <span className="absolute left-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </aside>

    </div>
  );
}