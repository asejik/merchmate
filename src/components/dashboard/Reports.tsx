import { useMemo, useState } from 'react';
import { BarChart3, Download, Table2, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../ui/GlassCard';
import type { CurrencyCode, Customer, Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { compactNumber, monthlyCollections, niceMax, topClients } from '../../lib/reports';
import { csvFile, invoicesCsv, paymentsCsv } from '../../lib/csv';
import { shareOrDownload } from '../../lib/share';

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  currency: CurrencyCode;
}

const PLOT_HEIGHT = 140; // px

/** Cash collected per month: a single-series column chart (validated indigo-500 on the dark surface). */
function CollectionsChart({ invoices, currency }: Omit<Props, 'customers'>) {
  const [asTable, setAsTable] = useState(false);
  const months = useMemo(() => monthlyCollections(invoices, currency), [invoices, currency]);
  const max = niceMax(Math.max(...months.map(m => m.amount)));
  const total = months.reduce((sum, m) => sum + m.amount, 0);
  const ticks = [max, max / 2, 0];

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-400" /> Cash collected, last 6 months
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{formatMoney(total, currency)} total · by payment date</p>
        </div>
        <button
          onClick={() => setAsTable(v => !v)}
          className="text-xs flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
          aria-pressed={asTable}
        >
          <Table2 size={14} /> {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 text-left">
              <th className="font-medium pb-2">Month</th>
              <th className="font-medium pb-2 text-right">Collected</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.key} className="border-t border-white/5">
                <td className="py-1.5 text-slate-300">{m.label} {m.key.slice(0, 4)}</td>
                <td className="py-1.5 text-right text-white tabular-nums">{formatMoney(m.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: clean ticks, recessive */}
          <div className="relative w-10 shrink-0 text-[10px] text-slate-500 tabular-nums" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t, i) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                {compactNumber(t)}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {/* Hairline solid gridlines */}
              {ticks.map((t, i) => (
                <div key={t} className="absolute inset-x-0 border-t border-white/10" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}

              <div className="absolute inset-0 flex items-end gap-0.5" role="list" aria-label="Cash collected per month">
                {months.map((m, i) => {
                  const pct = (m.amount / max) * 100;
                  const isCurrent = i === months.length - 1;
                  const label = `${m.label}: ${formatMoney(m.amount, currency)}`;
                  return (
                    // The whole column slot is the hover/focus target, not just the bar
                    <div
                      key={m.key}
                      role="listitem"
                      tabIndex={0}
                      aria-label={label}
                      className="group relative flex-1 h-full flex flex-col items-center justify-end outline-none"
                    >
                      {isCurrent && m.amount > 0 && (
                        <span className="text-[10px] text-slate-300 mb-1 tabular-nums">{compactNumber(m.amount)}</span>
                      )}
                      <div
                        className="w-full max-w-6 bg-indigo-500 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                        style={{ height: `${pct}%` }}
                      />
                      <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/95 px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity z-10">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-0.5 mt-1.5">
              {months.map(m => (
                <span key={m.key} className="flex-1 text-center text-[10px] text-slate-500">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function TopClients({ invoices, customers, currency }: Props) {
  const ranks = useMemo(() => topClients(invoices, customers, currency), [invoices, customers, currency]);

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Users size={16} className="text-slate-400" /> Top clients
      </h3>
      {ranks.length === 0 ? (
        <p className="text-sm text-slate-500">No invoices in {currency} yet.</p>
      ) : (
        <ol className="space-y-3">
          {ranks.map((r, i) => (
            <li key={r.customerId} className="flex items-center gap-3">
              <span className="w-5 text-xs text-slate-500 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{r.name}</p>
                <p className="text-[11px] text-slate-500">
                  {r.count} invoice{r.count === 1 ? '' : 's'}
                  {r.outstanding > 0 && <> · <span className="text-orange-300">{formatMoney(r.outstanding, currency)} owed</span></>}
                </p>
              </div>
              <span className="text-sm text-slate-200 tabular-nums">{formatMoney(r.invoiced, currency)}</span>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}

export function Reports({ invoices, customers, currency }: Props) {
  const exportCsv = async (kind: 'invoices' | 'payments') => {
    const day = new Date().toISOString().slice(0, 10);
    const csv = kind === 'invoices' ? invoicesCsv(invoices, customers) : paymentsCsv(invoices, customers);
    const file = csvFile(csv, `merchmate-${kind}-${day}.csv`);
    try {
      await shareOrDownload(file, `MerchMate ${kind}`, `MerchMate ${kind} export`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') console.error(error);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="reports-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reports-heading" className="text-lg font-semibold text-white">Reports</h2>
        <div className="flex gap-2">
          {(['invoices', 'payments'] as const).map(kind => (
            <button
              key={kind}
              onClick={() => exportCsv(kind)}
              disabled={invoices.length === 0}
              className={clsx(
                "text-xs flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-slate-300 transition-colors capitalize",
                "disabled:opacity-40 disabled:hover:bg-white/5"
              )}
              title={`Export all ${kind} as CSV (all currencies) for Excel or your accountant`}
            >
              <Download size={14} /> {kind} CSV
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollectionsChart invoices={invoices} currency={currency} />
        <TopClients invoices={invoices} customers={customers} currency={currency} />
      </div>
    </section>
  );
}
