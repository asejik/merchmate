import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Card } from '../ui/Card';
import { useDialogs } from '../ui/dialogContext';
import { CustomerForm } from './CustomerForm';
import { Search, Plus, User, MapPin, Globe, ScrollText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Customer } from '../../types';
import { buildStatement } from '../../lib/statement';
import { failed } from '../../lib/messages';
import { renderStatementPdf } from '../../lib/pdf';
import { formatMoney } from '../../lib/currency';
import { ShareModal, type ShareState } from '../ui/ShareModal';

export function CustomerList() {
  const { alert } = useDialogs();
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<ShareState | null>(null);

  const invoices = useLiveQuery(() => db.invoices.toArray(), [], []);

  // Outstanding balance per client, per currency (currencies are never summed together)
  const owed = useMemo(() => {
    const byCustomer = new Map<string, string>();
    const grouped = new Map<string, typeof invoices>();
    for (const inv of invoices) grouped.set(inv.customerId, [...(grouped.get(inv.customerId) ?? []), inv]);
    for (const [customerId, list] of grouped) {
      const parts = buildStatement(list).filter(g => g.balance > 0).map(g => formatMoney(g.balance, g.currency));
      if (parts.length) byCustomer.set(customerId, parts.join(' + '));
    }
    return byCustomer;
  }, [invoices]);

  const handleStatement = async (customer: Customer) => {
    if (!customer.id) return;
    setGeneratingId(customer.id);
    try {
      const business = await db.businessProfile.orderBy('id').first();
      if (!business) {
        await alert("Add your business details in Settings first.");
        return;
      }
      const list = await db.invoices.where('customerId').equals(customer.id).toArray();
      const now = new Date();
      const blob = await renderStatementPdf(business, customer, buildStatement(list), now);
      const safeName = customer.name.replace(/[^\w\- ]+/g, '').trim() || 'client';
      const file = new File([blob], `Statement - ${safeName} - ${now.toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
      setShareModal({
        heading: 'Statement Ready',
        description: `Account statement for ${customer.name}.`,
        files: [{ label: 'Statement', file, title: `Statement for ${customer.name}`, text: `Hello ${customer.name}, here is your account statement from ${business.businessName}.` }],
      });
    } catch (error) {
      console.error(error);
      await alert(failed('create the statement'));
    } finally {
      setGeneratingId(null);
    }
  };

  // Live Query with Filtering
  const customers = useLiveQuery(async () => {
    const all = await db.customers.orderBy('name').toArray();
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.email ?? '').toLowerCase().includes(term)
    );
  }, [search]);

  if (isCreating || editing) {
    const close = () => { setIsCreating(false); setEditing(null); };
    return <CustomerForm key={editing?.id ?? 'new'} initialData={editing ?? undefined} onComplete={close} onCancel={close} />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Clients</h1>
          <p className="text-muted text-sm">Manage your customer database.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-on-primary px-4 py-2 rounded-xl font-medium transition-all"
        >
          <Plus size={20} />
          Add Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
        <input
          type="text"
          placeholder="Search by name, phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-11 rounded-xl border border-line-strong bg-surface pl-10 pr-4 py-3 text-base text-ink focus:outline-none focus:border-primary transition-all"
        />
      </div>

      {/* List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {customers?.map((customer) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <Card className="relative p-4 hover:bg-primary-tint transition-colors cursor-pointer group">
                <div className="flex items-start justify-between">
                  {/* The button's invisible overlay makes the whole card open the editor, while the
                      statement button below stays a separate, sibling control (no nesting) */}
                  <button
                    type="button"
                    onClick={() => setEditing(customer)}
                    className="flex items-center gap-3 text-left after:absolute after:inset-0 after:content-['']"
                  >
                    <span className="h-10 w-10 rounded-full bg-primary-tint flex items-center justify-center text-primary font-bold text-lg" aria-hidden="true">
                      {customer.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block text-ink font-medium group-hover:text-primary-hover transition-colors">{customer.name}</span>
                      <span className="block text-muted text-xs">{customer.phone}</span>
                    </span>
                  </button>
                  <div className="relative z-10 flex items-center gap-1">
                    {customer.country && (
                      <div className="bg-primary-tint text-primary p-1.5 rounded-lg" title="International">
                        <Globe size={16} />
                      </div>
                    )}
                    <button
                      onClick={() => handleStatement(customer)}
                      disabled={generatingId === customer.id}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-muted hover:text-primary-hover hover:bg-primary-tint transition-colors"
                      title="Account statement"
                      aria-label={`Account statement for ${customer.name}`}
                    >
                      {generatingId === customer.id ? <Loader2 size={16} className="animate-spin" /> : <ScrollText size={16} />}
                    </button>
                  </div>
                </div>

                {customer.id && owed.has(customer.id) && (
                  <p className="mt-2 text-xs text-warning">Owes {owed.get(customer.id)}</p>
                )}

                {customer.address && (
                  <div className="mt-3 pt-3 border-t border-line flex items-start gap-2 text-xs text-muted">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{[customer.address, customer.city, customer.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {customers?.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted">
            <User size={48} className="mx-auto mb-4 opacity-20" />
            <p>No customers found.</p>
          </div>
        )}
      </div>

      {shareModal && <ShareModal state={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}