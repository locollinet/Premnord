import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, isSameWineReference, getWineReferenceKey } from '../types';
import { matchesWineSearch } from '../lib/stringUtils';
import { MultiSiteDispatchModal } from './MultiSiteDispatchModal';
import { WineFormModal } from './WineFormModal';
import { 
  Search, 
  MapPin, 
  CheckCircle, 
  RefreshCw, 
  Smartphone, 
  ChevronRight, 
  SlidersHorizontal, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Edit3, 
  X, 
  ArrowRightLeft 
} from 'lucide-react';

const COLOR_THEMES: Record<WineColor, { badge: string }> = {
  rouge: { badge: 'bg-red-100 text-red-800 border-red-200' },
  blanc: { badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  rose: { badge: 'bg-pink-100 text-pink-800 border-pink-200' },
  bulle: { badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  orange: { badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  spiritueux: { badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  cidre_biere: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  soft: { badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  autre: { badge: 'bg-slate-100 text-slate-800 border-slate-200' }
};

// High-performance collation cached instance for mobile JS engine
const frCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export const MobileInventory: React.FC = () => {
  const { wines, sites, updateWine, addMovement } = useFirebase();

  // Helper to prevent iOS WebKit hit-testing desync when virtual keyboard is dismissed
  const handleInputBlur = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: window.scrollY, behavior: 'instant' as ScrollBehavior });
    }
  };

  // Precompute lookup map of wines by reference key for O(1) duplicate/other site resolution
  const winesByRefMap = React.useMemo(() => {
    const map = new Map<string, Wine[]>();
    wines.forEach(w => {
      const key = getWineReferenceKey(w);
      const list = map.get(key);
      if (!list) {
        map.set(key, [w]);
      } else {
        list.push(w);
      }
    });
    return map;
  }, [wines]);

  // Search and Location filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // Track currently selected wine for counting
  const [countingWine, setCountingWine] = useState<Wine | null>(null);
  const [tempQty, setTempQty] = useState<number>(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedBin, setSelectedBin] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);

  // Quick Location modal on individual cards
  const [quickLocationWine, setQuickLocationWine] = useState<Wine | null>(null);
  const [quickModalSiteId, setQuickModalSiteId] = useState<string>('');
  const [quickModalBin, setQuickModalBin] = useState<string>('');
  const [isSavingQuickLoc, setIsSavingQuickLoc] = useState(false);

  // Multi-site Dispatch modal
  const [dispatchWine, setDispatchWine] = useState<Wine | null>(null);

  // New Wine / Reference Search & Location modal
  const [isWineFormOpen, setIsWineFormOpen] = useState(false);

  // Mode filter: 'in_stock' (only bottles present here) | 'all_catalog' (search master references) | 'all_site' (all site refs including 0)
  const [inventoryViewMode, setInventoryViewMode] = useState<'in_stock' | 'all_catalog' | 'all_site'>('in_stock');

  // Sorting state for inventory list
  const [sortBy, setSortBy] = useState<'name' | 'domain' | 'bin' | 'quantity'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (type: 'name' | 'domain' | 'bin' | 'quantity') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  // Filter wines based on mobile search and active inventory view mode
  const filteredWines = React.useMemo(() => {
    const list = wines.filter(wine => {
      const site = sites.find(s => s.id === wine.siteId);
      const siteNum = site?.name?.match(/\d/)?.[0] || '1';
      const computedLocation = wine.bin ? `${siteNum}${wine.bin.replace(/[\s\-_]/g, '').toUpperCase()}` : '';

      const matchesSearch = matchesWineSearch(wine, searchTerm, computedLocation);
      const matchesAlert = !onlyAlerts || (wine.quantity <= wine.alertThreshold);

      if (!matchesSearch || !matchesAlert) return false;

      // Mode: Global catalog search
      if (inventoryViewMode === 'all_catalog') {
        return true;
      }

      // Filter by active selected site
      const matchesSite = selectedSite === 'all' || wine.siteId === selectedSite;
      if (!matchesSite) return false;

      // Mode: In stock only
      if (inventoryViewMode === 'in_stock') {
        return wine.quantity > 0;
      }

      // Mode: All site items (including 0 stock)
      return true;
    });

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = frCollator.compare(a.name || '', b.name || '');
      } else if (sortBy === 'domain') {
        cmp = frCollator.compare((a.domain || '').trim(), (b.domain || '').trim());
        if (cmp === 0) {
          cmp = frCollator.compare(a.name || '', b.name || '');
        }
      } else if (sortBy === 'bin') {
        cmp = frCollator.compare(a.bin || '', b.bin || '');
      } else if (sortBy === 'quantity') {
        cmp = a.quantity - b.quantity;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [wines, sites, searchTerm, selectedSite, onlyAlerts, inventoryViewMode, sortBy, sortOrder]);

  const startCounting = (wine: Wine) => {
    setCountingWine(wine);
    setTempQty(wine.quantity);
    // If working on a specific site in inventory mode, pre-select that site
    const targetSiteId = (selectedSite !== 'all' && wine.siteId !== selectedSite) ? selectedSite : wine.siteId;
    setSelectedSiteId(targetSiteId);
    setSelectedBin(wine.siteId === targetSiteId ? (wine.bin || '') : '');
    setAuditSuccess(null);
  };

  const openQuickLocationModal = (wine: Wine, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickLocationWine(wine);
    setQuickModalSiteId(wine.siteId);
    setQuickModalBin(wine.bin || '');
  };

  const handleSaveQuickLocationModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLocationWine) return;
    setIsSavingQuickLoc(true);
    try {
      const siteChanged = quickModalSiteId !== quickLocationWine.siteId;
      const oldSiteId = quickLocationWine.siteId;

      await updateWine(quickLocationWine.id, {
        siteId: quickModalSiteId,
        bin: quickModalBin.trim()
      }, 'edit');

      if (siteChanged) {
        const oldSiteName = sites.find(s => s.id === oldSiteId)?.name || 'Ancien site';
        const newSiteName = sites.find(s => s.id === quickModalSiteId)?.name || 'Nouveau site';
        await addMovement({
          wineId: quickLocationWine.id,
          wineName: `${quickLocationWine.name} (${quickLocationWine.vintage})`,
          type: 'transfer',
          quantity: quickLocationWine.quantity,
          reason: 'transfert',
          fromSiteId: oldSiteId,
          toSiteId: quickModalSiteId,
          notes: `Changement de site express sur iPhone (${oldSiteName} -> ${newSiteName}). Rang: ${quickModalBin.trim()}`
        });
      }

      const updatedSiteName = sites.find(s => s.id === quickModalSiteId)?.name?.split(' - ')[0] || 'Site';
      setAuditSuccess(`Emplacement mis à jour pour "${quickLocationWine.name}" : ${updatedSiteName} / Rang ${quickModalBin.trim() || 'N/C'}`);
      setQuickLocationWine(null);
      setTimeout(() => setAuditSuccess(null), 3500);
    } catch (err) {
      console.error("Erreur lors de la mise à jour rapide de l'emplacement", err);
    } finally {
      setIsSavingQuickLoc(false);
    }
  };

  const handleAdjustTemp = (change: number) => {
    setTempQty(prev => Math.max(0, prev + change));
  };

  const saveInventoryAudit = async () => {
    if (!countingWine) return;
    setIsAuditing(true);
    const difference = tempQty - countingWine.quantity;
    const siteChanged = selectedSiteId !== countingWine.siteId;

    try {
      const nowStr = new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      await updateWine(countingWine.id, {
        quantity: tempQty,
        siteId: selectedSiteId,
        bin: selectedBin.trim(),
        notes: countingWine.notes 
          ? countingWine.notes.includes('Dernier inventaire:') 
            ? countingWine.notes.replace(/Dernier inventaire: [^]*/, `Dernier inventaire: le ${nowStr} (${tempQty} bt)`)
            : `${countingWine.notes}\n\nDernier inventaire: le ${nowStr} (${tempQty} bt)`
          : `Dernier inventaire: le ${nowStr} (${tempQty} bt)`
      }, 'stock');

      if (siteChanged) {
        const oldSiteName = sites.find(s => s.id === countingWine.siteId)?.name || 'Ancien site';
        const newSiteName = sites.find(s => s.id === selectedSiteId)?.name || 'Nouveau site';
        await addMovement({
          wineId: countingWine.id,
          wineName: `${countingWine.name} (${countingWine.vintage})`,
          type: 'transfer',
          quantity: tempQty,
          reason: 'transfert',
          fromSiteId: countingWine.siteId,
          toSiteId: selectedSiteId,
          notes: `Transfert de site lors du check-up mobile (${oldSiteName} -> ${newSiteName}). Nouveau rang: ${selectedBin.trim()}`
        });
      }

      if (difference !== 0) {
        await addMovement({
          wineId: countingWine.id,
          wineName: `${countingWine.name} (${countingWine.vintage})`,
          type: 'correction',
          quantity: Math.abs(difference),
          reason: 'correction',
          notes: `Ajustement d'inventaire sur iPhone par l'employé (${difference > 0 ? 'Surplus' : 'Déficit'} de ${Math.abs(difference)} bt).`,
          fromSiteId: difference < 0 ? selectedSiteId : undefined,
          toSiteId: difference > 0 ? selectedSiteId : undefined
        });
      } else if (!siteChanged) {
        await addMovement({
          wineId: countingWine.id,
          wineName: `${countingWine.name} (${countingWine.vintage})`,
          type: 'correction',
          quantity: 0,
          reason: 'correction',
          notes: `Vérification d'inventaire sur iPhone. Stock exact (${tempQty} bt). Site: ${sites.find(s => s.id === selectedSiteId)?.name?.split(' - ')[0]}, Rang: ${selectedBin.trim()}`,
          toSiteId: selectedSiteId
        });
      }

      setAuditSuccess(`Inventaire & Emplacement validés pour "${countingWine.name}" !`);
      setCountingWine(null);
      setTimeout(() => setAuditSuccess(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  // Reusable counting terminal renderer (used for both desktop column & mobile bottom sheet)
  const renderCountingTerminal = (isMobileSheet: boolean) => {
    if (!countingWine) return null;

    return (
      <div className="space-y-5">
        {/* Header Info */}
        <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-mono font-bold uppercase text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block">
              Saisie en cours
            </span>
            <h3 className="text-base font-bold text-slate-900 truncate mt-1">{countingWine.name}</h3>
            <p className="text-xs text-slate-500 truncate font-mono">{countingWine.domain} &bull; {countingWine.vintage}</p>
          </div>
          <button
            type="button"
            onClick={() => setCountingWine(null)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer text-xs font-mono font-bold shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Huge Tactile Counter (Optimized for thumb) */}
        <div className="text-center space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Ajuster la quantité physique
          </p>
          
          <div className="flex items-center justify-center gap-5 sm:gap-6">
            {/* Minus button */}
            <button
              type="button"
              onClick={() => handleAdjustTemp(-1)}
              className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full flex items-center justify-center text-slate-700 font-bold border border-slate-200/80 shadow-sm cursor-pointer select-none transition-transform"
              style={{ touchAction: 'manipulation' }}
              aria-label="Diminuer de 1"
            >
              <Minus className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Quantity Display */}
            <div className="space-y-0.5 min-w-[90px]">
              <span className="text-5xl font-mono font-bold text-slate-900 block tracking-tight">
                {tempQty}
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                bouteille{tempQty > 1 ? 's' : ''}
              </span>
            </div>

            {/* Plus button */}
            <button
              type="button"
              onClick={() => handleAdjustTemp(1)}
              className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-full flex items-center justify-center text-white font-bold border border-slate-950/20 shadow-sm cursor-pointer select-none transition-transform"
              style={{ touchAction: 'manipulation' }}
              aria-label="Augmenter de 1"
            >
              <Plus className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </div>

          {/* Audit Comparison Status */}
          <div className="py-2 px-3 rounded-xl text-xs font-mono inline-block bg-slate-50 border border-slate-100">
            {tempQty === countingWine.quantity ? (
              <span className="text-slate-500 font-medium">Stock inchangé (Conforme)</span>
            ) : (
              <span className={`font-bold ${tempQty > countingWine.quantity ? 'text-emerald-600' : 'text-rose-600'}`}>
                Correction : {tempQty > countingWine.quantity ? '+' : ''}{tempQty - countingWine.quantity} bouteille{Math.abs(tempQty - countingWine.quantity) > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Shortcuts Grid (Quick taps for crates/boxes) */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider text-center font-bold">
            Saisie rapide (Caisses)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 6, 12, 24].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => setTempQty(qty)}
                className={`h-10 border text-xs font-mono font-bold rounded-xl cursor-pointer select-none transition-all ${
                  tempQty === qty
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {qty === 0 ? 'Zéro' : `${qty} bt`}
              </button>
            ))}
          </div>
        </div>

        {/* Site & Rang Adjustment in Mobile Counting Terminal */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-600" /> Emplacement
            </span>
            {selectedSiteId !== countingWine.siteId && (
              <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Transfert de site
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] uppercase font-mono font-bold text-slate-400 mb-0.5">
                Site
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                onBlur={handleInputBlur}
                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500 font-sans cursor-pointer"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase font-mono font-bold text-slate-400 mb-0.5">
                Rang / Étagère
              </label>
              <input
                type="text"
                value={selectedBin}
                onChange={(e) => setSelectedBin(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Ex: 1D4, A2..."
                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-red-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Big Touch Validation Button (at least 48px height) */}
        <button
          type="button"
          onClick={saveInventoryAudit}
          disabled={isAuditing}
          className="w-full h-13 sm:h-14 bg-red-600 hover:bg-red-700 active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer text-sm font-sans select-none"
          style={{ touchAction: 'manipulation' }}
        >
          {isAuditing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Valider & Enregistrer l'inventaire
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-red-500 font-mono text-xs font-bold uppercase mb-1">
            <Smartphone className="w-4 h-4 text-red-400 animate-bounce" />
            <span>Mode Inventaire Tactile</span>
          </div>
          <h2 className="text-xl font-bold font-sans">iPhone & Cave Terminal</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Optimisé pour une saisie fluide, ultra-réactive et à une main en cave.
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-red-400 shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Mobile Search & List (Full width on mobile, 7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            
            {/* Active Site Picker Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 font-sans shrink-0">Site actif :</span>
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  onBlur={handleInputBlur}
                  className="h-8 bg-slate-100 border border-slate-200 text-slate-900 font-bold text-xs rounded-lg px-2 outline-none cursor-pointer flex-grow sm:flex-grow-0"
                >
                  <option value="all">Tous les sites de stock</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsWineFormOpen(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-xs shrink-0 select-none self-stretch sm:self-auto justify-center"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Créer Référence</span>
              </button>
            </div>

            {/* Mode Tabs: En stock sur ce site | Catalogue Master | Tous du site */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setInventoryViewMode('in_stock')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center select-none ${
                  inventoryViewMode === 'in_stock'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                En stock ({wines.filter(w => (selectedSite === 'all' || w.siteId === selectedSite) && w.quantity > 0).length})
              </button>

              <button
                type="button"
                onClick={() => setInventoryViewMode('all_catalog')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center select-none ${
                  inventoryViewMode === 'all_catalog'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                Catalogue ({wines.length})
              </button>

              <button
                type="button"
                onClick={() => setInventoryViewMode('all_site')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center select-none ${
                  inventoryViewMode === 'all_site'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                Tous du site ({wines.filter(w => selectedSite === 'all' || w.siteId === selectedSite).length})
              </button>
            </div>

            {/* Search Input & Alert Toggle */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-grow">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    inventoryViewMode === 'all_catalog'
                      ? "Chercher une référence dans la cave à ajouter..."
                      : "Filtrer par nom, domaine, emplacement (ex: 1D4)..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onBlur={handleInputBlur}
                  className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl pl-9 pr-8 text-slate-900 text-xs outline-none transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOnlyAlerts(prev => !prev)}
                className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer transition-colors shrink-0 select-none ${
                  onlyAlerts 
                    ? 'bg-amber-50 border-amber-300 text-amber-700' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Seuils bas</span>
              </button>
            </div>

            {/* Quick Sort Bar (Nom, Domaine, Rang, Stock) */}
            <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1 text-slate-400 font-bold shrink-0">
                <SlidersHorizontal className="w-3 h-3 text-slate-400" /> Tri :
              </span>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors select-none ${
                    sortBy === 'name' ? 'bg-red-50 text-red-700 font-bold border border-red-200' : 'hover:text-slate-900'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  Nom {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('domain')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors select-none ${
                    sortBy === 'domain' ? 'bg-red-50 text-red-700 font-bold border border-red-200' : 'hover:text-slate-900'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  Domaine {sortBy === 'domain' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('bin')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors select-none ${
                    sortBy === 'bin' ? 'bg-red-50 text-red-700 font-bold border border-red-200' : 'hover:text-slate-900'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  Rang {sortBy === 'bin' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('quantity')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors select-none ${
                    sortBy === 'quantity' ? 'bg-red-50 text-red-700 font-bold border border-red-200' : 'hover:text-slate-900'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  Stock {sortBy === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>

          {auditSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>{auditSuccess}</span>
            </div>
          )}

          {/* Wine List: Unified flow on mobile, contained height on desktop */}
          <div className="space-y-2.5 lg:max-h-[640px] lg:overflow-y-auto pr-0 lg:pr-1">
            {filteredWines.length === 0 ? (
              <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 font-mono text-xs">
                Aucun vin ne correspond aux critères de recherche mobile.
              </div>
            ) : (
              filteredWines.map((wine) => {
                const site = sites.find(s => s.id === wine.siteId);
                const locationBadge = wine.bin ? wine.bin.replace(/[\s\-_]/g, '').toUpperCase() : 'N/C';
                
                // Inventory status
                const isSelected = countingWine?.id === wine.id;
                const lastAudit = wine.notes?.match(/Dernier inventaire: le [^\n\r]+/)?.[0];

                // Find if this exact same wine exists in other sites with stock > 0
                const sameRefWines = winesByRefMap.get(getWineReferenceKey(wine)) || [];
                const otherSitesWines = sameRefWines.filter(w => w.id !== wine.id && w.quantity > 0);

                return (
                  <div
                    key={wine.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => startCounting(wine)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startCounting(wine);
                      }
                    }}
                    className={`clickable p-3.5 bg-white border rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150 select-none ${
                      isSelected 
                        ? 'border-red-500 bg-red-50/20 ring-1 ring-red-500' 
                        : 'border-slate-200/80 hover:border-slate-300 active:bg-slate-50'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="min-w-0 pr-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded-lg shrink-0" title={site?.name}>
                          {site?.name?.split(' - ')[0]} • {locationBadge}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate">{wine.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">({wine.vintage})</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="truncate max-w-[150px] font-medium">{wine.domain}</span>
                        <span>&bull;</span>
                        <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px]">
                          {wine.quantity} bt{wine.quantity > 1 ? 's' : ''} ici
                        </span>
                        
                        {otherSitesWines.map(otherWine => {
                          const otherSite = sites.find(s => s.id === otherWine.siteId);
                          const otherSiteName = otherSite ? otherSite.name.split(' - ')[0] : 'Autre';
                          return (
                            <span key={otherWine.id} className="bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                              {otherSiteName} ({otherWine.quantity})
                            </span>
                          );
                        })}
                      </div>

                      {lastAudit && (
                        <p className="text-[9px] font-mono text-slate-400 italic truncate pt-0.5">
                          {lastAudit}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDispatchWine(wine);
                        }}
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border border-amber-200 cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-mono font-bold select-none"
                        style={{ touchAction: 'manipulation' }}
                        title="Ventiler ou transférer les bouteilles entre les sites"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Ventiler</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => openQuickLocationModal(wine, e)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200/80 cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-mono font-bold select-none"
                        style={{ touchAction: 'manipulation' }}
                        title="Modifier site / rang"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-red-600" />
                        <span className="hidden sm:inline">Emplacement</span>
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Desktop Counting Terminal (5 cols, visible on screens >= lg) */}
        <div className="hidden lg:block lg:col-span-5">
          {countingWine ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-5 sticky top-28">
              {renderCountingTerminal(false)}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-16 px-6 text-center text-slate-400 space-y-3 sticky top-28">
              <Smartphone className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <p className="font-bold text-slate-600 text-sm">Prêt pour comptage tactile</p>
                <p className="text-xs text-slate-400 max-w-[220px] mx-auto mt-1 leading-relaxed">
                  Sélectionnez un vin dans la liste de gauche pour lancer le comptage mobile.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MOBILE BOTTOM SHEET DRAWER (Sliding up from bottom on iPhone / mobile viewports) */}
      {countingWine && (
        <div 
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setCountingWine(null)}
        >
          <div 
            className="bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Native-style drag / pull indicator */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" />
            {renderCountingTerminal(true)}
          </div>
        </div>
      )}

      {/* Quick Location Edit Modal overlay for mobile cards */}
      {quickLocationWine && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" 
          onClick={() => setQuickLocationWine(null)}
        >
          <div 
            className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-red-600 font-mono text-[10px] font-bold uppercase">
                  <MapPin className="w-3.5 h-3.5" /> Modification Express Emplacement
                </div>
                <h3 className="text-base font-bold text-slate-900 font-sans mt-0.5">{quickLocationWine.name}</h3>
                <p className="text-xs text-slate-500 font-serif italic">{quickLocationWine.domain} ({quickLocationWine.vintage})</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickLocationWine(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickLocationModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 font-sans mb-1">
                  Site de stockage
                </label>
                <select
                  value={quickModalSiteId}
                  onChange={(e) => setQuickModalSiteId(e.target.value)}
                  onBlur={handleInputBlur}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-900 focus:border-red-500 font-sans"
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-sans mb-1">
                  Rang / Emplacement (Allée, étagère)
                </label>
                <input
                  type="text"
                  value={quickModalBin}
                  onChange={(e) => setQuickModalBin(e.target.value)}
                  onBlur={handleInputBlur}
                  placeholder="Ex: 1D4, Rang 3..."
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-mono font-bold text-slate-900 focus:border-red-500 uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickLocationWine(null)}
                  className="px-4 h-11 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickLoc}
                  className="px-5 h-11 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                  style={{ touchAction: 'manipulation' }}
                >
                  {isSavingQuickLoc ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Valider l'emplacement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Site Dispatch Modal */}
      {dispatchWine && (
        <MultiSiteDispatchModal
          referenceWine={dispatchWine}
          onClose={() => setDispatchWine(null)}
        />
      )}

      {/* Wine Form & Reference Search Modal */}
      {isWineFormOpen && (
        <WineFormModal
          defaultSiteId={selectedSite === 'all' ? undefined : selectedSite}
          onClose={() => setIsWineFormOpen(false)}
        />
      )}
    </div>
  );
};
