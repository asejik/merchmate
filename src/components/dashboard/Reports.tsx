import { useMemo, useState } from 'react';
import { BarChart3, Download, PiggyBank, Table2, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { BUTTON_GHOST, BUTTON_SECONDARY } from '../ui/styles';
import type { CurrencyCode, Customer, Invoice } from '../../types';
import { formatMoney } from '../../lib/currency';
import { compactNumber, monthlyCollections, niceMax, topClients } from '../../lib/reports';
import { csvFile, invoicesCsv, paymentsCsv } from '../../lib/csv';
import { monthProfit } from '../../lib/profit';
import { shareOrDownload } from '../../lib/share';

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  currency: CurrencyCode;
}

const PLOT_HEIGHT = 140; // px

/** Cash collected per month: a single-series column chart in the primary colour (at least 3:1 on the surface in light and dark). */
function CollectionsChart({ invoices, currency }: Omit<Props, 'customers'>) {
  const [asTable, setAsTable] = useState(false);
  const months = useMemo(() => monthlyCollections(invoices, currency), [invoices, currency]);
  const max = niceMax(Math.max(...months.map(m => m.amount)));
  const total = months.reduce((sum, m) => sum + m.amount, 0);
  const ticks = [max, max / 2, 0];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <BarChart3 size={16} className="text-muted" aria-hidden="true" /> Cash collected, last 6 months
          </h3>
          <p className="text-xs text-muted mt-0.5">{formatMoney(total, currency)} total · by payment date</p>
        </div>
        <button
          onClick={() => setAsTable(v => !v)}
          className={`${BUTTON_GHOST} shrink-0 -mt-2 -mr-2`}
          aria-pressed={asTable}
        >
          <Table2 size={16} aria-hidden="true" /> {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted text-left">
              <th className="font-medium pb-2">Month</th>
              <th className="font-medium pb-2 text-right">Collected</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.key} className="border-t border-line">
                <td className="py-1.5 text-muted">{m.label} {m.key.slice(0, 4)}</td>
                <td className="py-1.5 text-right text-ink money">{formatMoney(m.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: clean ticks, recessive */}
          <div className="relative w-10 shrink-0 text-xs text-muted money" style={{ height: PLOT_HEIGHT }}>
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
                <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
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
                        <span className="text-xs font-semibold text-ink mb-1 money">{compactNumber(m.amount)}</span>
                      )}
                      <div
                        className="w-full max-w-6 bg-primary rounded-t-[4px] transition-opacity duration-150 group-hover:opacity-80"
                        style={{ height: `${pct}%` }}
                      />
                      <div className={clsx(i >= months.length - 2 ? 'right-0' : i <= 1 ? 'left-0' : 'left-1/2 -translate-x-1/2', "pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-paper opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity z-10")}>
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-0.5 mt-1.5">
              {months.map(m => (
                <span key={m.key} className="flex-1 text-center text-xs text-muted">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function TopClients({ invoices, customers, currency }: Props) {
  const ranks = useMemo(() => topClients(invoices, customers, currency), [invoices, customers, currency]);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-ink flex items-center gap-2 mb-4">
        <Users size={16} className="text-muted" aria-hidden="true" /> Top clients
      </h3>
      {ranks.length === 0 ? (
        <p className="text-sm text-muted">No invoices in {currency} yet.</p>
      ) : (
        <ol className="space-y-3">
          {ranks.map((r, i) => (
            <li key={r.customerId} className="flex items-center gap-3">
              <span className="w-5 text-xs text-muted money">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.count} invoice{r.count === 1 ? '' : 's'}
                  {r.outstanding > 0 && <> · <span className="font-medium text-warning">{formatMoney(r.outstanding, currency)} owed</span></>}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink money">{formatMoney(r.invoiced, currency)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Profit on this month's invoices, from the private costs entered on them. */
function ProfitCard({ invoices, currency }: Omit<Props, 'customers'>) {
  const month = useMemo(() => monthProfit(invoices, currency), [invoices, currency]);
  const plural = (n: number) => `${n} invoice${n === 1 ? '' : 's'}`;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
        <PiggyBank size={16} className="text-muted" aria-hidden="true" /> Profit this month
      </h3>
      {month.jobs === 0 ? (
        <p className="text-sm text-muted mt-3">
          Add your costs (fabric, labour, transport) under “My Costs” when creating an invoice to see what you actually make.
        </p>
      ) : (
        <>
          <p className={clsx("text-3xl font-extrabold tracking-tight mt-3 money", month.profit < 0 ? "text-danger" : "text-ink")}>
            {formatMoney(month.profit, currency)}
          </p>
          <p className="text-xs text-muted mt-1">
            {month.margin !== null && <>{month.margin}% margin · </>}
            {formatMoney(month.revenue, currency)} sales − {formatMoney(month.cost, currency)} costs, from {plural(month.jobs)}
          </p>
          {month.jobsWithoutCosts > 0 && (
            <p className="text-xs text-muted mt-2">{plural(month.jobsWithoutCosts)} without costs entered {month.jobsWithoutCosts === 1 ? "isn't" : "aren't"} counted.</p>
          )}
        </>
      )}
    </Card>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reports-heading" className="text-base font-bold text-ink">Reports</h2>
        <div className="flex flex-wrap gap-2">
          {(['invoices', 'payments'] as const).map(kind => (
            <button
              key={kind}
              onClick={() => exportCsv(kind)}
              disabled={invoices.length === 0}
              className={clsx(BUTTON_SECONDARY, 'capitalize')}
              title={`Export all ${kind} as CSV (all currencies) for Excel or your accountant`}
            >
              <Download size={16} aria-hidden="true" /> {kind} CSV
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollectionsChart invoices={invoices} currency={currency} />
        <TopClients invoices={invoices} customers={customers} currency={currency} />
        <ProfitCard invoices={invoices} currency={currency} />
      </div>
    </section>
  );
}
