import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { TrendingUp, Clock, FileText, Wallet, AlertCircle, DatabaseBackup, ShieldAlert } from 'lucide-react';
import { isBackupDue } from '../../db/backup';
import { Reports } from './Reports';
import { FollowUps } from './FollowUps';
import type { AppTab, CurrencyCode } from '../../types';
import { CURRENCY_CODES, formatMoney } from '../../lib/currency';
import { getAmountCollected, getBalance, getDisplayStatus, getUnconfirmedAmount, isQuote, todayInputValue } from '../../lib/invoice';
import { clsx } from 'clsx';

export function Dashboard({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  // 1. Fetch Invoices & Profile
  const data = useLiveQuery(async () => {
    const invoices = await db.invoices.toArray();
    const profile = await db.businessProfile.orderBy('id').first();
    const customers = await db.customers.toArray();
    return { invoices, profile, customers };
  });

  // 2. Calculate Stats based on selected Currency
  const stats = useMemo(() => {
    if (!data?.invoices) return { collected: 0, unconfirmed: 0, pending: 0, overdue: 0, overdueCount: 0, count: 0, recent: [] };

    // Filter by currency
    // Quotes are estimates, not money owed
    const filtered = data.invoices.filter(inv => !isQuote(inv) && inv.currency === currency);

    const collected = filtered.reduce((sum, inv) => sum + getAmountCollected(inv), 0);
    const unconfirmed = filtered.reduce((sum, inv) => sum + getUnconfirmedAmount(inv), 0);
    const pending = filtered.reduce((sum, inv) => sum + getBalance(inv), 0);
    const today = todayInputValue();
    const overdueInvoices = filtered.filter(inv => getDisplayStatus(inv, today) === 'overdue');
    const overdue = overdueInvoices.reduce((sum, inv) => sum + getBalance(inv), 0);

    // Get 3 most recent invoices with customer names
    const recent = [...filtered]
      .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime())
      .slice(0, 3)
      .map(inv => {
        const customer = data.customers.find(c => c.id === inv.customerId);
        return { ...inv, customerName: customer?.name || 'Unknown', displayStatus: getDisplayStatus(inv, today) };
      });

    return { collected, unconfirmed, pending, overdue, overdueCount: overdueInvoices.length, count: filtered.length, recent };
  }, [data, currency]);

  return (
    <div className="space-y-8 pb-28">
      {/* Header & Currency Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            {data?.profile ? `Welcome back, ${data.profile.ownerName || 'there'}` : 'Overview'}
          </p>
        </div>

        <div className="bg-white/5 p-1 rounded-lg inline-flex">
          {CURRENCY_CODES.map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                currency === c ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {(data?.invoices.length ?? 0) > 0 && isBackupDue() && (
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 text-left hover:bg-orange-500/15 transition-colors"
        >
          <DatabaseBackup size={20} className="text-orange-300 shrink-0" />
          <span className="text-sm text-orange-100">
            <strong>Back up your data.</strong> Everything is stored only on this device. Save a backup in Settings &rarr;
          </span>
        </button>
      )}

      {data && data.invoices.length > 0 && (
        <FollowUps invoices={data.invoices} customers={data.customers} business={data.profile} onNavigate={onNavigate} />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Cash Collected</h3>
          <p className="text-3xl font-bold text-white mt-2">
            {formatMoney(stats.collected, currency)}
          </p>
          {stats.unconfirmed > 0 ? (
            <button onClick={() => onNavigate('invoices')} className="mt-4 text-xs text-amber-300 flex items-center gap-1 hover:underline text-left">
              <ShieldAlert size={14} />
              <span>+ {formatMoney(stats.unconfirmed, currency)} in transfers to check in your bank</span>
            </button>
          ) : (
            <div className="mt-4 text-xs text-green-400 flex items-center gap-1">
              <TrendingUp size={14} />
              <span>Actual cash in hand</span>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={80} />
          </div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Pending / Outstanding</h3>
          <p className="text-3xl font-bold text-orange-400 mt-2">
            {formatMoney(stats.pending, currency)}
          </p>
          <div className={clsx("mt-4 text-xs flex items-center gap-1", stats.overdueCount > 0 ? "text-red-400" : "text-orange-400/80")}>
            <AlertCircle size={14} />
            <span>
              {stats.overdueCount > 0
                ? `${formatMoney(stats.overdue, currency)} overdue on ${stats.overdueCount} invoice${stats.overdueCount === 1 ? '' : 's'}`
                : 'Money owed to you'}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText size={80} />
          </div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Invoices</h3>
          <p className="text-3xl font-bold text-indigo-400 mt-2">
            {stats.count}
          </p>
          <div className="mt-4 text-xs text-slate-500">
            In selected currency ({currency})
          </div>
        </GlassCard>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="grid gap-3">
          {stats.recent.map(inv => (
            <GlassCard key={inv.id} className="p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm">{inv.customerName}</h4>
                  <p className="text-xs text-slate-500">#{inv.invoiceNumber}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-sm">
                  {formatMoney(inv.grandTotal, inv.currency)}
                </p>
                <p className={clsx(
                  "text-[10px] uppercase font-bold",
                  inv.displayStatus === 'paid' ? "text-green-400" : inv.displayStatus === 'overdue' ? "text-red-400" : "text-orange-400"
                )}>
                  {inv.displayStatus}
                </p>
              </div>
            </GlassCard>
          ))}

          {stats.recent.length === 0 && (
             <GlassCard className="p-8 text-center border-dashed border-white/10 bg-transparent">
               <p className="text-slate-500 text-sm">No invoices found for {currency}.</p>
               <button onClick={() => onNavigate('create')} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                 Create your first invoice &rarr;
               </button>
             </GlassCard>
          )}
        </div>
      </div>

      {data && data.invoices.length > 0 && (
        <Reports invoices={data.invoices} customers={data.customers} currency={currency} />
      )}
    </div>
  );
}