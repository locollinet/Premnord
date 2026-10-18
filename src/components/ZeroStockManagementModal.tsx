import React, { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, Site, WineColor, getWineReferenceKey, getCanonicalDomain } from '../types';
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  X, 
  Check, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  Layers, 
  Clock, 
  Building2, 
  Sparkles, 
  Info, 
  RefreshCw,
  Wine as WineIcon,
  ShieldAlert,
  FileSpreadsheet,
  Download,
  AlertOctagon
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ZeroStockManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWine?: (wineId: string) => void;
}

type ZeroStockCategoryFilter = 'all' | 'total_out' | 'mono_site_reliquat' | 'orphan_no_movements' | 'with_history';

interface ZeroStockWineItem {
  wine: Wine;
  siteName: string;
  referenceKey: string;
  totalStockAcrossAllSites: number;
  otherSitesSummary: string | null;
  movementsCount: number;
  lastMovementDate: Date | null;
  lastMovementReason: string | null;
  isMonoSiteReliquat: boolean;
  isTotalRupture: boolean;
  isOrphanNoMovements: boolean;
}

const COLOR_BADGES: Record<WineColor, { label: string; badge: string }> = {
  rouge: { label: 'Rouge', badge: 'bg-red-50 text-red-700 border-red-200' },
  blanc: { label: 'Blanc', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { label: 'Rosé', badge: 'bg-pink-50 text-pink-700 border-pink-200' },
  bulle: { label: 'Bulle', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  orange: { label: 'Orange', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  spiritueux: { label: 'Spiritueux', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  cidre_biere: { label: 'Bière/Cidre', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  soft: { label: 'Soft', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  autre: { label: 'Autre', badge: 'bg-slate-50 text-slate-700 border-slate-200' }
};

export const ZeroStockManagementModal: React.FC<ZeroStockManagementModalProps> = ({
  isOpen,
  onClose,
  onSelectWine
}) => {
  const { wines, sites, movements, deleteWine, deleteWinesBatch } = useFirebase();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<ZeroStockCategoryFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'site' | 'movements' | 'created'>('name');

  // Selected wine IDs for deletion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing & Confirmation modal state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Single item deletion prompt
  const [singleItemToDelete, setSingleItemToDelete] = useState<ZeroStockWineItem | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showConfirmModal) setShowConfirmModal(false);
        else if (singleItemToDelete) setSingleItemToDelete(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmModal, singleItemToDelete, onClose]);

  // Sites map for fast lookup
  const sitesMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach(s => map.set(s.id, s.name));
    return map;
  }, [sites]);

  // Reference key stock map (sum across all sites)
  const totalStockByRefKey = useMemo(() => {
    const map = new Map<string, { total: number; sites: Array<{ siteName: string; qty: number }> }>();
    wines.forEach(w => {
      const key = getWineReferenceKey(w);
      const entry = map.get(key) || { total: 0, sites: [] };
      entry.total += (w.quantity || 0);
      if ((w.quantity || 0) > 0) {
        const sName = sitesMap.get(w.siteId) || 'Site';
        entry.sites.push({ siteName: sName.split(' - ')[0], qty: w.quantity });
      }
      map.set(key, entry);
    });
    return map;
  }, [wines, sitesMap]);

  // Movements indexed by wineId for ultra-fast O(1) lookup
  const movementsByWineId = useMemo(() => {
    const map = new Map<string, Array<{ date: Date; reason: string; type: string }>>();
    movements.forEach(m => {
      if (!m.wineId) return;
      const list = map.get(m.wineId) || [];
      list.push({
        date: new Date(m.createdAt),
        reason: m.reason || 'Mouvement',
        type: m.type
      });
      map.set(m.wineId, list);
    });
    // Sort each list chronologically descending
    map.forEach(list => list.sort((a, b) => b.date.getTime() - a.date.getTime()));
    return map;
  }, [movements]);

  // Compute all items with quantity === 0
  const allZeroStockItems: ZeroStockWineItem[] = useMemo(() => {
    const zeroWines = wines.filter(w => (w.quantity || 0) === 0);

    return zeroWines.map(w => {
      const siteName = sitesMap.get(w.siteId) || 'Site Inconnu';
      const refKey = getWineReferenceKey(w);
      const refStockInfo = totalStockByRefKey.get(refKey);
      const totalStockAcrossAllSites = refStockInfo ? refStockInfo.total : 0;

      // Summary of where stock exists on other sites
      let otherSitesSummary: string | null = null;
      if (refStockInfo && refStockInfo.sites.length > 0) {
        otherSitesSummary = refStockInfo.sites.map(s => `${s.siteName}: ${s.qty} bt`).join(', ');
      }

      const wineMovements = movementsByWineId.get(w.id) || [];
      const movementsCount = wineMovements.length;
      const lastMovement = wineMovements[0] || null;

      const isMonoSiteReliquat = totalStockAcrossAllSites > 0;
      const isTotalRupture = totalStockAcrossAllSites === 0;
      const isOrphanNoMovements = movementsCount === 0;

      return {
        wine: w,
        siteName,
        referenceKey: refKey,
        totalStockAcrossAllSites,
        otherSitesSummary,
        movementsCount,
        lastMovementDate: lastMovement ? lastMovement.date : null,
        lastMovementReason: lastMovement ? `${lastMovement.type === 'out' ? 'Sortie' : lastMovement.type === 'in' ? 'Entrée' : 'Mouvement'} (${lastMovement.reason})` : null,
        isMonoSiteReliquat,
        isTotalRupture,
        isOrphanNoMovements
      };
    });
  }, [wines, sitesMap, totalStockByRefKey, movementsByWineId]);

  // Synthesis metrics across all 0-stock wines
  const metrics = useMemo(() => {
    const total = allZeroStockItems.length;
    const totalRupture = allZeroStockItems.filter(i => i.isTotalRupture).length;
    const monoSiteReliquat = allZeroStockItems.filter(i => i.isMonoSiteReliquat).length;
    const orphanNoMovements = allZeroStockItems.filter(i => i.isOrphanNoMovements).length;
    const withHistory = allZeroStockItems.filter(i => !i.isOrphanNoMovements).length;

    return {
      total,
      totalRupture,
      monoSiteReliquat,
      orphanNoMovements,
      withHistory
    };
  }, [allZeroStockItems]);

  // Filter and sort items for display
  const filteredItems = useMemo(() => {
    return allZeroStockItems.filter(item => {
      // 1. Site filter
      if (selectedSiteFilter !== 'all' && item.wine.siteId !== selectedSiteFilter) {
        return false;
      }

      // 2. Category filter
      if (categoryFilter === 'total_out' && !item.isTotalRupture) return false;
      if (categoryFilter === 'mono_site_reliquat' && !item.isMonoSiteReliquat) return false;
      if (categoryFilter === 'orphan_no_movements' && !item.isOrphanNoMovements) return false;
      if (categoryFilter === 'with_history' && item.isOrphanNoMovements) return false;

      // 3. Search query filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const text = `${item.wine.domain} ${item.wine.name} ${item.wine.cuvee || ''} ${item.wine.appellation || ''} ${item.wine.vintage} ${item.wine.bin || ''} ${item.siteName}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const dComp = (a.wine.domain || '').localeCompare(b.wine.domain || '', 'fr');
        if (dComp !== 0) return dComp;
        const nComp = (a.wine.name || '').localeCompare(b.wine.name || '', 'fr');
        if (nComp !== 0) return nComp;
        return (a.wine.vintage || '').localeCompare(b.wine.vintage || '', 'fr');
      }
      if (sortBy === 'site') {
        return a.siteName.localeCompare(b.siteName, 'fr');
      }
      if (sortBy === 'movements') {
        return b.movementsCount - a.movementsCount;
      }
      if (sortBy === 'created') {
        return (b.wine.createdAt || 0) - (a.wine.createdAt || 0);
      }
      return 0;
    });
  }, [allZeroStockItems, selectedSiteFilter, categoryFilter, searchTerm, sortBy]);

  // Toggle single item selection
  const toggleSelect = (wineId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(wineId)) next.delete(wineId);
      else next.add(wineId);
      return next;
    });
  };

  // Toggle all filtered items selection
  const toggleSelectAllFiltered = () => {
    if (selectedIds.size >= filteredItems.length && filteredItems.length > 0) {
      // Deselect filtered
      setSelectedIds(new Set());
    } else {
      // Select all filtered
      const next = new Set<string>();
      filteredItems.forEach(i => next.add(i.wine.id));
      setSelectedIds(next);
    }
  };

  // Smart selection helpers
  const selectOrphanPresets = () => {
    const next = new Set<string>();
    filteredItems.filter(i => i.isOrphanNoMovements).forEach(i => next.add(i.wine.id));
    setSelectedIds(next);
  };

  const selectMonoSiteReliquats = () => {
    const next = new Set<string>();
    filteredItems.filter(i => i.isMonoSiteReliquat).forEach(i => next.add(i.wine.id));
    setSelectedIds(next);
  };

  const selectTotalRuptures = () => {
    const next = new Set<string>();
    filteredItems.filter(i => i.isTotalRupture).forEach(i => next.add(i.wine.id));
    setSelectedIds(next);
  };

  // Perform single item deletion
  const handleConfirmSingleDelete = async () => {
    if (!singleItemToDelete) return;
    setIsDeleting(true);
    setErrorNotice(null);
    try {
      await deleteWine(singleItemToDelete.wine.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(singleItemToDelete.wine.id);
        return next;
      });
      setSuccessNotice(`La fiche "${singleItemToDelete.wine.name} (${singleItemToDelete.wine.vintage})" a été supprimée.`);
      setSingleItemToDelete(null);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error("Erreur lors de la suppression du vin:", err);
      setErrorNotice(err?.message || "Impossible de supprimer cette référence.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Perform batch deletion
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setErrorNotice(null);
    try {
      const idsArray = Array.from(selectedIds);
      const deletedCount = await deleteWinesBatch(idsArray);
      setSelectedIds(new Set());
      setShowConfirmModal(false);
      setSuccessNotice(`Succès : ${deletedCount} référence(s) à stock 0 ont été supprimées définitivement.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error("Erreur lors de la suppression par lot:", err);
      setErrorNotice(err?.message || "Erreur lors de la suppression groupée.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export current list to Excel for archive before deletion
  const handleExportZeroStockExcel = () => {
    try {
      const sheetData: any[][] = [];
      sheetData.push(['PREMNORD - EXTRACTION DES RÉFÉRENCES À STOCK 0 (INVENTAIRE DES RUPTURES)']);
      sheetData.push([`Date d'extraction : ${new Date().toLocaleString('fr-FR')}`]);
      sheetData.push([`Nombre total de références à stock 0 : ${filteredItems.length}`]);
      sheetData.push([]);

      const headers = [
        'ID Réf',
        'Domaine',
        'Nom du Vin',
        'Cuvée',
        'Millésime',
        'Couleur',
        'Format',
        'Site Actuel (Stock 0)',
        'Casier',
        'Statut Cave',
        'Stock sur Autres Sites',
        'Mouvements Historiques',
        'Dernier Mouvement',
        'Prix Achat HT (€)',
        'Prix Vente TTC (€)'
      ];
      sheetData.push(headers);

      filteredItems.forEach(i => {
        const w = i.wine;
        sheetData.push([
          w.id.substring(0, 8),
          w.domain || '',
          w.name || '',
          w.cuvee || '',
          w.vintage || 'S.A.',
          (w.color || '').toUpperCase(),
          w.format || '75cl',
          i.siteName,
          w.bin || '',
          i.isMonoSiteReliquat ? 'Reliquat (Stock ailleurs)' : 'Rupture totale cave',
          i.otherSitesSummary || 'Aucun (0 partout)',
          i.movementsCount,
          i.lastMovementDate ? `${i.lastMovementDate.toLocaleDateString('fr-FR')} - ${i.lastMovementReason}` : 'Aucun',
          w.priceBuy || w.priceBuyHt || '',
          w.priceSell || ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 24 },
        { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 18 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'References_Stock_0');
      const now = new Date();
      const dateStr = `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}`;
      XLSX.writeFile(wb, `Premnord_References_Stock_0_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Erreur lors de l'export Excel:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      
      {/* Main Modal Window */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* 1. Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200/60 shadow-xs shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                  Maintenance & Assainissement
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {metrics.total} fiche(s) à 0 bt
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                Identification & Arbitrage des Références à Stock 0
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleExportZeroStockExcel}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Exporter cette liste en Excel avant de supprimer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exporter (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors cursor-pointer"
              title="Fermer la fenêtre (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {errorNotice && (
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-2.5 text-xs font-bold text-rose-800 flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* 2. Executive KPI Cards & Category Filters */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white border-b border-slate-800 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* KPI 1: Rupture Totale Cave */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'total_out' ? 'all' : 'total_out')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                categoryFilter === 'total_out'
                  ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block">
                Rupture Totale Cave
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-mono font-black text-white">
                  {metrics.totalRupture}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">0 bt partout</span>
              </div>
            </button>

            {/* KPI 2: Reliquats Mono-Site */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'mono_site_reliquat' ? 'all' : 'mono_site_reliquat')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                categoryFilter === 'mono_site_reliquat'
                  ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block">
                Reliquats Mono-Site
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-mono font-black text-white">
                  {metrics.monoSiteReliquat}
                </span>
                <span className="text-[10px] text-blue-300 font-sans">Stock ailleurs !</span>
              </div>
            </button>

            {/* KPI 3: Fiches Orphelines (0 mouvement) */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'orphan_no_movements' ? 'all' : 'orphan_no_movements')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                categoryFilter === 'orphan_no_movements'
                  ? 'bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                Fiches Orphelines
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-mono font-black text-white">
                  {metrics.orphanNoMovements}
                </span>
                <span className="text-[10px] text-amber-300 font-sans">0 mouvement</span>
              </div>
            </button>

            {/* KPI 4: Avec Historique de mouvements */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'with_history' ? 'all' : 'with_history')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                categoryFilter === 'with_history'
                  ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">
                Avec Historique
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-mono font-black text-white">
                  {metrics.withHistory}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">Ventes / Sorties</span>
              </div>
            </button>

          </div>

          {/* Search, Site Filter & Quick Selection Presets */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par domaine, vin, millésime, casier, site..."
                className="w-full bg-slate-800 text-white pl-10 pr-4 py-2 rounded-xl text-xs font-sans border border-slate-700 focus:border-rose-500 outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Site selector */}
            <div className="w-full md:w-56 shrink-0">
              <select
                value={selectedSiteFilter}
                onChange={(e) => setSelectedSiteFilter(e.target.value)}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="all">Tous les sites ({sites.length})</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                ))}
              </select>
            </div>

            {/* Sort selector */}
            <div className="w-full md:w-48 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="name">Trier par Nom (A-Z)</option>
                <option value="site">Trier par Site</option>
                <option value="movements">Trier par Nb mouvements</option>
                <option value="created">Trier par Date de création</option>
              </select>
            </div>

          </div>

          {/* Quick Preset Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Présélections rapides :</span>
              <button
                type="button"
                onClick={selectOrphanPresets}
                className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-700/60 rounded-lg transition-colors cursor-pointer"
                title="Sélectionner uniquement les fiches sans aucun mouvement historique"
              >
                ⚡ Sans mouvements ({metrics.orphanNoMovements})
              </button>
              <button
                type="button"
                onClick={selectTotalRuptures}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-700/60 rounded-lg transition-colors cursor-pointer"
                title="Sélectionner les vins à 0 bt sur l'ensemble de tous les sites"
              >
                🔴 Ruptures totales ({metrics.totalRupture})
              </button>
              <button
                type="button"
                onClick={selectMonoSiteReliquats}
                className="px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-700/60 rounded-lg transition-colors cursor-pointer"
                title="Sélectionner les fiches à 0 qui ont du stock sur un autre site"
              >
                🔵 Reliquats mono-site ({metrics.monoSiteReliquat})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
              >
                {selectedIds.size >= filteredItems.length && filteredItems.length > 0
                  ? 'Tout désélectionner'
                  : `Tout sélectionner (${filteredItems.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Items List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-slate-100 bg-white">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200">
                <Check className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 font-sans">
                Aucune référence à stock 0 correspondant aux filtres
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Toutes les références correspondant à vos critères actuels possèdent du stock, ou le catalogue a déjà été nettoyé.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(item => {
                const w = item.wine;
                const isSelected = selectedIds.has(w.id);
                const colorInfo = COLOR_BADGES[w.color] || COLOR_BADGES.autre;

                return (
                  <div
                    key={w.id}
                    onClick={() => toggleSelect(w.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/20 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Left: Checkbox + Wine details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(w.id);
                          }}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-white border-slate-300 hover:border-slate-400 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colorInfo.badge}`}>
                            {colorInfo.label}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {w.vintage || 'S.A.'}
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {w.domain || 'Domaine Inconnu'}
                          </span>
                          {w.cuvee && (
                            <span className="text-[11px] font-serif italic text-slate-500">
                              « {w.cuvee} »
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                          {w.name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-sans">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <strong>{item.siteName}</strong>
                            {w.bin && <span className="text-slate-400">({w.bin})</span>}
                          </span>

                          <span>&bull;</span>

                          <span className="font-mono text-[11px]">
                            Format: <strong>{w.format || '75cl'}</strong>
                          </span>

                          {(w.priceBuy || w.priceBuyHt) && (
                            <>
                              <span>&bull;</span>
                              <span className="font-mono text-[11px] text-slate-600">
                                PA: <strong>{(w.priceBuy || w.priceBuyHt || 0).toFixed(2)} € HT</strong>
                              </span>
                            </>
                          )}

                          {w.priceSell && (
                            <>
                              <span>&bull;</span>
                              <span className="font-mono text-[11px] text-slate-600">
                                PV: <strong>{w.priceSell.toFixed(2)} € TTC</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Status Badges & Warnings */}
                        <div className="flex flex-wrap items-center gap-2 pt-1.5">
                          {/* Multi-site status */}
                          {item.isMonoSiteReliquat ? (
                            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                              <Info className="w-3 h-3 text-blue-600" />
                              <span>En stock ailleurs : {item.otherSitesSummary}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                              <AlertOctagon className="w-3 h-3 text-rose-600" />
                              <span>Rupture totale cave (0 bt sur tous les sites)</span>
                            </span>
                          )}

                          {/* Historical movements status */}
                          {item.isOrphanNoMovements ? (
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Fiche orpheline (0 mouvement enregistré)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>
                                {item.movementsCount} mouvement(s) &bull; Dernier : {item.lastMovementDate?.toLocaleDateString('fr-FR')} {item.lastMovementReason && `(${item.lastMovementReason})`}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Individual Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {onSelectWine && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWine(w.id);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer"
                          title="Voir la fiche détaillée du vin"
                        >
                          Voir fiche
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSingleItemToDelete(item);
                        }}
                        className="p-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-xl border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-2xs"
                        title="Supprimer uniquement cette référence de la cave"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Modal Sticky Footer Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-bold text-slate-900">{filteredItems.length}</span> référence(s) affichée(s) &bull;
            <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
              {selectedIds.size} sélectionnée(s)
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Fermer
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0 || isDeleting}
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Suppression en cours...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer la sélection ({selectedIds.size})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Modal Overlay for Batch Deletion */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-rose-200 space-y-5 text-slate-800">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg sm:text-xl font-serif font-black text-slate-900">
                Confirmer la suppression définitive ?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-sans">
                Vous êtes sur le point de supprimer <strong className="text-rose-700 font-mono font-bold">{selectedIds.size} référence(s)</strong> à 0 bouteille de la cave.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-700 font-sans">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Garanties & Traçabilité :</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Les fiches produits seront retirées du catalogue et des inventaires.</li>
                <li>L'historique des mouvements passés et la traçabilité comptable restent <strong className="text-slate-800">100% préservés</strong> dans les journaux d'audit.</li>
                <li>Cette action est immédiate et libère le référentiel de cave.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-mono text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmBatchDelete}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold font-mono text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Oui, supprimer ({selectedIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay for Single Item Deletion */}
      {singleItemToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-rose-200 space-y-4 text-slate-800">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-serif font-black text-slate-900">
                Supprimer cette référence ?
              </h3>
              <p className="text-xs text-slate-600 font-sans">
                Confirmez la suppression de <strong className="text-slate-900 font-semibold">{singleItemToDelete.wine.domain} - {singleItemToDelete.wine.name} ({singleItemToDelete.wine.vintage})</strong> sur le site <strong className="text-slate-900">{singleItemToDelete.siteName}</strong>.
              </p>
            </div>

            {singleItemToDelete.isMonoSiteReliquat && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-blue-800">
                  <Info className="w-3.5 h-3.5" /> Note multi-sites :
                </span>
                <p>
                  Ce vin existe encore sur d'autres sites ({singleItemToDelete.otherSitesSummary}). Seule la fiche vide sur {singleItemToDelete.siteName} sera supprimée.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSingleItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-mono text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmSingleDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold font-mono text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
