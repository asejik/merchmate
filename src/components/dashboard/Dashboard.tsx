import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../ui/Card';
import { Chip, type ChipTone } from '../ui/Chip';
import { ShieldAlert } from 'lucide-react';
import { BackupReminder } from '../ui/BackupReminder';
import { Reports } from './Reports';
import { InstallHint } from '../ui/InstallHint';
import { GetStarted } from './GetStarted';
import { ContinueDraft } from './ContinueDraft';
import { FollowUps } from './FollowUps';
import type { AppTab, CurrencyCode } from '../../types';
import { CURRENCY_CODES, formatMoney } from '../../lib/currency';
import { todayInputValue } from '../../lib/invoice';
import { dashboardStats, greetingFor } from '../../lib/dashboardStats';
import { clsx } from 'clsx';

const STATUS: Record<string, { label: string; tone: ChipTone; text: string }> = {
  paid: { label: 'Paid', tone: 'success', text: 'text-success' },
  overdue: { label: 'Overdue', tone: 'danger', text: 'text-danger' },
  partial: { label: 'Partly paid', tone: 'warning', text: 'text-warning' },
  pending: { label: 'Unpaid', tone: 'warning', text: 'text-warning' },
};

export function Dashboard({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  const data = useLiveQuery(async () => {
    const invoices = await db.invoices.toArray();
    const profile = await db.businessProfile.orderBy('id').first();
    const customers = await db.customers.toArray();
    return { invoices, profile, customers };
  });

  const stats = useMemo(
    () => dashboardStats(data?.invoices ?? [], data?.customers ?? [], currency, todayInputValue()),
    [data, currency],
  );
  const money = (value: number) => formatMoney(value, currency, { trimZeros: true });
  const owner = data?.profile?.ownerName;
  const greeting = data?.profile ? `${greetingFor(new Date().getHours())}${owner ? `, ${owner}` : ''}` : 'Overview';

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Dashboard</h1>
      <InstallHint />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold text-ink">{greeting}</p>
        <div role="radiogroup" aria-label="Currency" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {CURRENCY_CODES.map(c => (
            <button
              key={c}
              role="radio"
              aria-checked={currency === c}
              onClick={() => setCurrency(c)}
              className={clsx(
                'min-h-9 min-w-11 px-3 rounded-lg text-xs font-semibold transition-colors duration-150',
                currency === c ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <GetStarted
          state={{ hasBusiness: !!data.profile?.businessName, clients: data.customers.length, invoices: data.invoices.length }}
          onNavigate={onNavigate}
        />
      )}

      <ContinueDraft dateFormat={data?.profile?.dateFormat} onContinue={() => onNavigate('create')} />

      <BackupReminder hasData={(data?.invoices.length ?? 0) > 0} />

      {/* The one number a seller opens the app for: what is still owed, and what is late */}
      <Card className="p-5" role="region" aria-labelledby="owed-heading">
        <h2 id="owed-heading" className="text-sm font-medium text-muted">Owed to you</h2>
        <p className="money mt-1 text-4xl font-extrabold tracking-tight text-ink">{money(stats.pending)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stats.overdueCount > 0 ? (
            <>
              <Chip tone="danger">{money(stats.overdue)} overdue</Chip>
              <span className="text-xs text-muted">on {stats.overdueCount} invoice{stats.overdueCount === 1 ? '' : 's'}</span>
            </>
          ) : stats.count > 0 ? (
            <Chip tone="success">{stats.pending > 0 ? 'Nothing overdue' : 'All paid up'}</Chip>
          ) : (
            <span className="text-xs text-muted">No invoices in {currency} yet.</span>
          )}
        </div>
        {stats.invoiced > 0 && (
          <div className="mt-5">
            <div className="h-2 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
              <div className="grow-width h-full rounded-full bg-primary" style={{ width: `${Math.round(stats.paidShare * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              <span className="money">{money(stats.paid)}</span> paid of <span className="money">{money(stats.invoiced)}</span> invoiced
            </p>
          </div>
        )}
      </Card>

      {data && data.invoices.length > 0 && (
        <FollowUps invoices={data.invoices} customers={data.customers} business={data.profile} onNavigate={onNavigate} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4" role="region" aria-labelledby="collected-heading">
          <h2 id="collected-heading" className="text-sm font-medium text-muted">Cash collected</h2>
          <p className="money mt-1 text-xl font-bold tracking-tight text-ink">{money(stats.collected)}</p>
          {stats.unconfirmed > 0 ? (
            <button onClick={() => onNavigate('invoices')} className="mt-2 flex min-h-11 items-start gap-1.5 text-left text-xs font-medium text-warning hover:underline">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>+ {money(stats.unconfirmed)} in transfers to check in your bank</span>
            </button>
          ) : (
            <p className="mt-2 text-xs text-muted">Actual cash in hand</p>
          )}
        </Card>
        <Card className="p-4" role="region" aria-labelledby="count-heading">
          <h2 id="count-heading" className="text-sm font-medium text-muted">Invoices</h2>
          <p className="money mt-1 text-xl font-bold tracking-tight text-ink">{stats.count}</p>
          <p className="mt-2 text-xs text-muted">In {currency}, not voided</p>
        </Card>
      </div>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3 text-base font-bold text-ink">Recent activity</h2>
        {stats.recent.length > 0 ? (
          <Card className="divide-y divide-line">
            {stats.recent.map(inv => {
              const status = STATUS[inv.displayStatus] ?? STATUS.pending;
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{inv.customerName}</p>
                    <p className="text-xs text-muted">#{inv.invoiceNumber}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="money text-sm font-bold text-ink">{formatMoney(inv.grandTotal, inv.currency)}</p>
                    <p className={clsx('text-xs font-semibold', status.text)}>{status.label}</p>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="border-dashed p-6 text-center bg-transparent shadow-none">
            <p className="text-sm text-muted">No invoices found for {currency}.</p>
            <button onClick={() => onNavigate('create')} className="mt-2 min-h-11 px-3 text-sm font-semibold text-primary hover:underline">
              Create your first invoice &rarr;
            </button>
          </Card>
        )}
      </section>

      {data && data.invoices.length > 0 && (
        <Reports invoices={data.invoices} customers={data.customers} currency={currency} />
      )}
    </div>
  );
}
