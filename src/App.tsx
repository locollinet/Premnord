import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { WineList } from './components/WineList';
import { SiteManagement } from './components/SiteManagement';
import { WineMenu } from './components/WineMenu';
import { MobileInventory } from './components/MobileInventory';
import { WineDetailModal } from './components/WineDetailModal';
import { WineFormModal } from './components/WineFormModal';
import { MovementFormModal } from './components/MovementFormModal';
import { Wine } from './types';
import { PremnordLogo } from './components/PremnordLogo';
import { Settings } from './components/Settings';
import { CommercialManagement } from './components/CommercialManagement';
import { AccountingExtraction } from './components/AccountingExtraction';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  LayoutDashboard, 
  Database, 
  RefreshCw, 
  Landmark, 
  LogOut, 
  Sparkles, 
  User, 
  Smartphone, 
  BookOpen, 
  X,
  AlertTriangle,
  Sliders,
  Coins,
  FileSpreadsheet
} from 'lucide-react';

type Tab = 'dashboard' | 'wines' | 'commercial' | 'accounting' | 'menu' | 'mobile' | 'sites' | 'settings';

interface AlertNotification {
  id: string;
  wineName: string;
  quantity: number;
}

function AppContent() {
  const { user, loading, isDemo, logout, syncLocalToFirebase, sites } = useFirebase();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const hasLocalData = !!(localStorage.getItem('premnord_wines') || localStorage.getItem('premnord_movements'));

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncLocalToFirebase();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 5000);
    } catch (err: any) {
      setSyncError(err?.message || "Erreur lors de la synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  // Modal Overlay States
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [wineToEdit, setWineToEdit] = useState<Wine | null>(null);
  const [isAddingWine, setIsAddingWine] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [wineForMovement, setWineForMovement] = useState<Wine | null>(null);
  const [isAddingMovement, setIsAddingMovement] = useState(false);

  // In-app alert toasts registry
  const [toasts, setToasts] = useState<AlertNotification[]>([]);

  if (loading) {
    return (
      <div className="min-h-screen bg-premnord-cream text-premnord-dark flex flex-col justify-center items-center">
        <div className="mb-6">
          <PremnordLogo size={90} className="animate-pulse" />
        </div>
        <div className="w-10 h-10 border-2 border-premnord-gold/10 border-t-premnord-green rounded-full animate-spin mb-4" />
        <p className="font-mono text-[10px] font-bold tracking-widest text-premnord-green-dark uppercase">Chargement de la cave Premnord...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Handle triggered low stock alerts
  const handleAlertTriggered = (wineName: string, finalQty: number) => {
    const newAlert: AlertNotification = {
      id: Math.random().toString(36).substring(2, 9),
      wineName,
      quantity: finalQty
    };
    setToasts(prev => [newAlert, ...prev]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Quick navigation helpers from Dashboard links
  const navigateToWineDetail = (wineId: string) => {
    setActiveTab('wines');
    setSelectedWineId(wineId);
  };

  return (
    <div className="min-h-screen bg-premnord-cream/30 text-premnord-dark flex flex-col font-sans">
      
      {/* 1. Upper Navigation Banner */}
      <header className="bg-white/90 backdrop-blur-md border-b border-premnord-gold/15 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          
          {/* Logo */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <PremnordLogo size={44} />
            <div>
              <h1 className="text-xl font-serif font-medium tracking-tight text-premnord-dark leading-none">
                Premnord
              </h1>
              <span className="text-[9px] text-premnord-green-dark/70 font-bold font-mono tracking-wider uppercase block mt-0.5">Suivi & Inventaires</span>
            </div>
          </div>

          {/* User profile and demo badges */}
          <div className="flex items-center gap-4">
            {isDemo && (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-premnord-gold-light text-premnord-gold-dark border border-premnord-gold/25 text-[10px] font-mono px-2.5 py-1 rounded-lg uppercase font-bold">
                <Sparkles className="w-3.5 h-3.5 text-premnord-gold" />
                Démo locale active
              </span>
            )}

            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-premnord-dark leading-tight">
                  {user.displayName}
                </p>
                <p className="text-[9px] text-premnord-green-dark/60 font-mono leading-tight font-bold">
                  {user.email}
                </p>
              </div>

              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'Avatar'} 
                  referrerPolicy="no-referrer"
                  className="w-8.5 h-8.5 rounded-full border border-premnord-gold/15 shadow-sm"
                />
              ) : (
                <div className="w-8.5 h-8.5 rounded-full bg-premnord-cream border border-premnord-gold/15 flex items-center justify-center text-premnord-green-dark shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}

              <button
                onClick={logout}
                className="p-1.5 rounded-xl bg-premnord-cream hover:bg-red-50 text-premnord-green-dark hover:text-red-600 border border-premnord-gold/15 transition-colors cursor-pointer"
                title="Se déconnecter de la session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Sync Banner */}
      {!isDemo && user && !user.email?.endsWith('@premnord.guest') && hasLocalData && (
        <div className="bg-premnord-gold-light border-b border-premnord-gold/20 py-3 px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-premnord-dark font-sans">
            <div className="flex items-center gap-2 text-left">
              <AlertTriangle className="w-4.5 h-4.5 text-premnord-gold-dark shrink-0" />
              <div>
                <span className="font-bold">Données hors-ligne détectées !</span> Vous avez des fiches produits ou historiques de stocks stockés dans votre navigateur qui ne sont pas encore sauvegardés dans la base de données cloud Firebase.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3.5 py-1.5 bg-premnord-green hover:bg-premnord-green-dark text-white rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 text-xs shrink-0"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Sauvegarder dans Firebase
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncSuccess && (
        <div className="bg-premnord-gold-light/40 border-b border-premnord-gold/15 py-3 px-4 text-center text-xs font-bold text-premnord-green-dark animate-fade-in flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-premnord-green rounded-full animate-ping" />
          Félicitations ! Vos données locales ont été synchronisées avec succès sur votre base de données cloud Firebase.
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border-b border-red-100 py-3 px-4 text-center text-xs font-bold text-red-800 animate-fade-in">
          ❌ {syncError}
        </div>
      )}

      {/* 2. Primary Tab Bar Menu */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-premnord-gold/15 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2 overflow-x-auto scrollbar-none">
            {/* Tab: Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'dashboard'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Tableau de bord
            </button>

            {/* Tab: General Wine List */}
            <button
              onClick={() => setActiveTab('wines')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'wines'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              Stock Global & Cave
            </button>

            {/* Tab: Commercial Management (Valorisation & Commandes) */}
            <button
              onClick={() => setActiveTab('commercial')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'commercial'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <Coins className="w-4 h-4 shrink-0" />
              Valorisation & Commandes
            </button>

            {/* Tab: Extraction Comptable */}
            <button
              onClick={() => setActiveTab('accounting')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'accounting'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 font-black'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'accounting' ? 'text-emerald-300' : 'text-emerald-600'}`} />
              Extraction Comptable
            </button>

            {/* Tab: Customer-facing Wine Menu with Replenishments */}
            <button
              onClick={() => setActiveTab('menu')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'menu'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              La Carte des Vins (Dining)
            </button>

            {/* Tab: Mobile iPhone Inventory counts helper */}
            <button
              onClick={() => setActiveTab('mobile')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'mobile'
                  ? 'bg-premnord-green text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0 animate-bounce" />
              Mode Saisie iPhone
            </button>

            {/* Direct Flow Registration Modal shortcut */}
            <button
              onClick={() => {
                setWineForMovement(null);
                setIsAddingMovement(true);
              }}
              className="h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs text-premnord-gold bg-premnord-gold-light hover:bg-premnord-gold/20 transition-all cursor-pointer border border-premnord-gold/30 whitespace-nowrap uppercase font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-premnord-gold" />
              Entrée / Sortie / Transfert
            </button>

            {/* Tab: Sites Storage Configurator */}
            <button
              onClick={() => setActiveTab('sites')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'sites'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <Landmark className="w-4 h-4 shrink-0" />
              Les {sites.length} Sites
            </button>

            {/* Tab: Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap uppercase font-mono ${
                activeTab === 'settings'
                  ? 'bg-premnord-dark text-white shadow-md'
                  : 'text-premnord-green-dark hover:bg-premnord-cream hover:text-premnord-dark'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              Paramètres
            </button>
          </div>
        </div>
      </nav>

      {/* 3. Main Container Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 pb-safe">
        
        {/* Dynamic Warning Notification Banner container */}
        {toasts.length > 0 && (
          <div className="mb-6 space-y-2 animate-fade-in">
            {toasts.map(toast => (
              <div 
                key={toast.id}
                className={`p-4 border rounded-2xl flex justify-between items-center shadow-md ${
                  toast.quantity === 0 
                    ? 'bg-red-50 border-red-200 text-red-900' 
                    : 'bg-premnord-gold-light border-premnord-gold/30 text-premnord-dark'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-5.5 h-5.5 ${toast.quantity === 0 ? 'text-red-600' : 'text-premnord-gold'}`} />
                  <div>
                    <p className="text-xs font-bold uppercase font-mono">
                      {toast.quantity === 0 ? 'Alerte Rupture Immédiate !' : 'Alerte Stock Critique !'}
                    </p>
                    <p className="text-xs mt-0.5">
                      Il ne reste <strong>{toast.quantity} bouteille{toast.quantity > 1 ? 's' : ''}</strong> de <strong>{toast.wineName}</strong>. Pensez à réapprovisionner la carte depuis les réserves.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab views dispatching router (Conditionally mounted for elite performance, fluid mobile transition, and zero main thread lag) */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            onNavigateToWines={() => setActiveTab('wines')}
            onNavigateToSites={() => setActiveTab('sites')}
            onSelectWine={navigateToWineDetail}
            onNavigateToAccounting={() => setActiveTab('accounting')}
          />
        )}

        {activeTab === 'wines' && (
          <WineList 
            onSelectWine={(wineId) => setSelectedWineId(wineId)}
            onAddWine={() => {
              setWineToEdit(null);
              setIsDuplicate(false);
              setIsAddingWine(true);
            }}
            onNavigateToAccounting={() => setActiveTab('accounting')}
          />
        )}

        {activeTab === 'commercial' && (
          <CommercialManagement 
            onNavigateToAccounting={() => setActiveTab('accounting')}
          />
        )}

        {activeTab === 'accounting' && (
          <AccountingExtraction 
            onSelectWine={navigateToWineDetail}
          />
        )}

        {activeTab === 'menu' && (
          <WineMenu 
            onSelectWine={navigateToWineDetail}
          />
        )}

        {activeTab === 'mobile' && (
          <MobileInventory 
            onSelectWine={navigateToWineDetail}
          />
        )}

        {activeTab === 'sites' && (
          <SiteManagement />
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}
      </main>

      {/* 4. Footer copyright and credits */}
      <footer className="bg-white border-t border-premnord-gold/15 py-6 text-center text-[10px] font-mono text-premnord-green-dark/60 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>Suivi App Premnord &copy; {new Date().getFullYear()} &bull; Conception Haute Fidélité</p>
          <p className="mt-1">Compatible iPhone, iPad, tablettes de salle de restauration et ordinateurs de bureau.</p>
        </div>
      </footer>

      {/* --- OVERLAY MODALS REGISTRY --- */}
      
      {/* Modal 1: Wine Details View */}
      {selectedWineId && (
        <WineDetailModal 
          wineId={selectedWineId}
          onClose={() => setSelectedWineId(null)}
          onEditWine={(wine) => {
            setSelectedWineId(null);
            setWineToEdit(wine);
            setIsDuplicate(false);
            setIsAddingWine(true);
          }}
          onDuplicateWine={(wine) => {
            setSelectedWineId(null);
            setWineToEdit(wine);
            setIsDuplicate(true);
            setIsAddingWine(true);
          }}
          onRecordMovement={(wine) => {
            setSelectedWineId(null);
            setWineForMovement(wine);
            setIsAddingMovement(true);
          }}
        />
      )}

      {/* Modal 2: Wine Edit/Add Form */}
      {isAddingWine && (
        <WineFormModal 
          wineToEdit={wineToEdit || undefined}
          isDuplicate={isDuplicate}
          onClose={() => {
            setIsAddingWine(false);
            setWineToEdit(null);
            setIsDuplicate(false);
          }}
        />
      )}

      {/* Modal 3: Manual Movement / Flow Form */}
      {isAddingMovement && (
        <MovementFormModal 
          preselectedWine={wineForMovement || undefined}
          onClose={() => {
            setIsAddingMovement(false);
            setWineForMovement(null);
          }}
          onAlertTriggered={handleAlertTriggered}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
