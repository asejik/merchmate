import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from './db';
import { AppShell } from './components/layout/AppShell';
import { BusinessProfileForm } from './components/forms/BusinessProfileForm';
import { CustomerList } from './components/customers/CustomerList';
import { InvoiceForm, type InvoiceEditorMode } from './components/invoices/InvoiceForm';
import { InvoiceList } from './components/invoices/InvoiceList';
import { Dashboard } from './components/dashboard/Dashboard';
import { FatalError } from './components/ui/FatalError';
import { UpdateBanner } from './components/ui/UpdateBanner';
import { LockScreen } from './components/ui/LockScreen';
import { useDialogs } from './components/ui/dialogContext';
import { AUTO_LOCK_MS, isLockEnabled } from './lib/appLock';
import type { AppTab, ListView } from './types';

const TABS: AppTab[] = ['dashboard', 'invoices', 'create', 'customers', 'settings'];
const TAB_STORAGE_KEY = 'activeTab';

function readSavedTab(): AppTab {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.find(tab => tab === saved) ?? 'dashboard';
  } catch {
    return 'dashboard';
  }
}

interface EditorState {
  mode: InvoiceEditorMode;
  invoiceId?: string;
}

function App() {
  const { confirm } = useDialogs();
  const [activeTab, setActiveTab] = useState<AppTab>(readSavedTab);
  const [editor, setEditor] = useState<EditorState>({ mode: 'create' });
  const [listView, setListView] = useState<ListView>('invoices');

  const openEditor = (next: EditorState) => {
    setEditor(next);
    setActiveTab('create');
  };

  // True while the invoice form holds changes that have not been saved
  const unsavedRef = useRef(false);
  const setUnsaved = useCallback((dirty: boolean) => { unsavedRef.current = dirty; }, []);

  // The nav's "New" button always starts a blank invoice
  const handleTabChange = async (tab: AppTab) => {
    // A new invoice or quote saves itself as a draft, so leaving it loses nothing. Editing, duplicating
    // or converting changes an existing document: leaving that would throw away what was typed.
    const savesDraft = editor.mode === 'create' || editor.mode === 'create-quote';
    if (activeTab === 'create' && unsavedRef.current && !savesDraft) {
      const discard = await confirm({
        title: 'Discard your changes?',
        message: 'You have unsaved changes. What you typed will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      });
      if (!discard) return;
    }
    unsavedRef.current = false;
    if (tab === 'create') setEditor({ mode: 'create' });
    setActiveTab(tab);
  };

  const [status, setStatus] = useState('Checking DB...');
  // Read synchronously so a locked app never flashes its contents before the lock appears
  const [locked, setLocked] = useState(isLockEnabled);

  // Lock again after the app has been in the background for a minute
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null && Date.now() - hiddenAt >= AUTO_LOCK_MS && isLockEnabled()) setLocked(true);
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    async function initDB() {
      try {
        await db.open();
        setStatus('Ready');
        // Ask the browser not to evict our IndexedDB under storage pressure (best effort)
        navigator.storage?.persist?.().catch(() => undefined);
      } catch (error) {
        console.error(error);
        setStatus('Error');
      }
    }
    initDB();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {
      // Storage can be unavailable (private mode); remembering the tab is optional
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <BusinessProfileForm onLock={() => setLocked(true)} />;

      case 'customers':
        return <CustomerList />;

      case 'create':
        return (
          <InvoiceForm
            key={`${editor.mode}-${editor.invoiceId ?? 'new'}`}
            mode={editor.mode}
            sourceInvoiceId={editor.invoiceId}
            onComplete={(kind) => {
              setListView(kind === 'quote' ? 'quotes' : 'invoices');
              handleTabChange('invoices');
            }}
            onCancel={() => handleTabChange(editor.mode === 'create' ? 'dashboard' : 'invoices')}
            onAddClient={() => handleTabChange('customers')}
            onDirtyChange={setUnsaved}
          />
        );

      case 'invoices':
        return (
          <InvoiceList
            view={listView}
            onViewChange={setListView}
            onEdit={(invoiceId) => openEditor({ mode: 'edit', invoiceId })}
            onDuplicate={(invoiceId) => openEditor({ mode: 'duplicate', invoiceId })}
            onConvert={(invoiceId) => openEditor({ mode: 'convert', invoiceId })}
            onCreate={() => handleTabChange('create')}
            onCreateQuote={() => openEditor({ mode: 'create-quote' })}
          />
        );

      case 'dashboard':
      default:
        return (
          <Dashboard onNavigate={handleTabChange} />
        );
    }
  };

  // Without storage nothing can be saved: say so, instead of showing screens that silently fail
  if (status === 'Error') {
    return (
      <FatalError title="Can't open your data">
        <p>MerchMate could not open its storage on this device. Nothing you entered would be saved.</p>
        <p>This happens in private/incognito windows, when the phone is almost out of space, or when the app is open in an older tab. Close other MerchMate tabs, leave private mode, free up some space and try again.</p>
      </FatalError>
    );
  }

  if (locked) {
    return (
      <LockScreen
        onUnlock={erased => {
          setLocked(false);
          // After "erase this device" the way forward is Restore, which lives in Settings
          if (erased) setActiveTab('settings');
        }}
      />
    );
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="fixed top-4 right-4 z-50 pointer-events-none opacity-0 md:opacity-100">
         <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
             <span className={`h-2 w-2 rounded-full ${status === 'Ready' ? 'bg-green-500' : 'bg-red-500'}`} />
             <span className="text-[10px] font-mono text-slate-400 uppercase">{status}</span>
         </div>
      </div>

      {renderContent()}
      <UpdateBanner />
    </AppShell>
  );
}

export default App;