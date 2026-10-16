import { useEffect, useState } from 'react';
import { db } from './db';
import { AppShell } from './components/layout/AppShell';
import { BusinessProfileForm } from './components/forms/BusinessProfileForm';
import { CustomerList } from './components/customers/CustomerList';
import { InvoiceForm, type InvoiceEditorMode } from './components/invoices/InvoiceForm';
import { InvoiceList } from './components/invoices/InvoiceList';
import { Dashboard } from './components/dashboard/Dashboard';
import { FatalError } from './components/ui/FatalError';
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
  const [activeTab, setActiveTab] = useState<AppTab>(readSavedTab);
  const [editor, setEditor] = useState<EditorState>({ mode: 'create' });
  const [listView, setListView] = useState<ListView>('invoices');

  const openEditor = (next: EditorState) => {
    setEditor(next);
    setActiveTab('create');
  };

  // The nav's "New" button always starts a blank invoice
  const handleTabChange = (tab: AppTab) => {
    if (tab === 'create') setEditor({ mode: 'create' });
    setActiveTab(tab);
  };

  const [status, setStatus] = useState('Checking DB...');

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
        return <BusinessProfileForm />;

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

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="fixed top-4 right-4 z-50 pointer-events-none opacity-0 md:opacity-100">
         <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
             <span className={`h-2 w-2 rounded-full ${status === 'Ready' ? 'bg-green-500' : 'bg-red-500'}`} />
             <span className="text-[10px] font-mono text-slate-400 uppercase">{status}</span>
         </div>
      </div>

      {renderContent()}
    </AppShell>
  );
}

export default App;