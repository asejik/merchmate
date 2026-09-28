import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { TrendingUp, Clock, FileText, Wallet, AlertCircle } from 'lucide-react';
import type { CurrencyCode } from '../../types';
import { clsx } from 'clsx';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
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
    if (!data?.invoices) return { collected: 0, pending: 0, count: 0, recent: [] };

    // Filter by currency
    const filtered = data.invoices.filter(inv => inv.currency === currency);

    let collected = 0;
    let pending = 0;

    filtered.forEach(inv => {
      // Logic: If Paid, collected is full amount. If Partial/Pending, collected is just deposit.
      const isPaid = inv.status === 'paid';
      const cashIn = isPaid ? inv.grandTotal : inv.depositAmount;
      const balance = inv.grandTotal - cashIn;

      collected += cashIn;
      pending += balance;
    });

    // Get 3 most recent invoices with customer names
    const recent = filtered
      .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime())
      .slice(0, 3)
      .map(inv => {
        const customer = data.customers.find(c => c.id === inv.customerId);
        return { ...inv, customerName: customer?.name || 'Unknown' };
      });

    return { collected, pending, count: filtered.length, recent };
  }, [data, currency]);

  const CURRENCIES: CurrencyCode[] = ['NGN', 'USD', 'GBP', 'EUR'];

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
          {CURRENCIES.map(c => (
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Cash Collected</h3>
          <p className="text-3xl font-bold text-white mt-2">
            {currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}
            {stats.collected.toLocaleString()}
          </p>
          <div className="mt-4 text-xs text-green-400 flex items-center gap-1">
            <TrendingUp size={14} />
            <span>Actual cash in hand</span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={80} />
          </div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Pending / Outstanding</h3>
          <p className="text-3xl font-bold text-orange-400 mt-2">
            {currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}
            {stats.pending.toLocaleString()}
          </p>
          <div className="mt-4 text-xs text-orange-400/80 flex items-center gap-1">
            <AlertCircle size={14} />
            <span>Money owed to you</span>
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
                  {inv.currency} {inv.grandTotal.toLocaleString()}
                </p>
                <p className={clsx(
                  "text-[10px] uppercase font-bold",
                  inv.status === 'paid' ? "text-green-400" : "text-orange-400"
                )}>
                  {inv.status}
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
    </div>
  );
}