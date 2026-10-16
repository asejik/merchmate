import { useEffect, useState } from 'react';
import { HardDrive, ShieldCheck, ShieldAlert, Smartphone } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { getPersistence, requestPersistence, type Persistence } from '../../lib/storage';
import { currentPlatform, IOS_INSTALL_STEPS, shouldSuggestInstall } from '../../lib/platform';

export function DataSafetyCard() {
  const [persistence, setPersistence] = useState<Persistence | null>(null);
  const [asking, setAsking] = useState(false);
  const suggestInstall = shouldSuggestInstall(currentPlatform());

  // Reads browser state once on open
  useEffect(() => {
    let cancelled = false;
    getPersistence().then(value => { if (!cancelled) setPersistence(value); });
    return () => { cancelled = true; };
  }, []);

  const ask = async () => {
    setAsking(true);
    setPersistence(await requestPersistence());
    setAsking(false);
  };

  return (
    <GlassCard className="p-6 md:p-8 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <HardDrive size={20} className="text-indigo-400" /> Data Protection
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Your invoices live in this browser. When a phone runs low on space, a browser can clear data it has not been asked to keep.
      </p>

      {persistence === 'persisted' && (
        <p className="flex items-center gap-2 text-sm text-green-400"><ShieldCheck size={16} /> Protected: the browser will keep your data when space runs low.</p>
      )}
      {persistence === 'not-persisted' && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-orange-300"><ShieldAlert size={16} className="mt-0.5 shrink-0" /> Not protected yet. Your data could be cleared if this phone runs out of space. Keep your backups up to date.</p>
          <button type="button" onClick={ask} disabled={asking} className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            Ask the browser to protect my data
          </button>
        </div>
      )}
      {persistence === 'unsupported' && (
        <p className="flex items-start gap-2 text-sm text-slate-400"><ShieldAlert size={16} className="mt-0.5 shrink-0" /> This browser cannot promise to keep your data. Save a backup regularly.</p>
      )}

      {suggestInstall && (
        <div className="mt-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-white"><Smartphone size={16} /> Add MerchMate to your Home Screen</p>
          <p className="mt-1 text-xs text-slate-300">On iPhone and iPad, data of websites that are not installed can be erased after about a week without opening them.</p>
          <ol className="mt-2 list-decimal list-inside text-xs text-slate-300 space-y-0.5">
            {IOS_INSTALL_STEPS.map(step => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
    </GlassCard>
  );
}
