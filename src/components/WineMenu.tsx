import React, { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, getCanonicalDomain } from '../types';
import { 
  Sparkles, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Printer, 
  Sliders, 
  Palette, 
  FileText, 
  Settings as SettingsIcon, 
  LayoutGrid, 
  Rows, 
  BookOpen, 
  Info,
  Edit2,
  Check,
  FileSpreadsheet,
  Plus,
  Compass,
  Layers,
  MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PremnordLogo } from './PremnordLogo';
import { WineMenuDocumentStyle } from './WineMenuDocumentStyle';
import { groupWinesBySiteAndSubRegion, SiteWineGroup } from '../lib/wineGrouping';

interface MenuStyleConfig {
  theme: 'classic' | 'modern' | 'bistro' | 'prestige';
  columns: 1 | 2;
  spacing: 'compact' | 'normal' | 'spacious';
  fontSize: 'sm' | 'md' | 'lg';
  showLogo: boolean;
  showNotes: boolean;
  showRegion: boolean;
  showVintage: boolean;
  accentColor: 'gold' | 'burgundy' | 'slate' | 'emerald' | 'bronze';
  showPriceLine: boolean;
  headerStyle: 'ornate' | 'minimal' | 'modern';
}

export const WineMenu: React.FC = () => {
  const { wines, sites, updateWine, addMovement } = useFirebase();
  const [layoutMode, setLayoutMode] = useState<'interactive' | 'booklet'>('booklet');
  const [replenishingId, setReplenishingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editVisibilityMode, setEditVisibilityMode] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'design' | 'sommelier'>('design');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<'all' | 'site-1' | 'site-2' | 'site-3' | 'site-4'>('all');
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Interactive menu style config matching standard custom word print templates
  const [config, setConfig] = useState<MenuStyleConfig>({
    theme: 'classic',
    columns: 1,
    spacing: 'normal',
    fontSize: 'md',
    showLogo: true,
    showNotes: true,
    showRegion: true,
    showVintage: true,
    accentColor: 'gold',
    showPriceLine: true,
    headerStyle: 'ornate'
  });

  // Precompute lookup map of wines by reference to optimize duplicate detection (O(N) instead of O(N^2))
  const winesByReference = React.useMemo(() => {
    const map = new Map<string, Wine[]>();
    wines.forEach(w => {
      const key = `${(w.name || '').trim().toLowerCase()}_${(w.domain || '').trim().toLowerCase()}_${(w.vintage || '').toString().trim().toLowerCase()}_${(w.color || '').toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(w);
    });
    return map;
  }, [wines]);

  const handleToggleVisibility = async (wine: Wine) => {
    try {
      await updateWine(wine.id, { hideFromMenu: !wine.hideFromMenu }, 'edit');
    } catch (e) {
      console.error("Toggle visibility error:", e);
    }
  };

  // Group wines strictly by Site 1 -> 2 -> 3 -> 4, then by Région / Sous-Région -> Domaine -> Vin
  const siteWineGroups = useMemo<SiteWineGroup[]>(() => {
    const allowed = selectedSiteFilter === 'all' 
      ? ['site-1', 'site-2', 'site-3', 'site-4'] 
      : [selectedSiteFilter];

    return groupWinesBySiteAndSubRegion(wines, sites, {
      allowedSiteIds: allowed,
      onlyAvailable: true,
      editVisibilityMode
    });
  }, [wines, sites, selectedSiteFilter, editVisibilityMode]);

  // Find wines in reserve or other sites that have the same name + domain + vintage + color
  const getReserveStock = (cardWine: Wine) => {
    const wineKey = `${(cardWine.name || '').trim().toLowerCase()}_${(cardWine.domain || '').trim().toLowerCase()}_${(cardWine.vintage || '').toString().trim().toLowerCase()}_${(cardWine.color || '').toLowerCase()}`;
    const matches = winesByReference.get(wineKey) || [];
    const reserves = matches.filter(w => 
      w.id !== cardWine.id &&
      w.siteId !== cardWine.siteId
    );
    
    const totalReserveQty = reserves.reduce((sum, w) => sum + (w.quantity || 0), 0);
    return {
      total: totalReserveQty,
      items: reserves
    };
  };

  // Quick 1-click replenishment transfer from Site 5 (Réserve) or other sites to Site 1, 2, 3, 4
  const handleReplenish = async (cardWine: Wine, sourceWine: Wine) => {
    if (sourceWine.quantity <= 0) return;
    setReplenishingId(cardWine.id);
    
    // Transfer 6 bottles (or all remaining if less than 6)
    const qtyToTransfer = Math.min(6, sourceWine.quantity);
    
    try {
      // 1. Decrease source wine quantity
      await updateWine(sourceWine.id, { quantity: sourceWine.quantity - qtyToTransfer }, 'stock');
      
      // 2. Increase destination wine quantity
      await updateWine(cardWine.id, { quantity: cardWine.quantity + qtyToTransfer }, 'stock');
      
      // 3. Log the transfer movement
      await addMovement({
        wineId: cardWine.id,
        wineName: `${cardWine.name} (${cardWine.vintage})`,
        type: 'transfer',
        quantity: qtyToTransfer,
        reason: 'transfert',
        notes: `Réapprovisionnement automatique de la carte depuis la réserve (${sites.find(s => s.id === sourceWine.siteId)?.name || 'Réserve'}).`,
        fromSiteId: sourceWine.siteId,
        toSiteId: cardWine.siteId
      });
      
      setSuccessMsg(`Transfert de ${qtyToTransfer} bouteilles de "${cardWine.name}" effectué avec succès !`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error("Replenish error:", e);
    } finally {
      setReplenishingId(null);
    }
  };

  // Interactive state variables
  const [showQuantities, setShowQuantities] = useState(false);
  const [excludedWineIds, setExcludedWineIds] = useState<Set<string>>(new Set());
  const [isEditSelectionMode, setIsEditSelectionMode] = useState(false);

  const toggleWineExclusion = (wineId: string) => {
    const newExcluded = new Set(excludedWineIds);
    if (newExcluded.has(wineId)) {
      newExcluded.delete(wineId);
    } else {
      newExcluded.add(wineId);
    }
    setExcludedWineIds(newExcluded);
  };

  const handleTogglePreSale = async (wine: Wine) => {
    try {
      await updateWine(wine.id, { isPreSale: !wine.isPreSale }, 'edit');
    } catch (e) {
      console.error("Toggle pre-sale error:", e);
    }
  };

  const handleExportExcel = () => {
    const exportRows: any[] = [];

    siteWineGroups.forEach(siteGroup => {
      siteGroup.subRegions.forEach(subRegion => {
        subRegion.domains.forEach(domain => {
          domain.wines.forEach(w => {
            if (excludedWineIds.has(w.id)) return;
            if (!editVisibilityMode && w.hideFromMenu) return;

            exportRows.push({
              'Site': siteGroup.site.name,
              'Région / Sous-région': subRegion.displayLabel,
              'Domaine': domain.domainName,
              'Appellation / Vin': w.name,
              'Millésime': w.vintage || 'S.A.',
              'Couleur': w.color || '',
              'Format': w.format || '75cl',
              'Prix Vente (€)': w.priceSell ? `${w.priceSell.toFixed(2)} €` : 'N/C',
              'Prix Achat HT (€)': w.priceBuyHt || 0,
              'Quantité': w.quantity,
              'Statut': w.isPreSale ? 'Prévente' : (w.quantity > 0 ? 'Disponible' : 'Rupture')
            });
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Carte des Vins par Site");
    
    worksheet['!cols'] = [
      {wch: 28},
      {wch: 28},
      {wch: 26},
      {wch: 36},
      {wch: 10},
      {wch: 10},
      {wch: 12},
      {wch: 14},
      {wch: 14},
      {wch: 10},
      {wch: 12}
    ];

    XLSX.writeFile(workbook, "Carte_des_Vins_Premnord_Sites_1-2-3-4.xlsx");
  };

  // Color theme specifications mapping
  const accentColors = {
    gold: {
      text: 'text-amber-600',
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      line: 'bg-amber-500',
      title: 'text-amber-800'
    },
    burgundy: {
      text: 'text-rose-900',
      border: 'border-rose-300',
      bg: 'bg-rose-50/50',
      badge: 'bg-rose-100 text-rose-950 border-rose-200',
      line: 'bg-rose-800',
      title: 'text-rose-900'
    },
    slate: {
      text: 'text-slate-800',
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      badge: 'bg-slate-100 text-slate-800 border-slate-200',
      line: 'bg-slate-950',
      title: 'text-slate-900'
    },
    emerald: {
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/50',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      line: 'bg-emerald-700',
      title: 'text-emerald-800'
    },
    bronze: {
      text: 'text-[#8C6D4F]',
      border: 'border-[#bca997]/50',
      bg: 'bg-[#faf8f5]',
      badge: 'bg-[#f0ece6] text-[#69513b] border-[#d8cfc4]',
      line: 'bg-[#8C6D4F]',
      title: 'text-[#5A4531]'
    }
  };

  const selectedAccent = accentColors[config.accentColor];

  // Theme styling definitions for the card container
  const getThemeClasses = () => {
    switch (config.theme) {
      case 'modern':
        return {
          container: 'bg-white font-sans text-slate-800 border-slate-200 shadow-lg',
          title: 'font-sans font-black tracking-tight text-slate-900',
          heading: 'font-sans font-extrabold uppercase tracking-widest text-slate-900 border-slate-200 pb-2 border-b-2',
          wineName: 'font-sans font-bold text-slate-900',
          meta: 'font-sans text-slate-500 uppercase tracking-wider text-[11px] font-semibold',
          price: 'font-sans font-extrabold text-slate-900',
          dot: 'border-slate-200',
          divider: 'w-12 h-1.5 bg-slate-950',
          cardPadding: 'p-6 sm:p-10'
        };
      case 'bistro':
        return {
          container: 'bg-[#FCFAF7] font-serif text-stone-800 border-stone-300 shadow-md',
          title: 'font-serif font-black italic text-stone-900',
          heading: 'font-serif font-bold italic text-rose-950 border-rose-900/15 pb-1 border-b',
          wineName: 'font-serif font-bold text-stone-900',
          meta: 'font-sans text-stone-500 font-medium text-[12px]',
          price: 'font-mono font-black text-stone-900',
          dot: 'border-stone-200',
          divider: 'w-16 h-0.5 bg-rose-900',
          cardPadding: 'p-5 sm:p-8'
        };
      case 'prestige':
        return {
          container: 'bg-[#FCFBF7] font-serif text-stone-900 border-double border-[6px] border-[#D4AF37]/30 shadow-xl',
          title: 'font-serif font-light tracking-[0.25em] uppercase text-stone-950',
          heading: 'font-serif font-light tracking-[0.15em] uppercase text-stone-950 border-[#D4AF37]/15 pb-3 border-b-2',
          wineName: 'font-serif font-semibold uppercase tracking-wider text-stone-950',
          meta: 'font-serif text-stone-500 italic text-[12px]',
          price: 'font-serif font-medium text-stone-950',
          dot: 'border-amber-900/10',
          divider: 'w-28 h-0.5 bg-[#D4AF37] mx-auto',
          cardPadding: 'p-8 sm:p-14'
        };
      case 'classic':
      default:
        return {
          container: 'bg-[#FDFDFB] font-serif text-stone-800 border-stone-200 shadow-md',
          title: 'font-serif font-semibold tracking-tight text-slate-900',
          heading: 'font-serif font-bold text-slate-900 border-stone-200 pb-2 border-b',
          wineName: 'font-serif font-bold text-slate-900',
          meta: 'font-serif text-stone-600 italic text-[12px]',
          price: 'font-mono font-bold text-slate-900',
          dot: 'border-stone-200',
          divider: 'w-16 h-0.5 bg-amber-500',
          cardPadding: 'p-6 sm:p-10'
        };
    }
  };

  const themeStyles = getThemeClasses();

  // Spacing helper
  const getSpacingClass = () => {
    switch (config.spacing) {
      case 'compact': return 'py-1.5';
      case 'spacious': return 'py-5';
      case 'normal':
      default: return 'py-3';
    }
  };

  // Font size helper
  const getFontSizeClasses = () => {
    switch (config.fontSize) {
      case 'sm':
        return {
          name: 'text-[13px]',
          meta: 'text-[11px]',
          notes: 'text-[10px]',
          price: 'text-[13px]',
          heading: 'text-base',
          title: 'text-2xl'
        };
      case 'lg':
        return {
          name: 'text-lg',
          meta: 'text-sm',
          notes: 'text-[13px]',
          price: 'text-lg',
          heading: 'text-2xl',
          title: 'text-5xl'
        };
      case 'md':
      default:
        return {
          name: 'text-base',
          meta: 'text-xs',
          notes: 'text-xs',
          price: 'text-base',
          heading: 'text-xl',
          title: 'text-4xl'
        };
    }
  };

  const fSize = getFontSizeClasses();
  const totalRefsCount = siteWineGroups.reduce((acc, g) => acc + g.totalWinesCount, 0);
  const totalBottlesCount = siteWineGroups.reduce((acc, g) => acc + g.totalBottlesCount, 0);

  if (layoutMode === 'booklet') {
    return (
      <div className="space-y-6">
        {/* Layout picker */}
        <div className="flex justify-center border-b border-stone-200 pb-4 print:hidden">
          <div className="bg-stone-100 p-1 rounded-xl flex gap-1 shadow-sm">
            <button
              onClick={() => setLayoutMode('interactive')}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                layoutMode === 'interactive'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Sommelier & Carte par Sites (1-2-3-4)
            </button>
            <button
              onClick={() => setLayoutMode('booklet')}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                layoutMode === 'booklet'
                  ? 'bg-[#BD6346] text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Livre de Cave (Word)
            </button>
          </div>
        </div>

        <WineMenuDocumentStyle />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* High-fidelity layout picker */}
      <div className="flex justify-center border-b border-stone-200 pb-4 print:hidden">
        <div className="bg-stone-100 p-1 rounded-xl flex gap-1 shadow-sm">
          <button
            onClick={() => setLayoutMode('interactive')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              layoutMode === 'interactive'
                ? 'bg-stone-900 text-white shadow'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Sommelier & Carte par Sites (1-2-3-4)
          </button>
          <button
            onClick={() => setLayoutMode('booklet')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              layoutMode === 'booklet'
                ? 'bg-[#BD6346] text-white shadow'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Livre de Cave (Word)
          </button>
        </div>
      </div>

      {/* Print Dynamic Layout Rules Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-wine-menu, #printable-wine-menu * {
            visibility: visible;
          }
          #printable-wine-menu {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #FFFFFF !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          .print-no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Title block & Action bar */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-serif font-bold text-slate-900">Carte des Vins Premnord</h2>
            <span className="px-2.5 py-0.5 bg-[#BD6346]/10 text-[#BD6346] text-xs font-bold rounded-full border border-[#BD6346]/20">
              Sites 1 → 2 → 3 → 4
            </span>
          </div>
          <p className="text-sm text-slate-500 font-sans mt-0.5">
            Organisation séquentielle par Sites de service (1 à 4) puis par Région / Sous-région et Domaine.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="h-10 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="Exporter en fichier Excel structuré par Site"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Sites 1-4
          </button>

          <button
            onClick={() => setShowQuantities(!showQuantities)}
            className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border shadow-xs ${
              showQuantities ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {showQuantities ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showQuantities ? 'Masquer Stock' : 'Afficher Stock'}
          </button>

          <button
            onClick={() => setIsEditSelectionMode(!isEditSelectionMode)}
            className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border shadow-xs ${
              isEditSelectionMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {isEditSelectionMode ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditSelectionMode ? 'Terminer Sélection' : 'Modifier Sélection'}
          </button>

          <button
            onClick={() => setEditVisibilityMode(!editVisibilityMode)}
            className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border shadow-xs ${
              editVisibilityMode
                ? 'bg-amber-600 border-amber-500 text-white hover:bg-amber-700'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {editVisibilityMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {editVisibilityMode ? 'Masquer la gestion' : 'Masquer/Afficher vins'}
          </button>
          
          <button
            onClick={() => window.print()}
            className="h-10 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs uppercase tracking-wide font-mono"
          >
            <Printer className="w-4 h-4" />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Site Quick Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-stone-50 p-2 rounded-2xl border border-stone-200 print:hidden">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider px-2">Navigation :</span>
        <button
          onClick={() => setSelectedSiteFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSiteFilter === 'all'
              ? 'bg-[#BD6346] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Tous les Sites (1 → 2 → 3 → 4)
          <span className="text-[10px] opacity-80">({totalRefsCount} réf.)</span>
        </button>

        <button
          onClick={() => setSelectedSiteFilter('site-1')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSiteFilter === 'site-1'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-900 text-[10px] flex items-center justify-center font-bold">1</span>
          Site 1 : Blancs
        </button>

        <button
          onClick={() => setSelectedSiteFilter('site-2')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSiteFilter === 'site-2'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-900 text-[10px] flex items-center justify-center font-bold">2</span>
          Site 2 : Rouges
        </button>

        <button
          onClick={() => setSelectedSiteFilter('site-3')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSiteFilter === 'site-3'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-900 text-[10px] flex items-center justify-center font-bold">3</span>
          Site 3 : Effervescents
        </button>

        <button
          onClick={() => setSelectedSiteFilter('site-4')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSiteFilter === 'site-4'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-900 text-[10px] flex items-center justify-center font-bold">4</span>
          Site 4 : Cuisine DPR
        </button>
      </div>

      {/* Iframe Restriction Alert */}
      {isInIframe && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs leading-relaxed text-amber-950 print:hidden shadow-sm">
          <div className="flex items-start gap-2.5">
            <Info className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Aperçu dans l'Iframe de développement</p>
              <p className="text-amber-850 text-[11px] mt-0.5">Pour exporter ou imprimer la carte complète, ouvrez l'application dans un nouvel onglet via l'icône ↗️ en haut à droite.</p>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex gap-2 items-center animate-fade-in shadow-sm">
          <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Menu Book (8 Cols) */}
        <div 
          id="printable-wine-menu"
          className={`lg:col-span-8 border rounded-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto ${themeStyles.container} ${themeStyles.cardPadding} space-y-12`}
        >
          {/* Menu Header (Matching La Cave des Peress PDF style) */}
          <div className="pb-6 border-b border-slate-200 print-no-break flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {config.showLogo && (
                <PremnordLogo size={48} className="shrink-0" />
              )}
              <div className="text-left text-xs text-slate-600 leading-tight">
                <p className="font-bold text-slate-900 text-sm">La Cave des Peress / Premnord</p>
                <p>3 Rue du monument</p>
                <p>21190 Puligny Montrachet &bull; France</p>
                <p className="text-slate-500 mt-0.5">Tél : +33 6 10 84 79 02</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <h1 className="text-2xl sm:text-3xl font-serif font-black uppercase tracking-widest text-slate-900">
                CARTE DES VINS
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-900/80 mt-1">
                Prix HT départ Cave &bull; Service compris
              </p>
            </div>
          </div>

          {/* SITES 1 -> 2 -> 3 -> 4 HIERARCHICAL RENDERING */}
          <div className="space-y-14 print-no-break">
            {siteWineGroups.length === 0 || totalRefsCount === 0 ? (
              <p className="text-center py-12 text-stone-400 italic text-sm">
                Aucun vin actuellement disponible sur la sélection de sites.
              </p>
            ) : (
              siteWineGroups.map(siteGroup => (
                <div key={siteGroup.site.id} id={siteGroup.site.id} className="space-y-8 break-inside-avoid">
                  
                  {/* --- SITE HEADER BANNER (Site 1, 2, 3, 4) --- */}
                  <div className="bg-stone-100/70 border border-stone-200/80 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 print:border-b-2 print:border-t-0 print:border-x-0 print:bg-transparent print:px-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#BD6346] text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs shrink-0">
                        {siteGroup.siteSequence}
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-serif font-bold text-stone-900 tracking-tight">
                          {siteGroup.site.name}
                        </h3>
                        {siteGroup.site.description && (
                          <p className="text-[11px] text-stone-500 font-sans">
                            {siteGroup.site.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-[11px] font-mono text-stone-500 font-bold self-end sm:self-auto">
                      <span className="px-2 py-0.5 bg-white rounded border border-stone-200 text-stone-700">
                        {siteGroup.totalWinesCount} réf. &bull; {siteGroup.totalBottlesCount} btl
                      </span>
                    </div>
                  </div>

                  {/* Empty Site State */}
                  {siteGroup.subRegions.length === 0 && (
                    <p className="text-stone-400 text-xs italic pl-4">
                      Aucune référence active actuellement dans ce site.
                    </p>
                  )}

                  {/* --- SUB-REGIONS & REGIONS WITHIN THIS SITE --- */}
                  {siteGroup.subRegions.map(subRegion => (
                    <div key={subRegion.subRegionKey} className="space-y-6 pl-2 sm:pl-4">
                      
                      {/* Sub-Region Title */}
                      <div className="flex items-center gap-3 border-b border-stone-200/90 pb-1.5">
                        <MapPin className="w-4 h-4 text-[#BD6346] shrink-0" />
                        <h4 className="text-base md:text-lg font-serif font-bold uppercase tracking-[0.15em] text-[#BD6346]">
                          {subRegion.displayLabel}
                        </h4>
                        <div className="flex-grow border-b border-stone-200/50" />
                        <span className="text-[10px] font-mono font-bold text-stone-400">
                          {subRegion.totalWinesCount} réf.
                        </span>
                      </div>

                      {/* Domains inside Sub-Region */}
                      <div className={`grid ${config.columns === 2 ? 'grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6' : 'grid-cols-1 gap-y-6'}`}>
                        {subRegion.domains.map(domain => (
                          <div key={domain.domainName} className="break-inside-avoid mb-1">
                            
                            {/* Producer Header */}
                            <div className="flex items-baseline justify-between mb-0.5">
                              <h5 className="font-sans font-extrabold text-stone-900 text-base md:text-[16.5px] tracking-tight">
                                {domain.domainName}
                              </h5>
                              <span className="text-[10px] font-mono text-stone-400 font-bold uppercase tracking-wider">
                                {domain.wines.length} vin{domain.wines.length > 1 ? 's' : ''}
                              </span>
                            </div>

                            {domain.wines[0]?.appellation && (
                              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2 font-sans font-semibold">
                                {domain.wines[0].appellation}
                              </p>
                            )}

                            {/* Wines list under Producer */}
                            <ul className="space-y-1 mt-1">
                              {domain.wines.map(w => {
                                const isExcluded = excludedWineIds.has(w.id);
                                const isOut = w.quantity <= 0;
                                const vintage = w.vintage || 'S.A.';
                                const cleanVintage = (vintage || '').replace('*', '').trim();

                                // Format type tag
                                const colorStr = w.color ? (w.color.charAt(0).toUpperCase() + w.color.slice(1).toLowerCase()) : '';
                                let formatStr = w.format || 'Bouteille (75cl)';
                                const lowerFormat = formatStr.toLowerCase();
                                if (lowerFormat === '75cl' || lowerFormat === '75 cl' || lowerFormat === 'bouteille') {
                                  formatStr = 'Bouteille (75cl)';
                                } else if (lowerFormat === '150cl' || lowerFormat === '150 cl' || lowerFormat === 'magnum') {
                                  formatStr = 'Magnum (1.5L)';
                                } else if (lowerFormat === 'jeroboam' || lowerFormat === 'jéroboam' || lowerFormat === '300cl' || lowerFormat === '3l') {
                                  formatStr = 'Jéroboam (3L)';
                                } else if (lowerFormat === 'demi-bouteille' || lowerFormat === '37.5cl' || lowerFormat === '37,5cl') {
                                  formatStr = 'Demi-bouteille (37.5cl)';
                                }
                                const typeTag = colorStr && formatStr ? `(${colorStr} - ${formatStr})` : (colorStr ? `(${colorStr})` : `(${formatStr})`);

                                return (
                                  <li 
                                    key={w.id} 
                                    className={`flex justify-between items-baseline text-[13px] font-serif border-b border-stone-100/40 py-1 group transition-all ${
                                      isExcluded && isEditSelectionMode ? 'opacity-40' : ''
                                    } ${w.hideFromMenu ? 'opacity-40 line-through decoration-slate-400' : ''}`}
                                  >
                                    <div className="flex-1 mr-2 overflow-hidden relative flex items-baseline gap-1.5 min-w-0 pr-1">
                                      {isEditSelectionMode && (
                                        <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                                          <input 
                                            type="checkbox" 
                                            checked={!isExcluded}
                                            onChange={() => toggleWineExclusion(w.id)}
                                            className="w-4 h-4 text-rose-900 rounded border-gray-300 focus:ring-rose-900 cursor-pointer"
                                            title="Exclure de la carte"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleTogglePreSale(w)}
                                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded border cursor-pointer ${
                                              w.isPreSale ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                            title="Basculer statut prévente"
                                          >
                                            {w.isPreSale ? 'Prévente: OUI' : 'Prévente: NON'}
                                          </button>
                                        </div>
                                      )}

                                      <span className="font-semibold text-stone-900 leading-snug">
                                        {w.name}
                                      </span>
                                      <span className="text-[11px] text-stone-500 font-sans italic shrink-0">
                                        {typeTag}
                                      </span>
                                      {w.isPreSale && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase rounded border border-amber-200 print:hidden font-sans">
                                          Prévente
                                        </span>
                                      )}
                                      {isOut && !w.isPreSale && (
                                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-bold uppercase rounded border border-rose-200 print:hidden font-sans">
                                          Rupture
                                        </span>
                                      )}
                                      {w.hideFromMenu && (
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded border border-slate-200 print:hidden font-sans">
                                          Masqué
                                        </span>
                                      )}
                                    </div>

                                    {/* Dotted lines */}
                                    <div className="flex-grow border-b border-dotted border-stone-300 mx-2 self-baseline h-1.5 min-w-6" style={{ transform: 'translateY(-2.5px)' }} />

                                    <div className="flex items-baseline gap-4 shrink-0 text-right font-mono text-[13px]">
                                      {(showQuantities || editVisibilityMode) && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded print:hidden font-sans ${
                                          w.quantity > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          {w.quantity} dispo.
                                        </span>
                                      )}

                                      {config.showVintage && (
                                        <span className="text-stone-600 font-semibold italic text-[12.5px] min-w-10 text-center font-serif">
                                          {cleanVintage}
                                        </span>
                                      )}

                                      <span className="font-bold text-stone-900 min-w-16 text-right">
                                        {w.priceSell ? `${w.priceSell.toFixed(2).replace('.', ',')} €` : 'N/C'}
                                      </span>

                                      {editVisibilityMode && (
                                        <button
                                          onClick={() => handleToggleVisibility(w)}
                                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer print:hidden ml-1"
                                          title={w.hideFromMenu ? "Afficher sur la carte" : "Masquer de la carte"}
                                        >
                                          {w.hideFromMenu ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer Legal Notice matching La Cave des Peress */}
          <div className="pt-8 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-1 print-no-break">
            <p>La Cave des Peress — EURL au capital de 5 000 € — 3 Rue du monument 21190 Puligny Montrachet</p>
            <p>SIREN 751 886 649 — RCS Dijon — TVA Intracommunautaire : FR 37 751886649</p>
            <p className="italic font-serif">L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</p>
          </div>
        </div>

        {/* Sommelier Config & Dashboard Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
          
          {/* Navigation Tabs for Sidebar */}
          <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 rounded-2xl">
            <button
              onClick={() => setSidebarTab('design')}
              className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sidebarTab === 'design' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Palette className="w-4 h-4" />
              Mise en page
            </button>
            <button
              onClick={() => setSidebarTab('sommelier')}
              className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sidebarTab === 'sommelier' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              Réassorts carte
            </button>
          </div>

          {/* TAB 1: DESIGN CONFIGURATOR */}
          {sidebarTab === 'design' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-fade-in text-slate-800">
              <div className="flex items-center gap-2 text-slate-950 font-bold border-b border-slate-100 pb-3">
                <Sliders className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                <h3 className="font-sans text-sm">Configurateur Visuel (Format Word)</h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Ajustez le rendu visuel en temps réel pour reproduire l'esthétique exacte de votre carte imprimée traditionnelle.
              </p>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Style de Thème</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'classic', label: 'Classique Prestige' },
                      { id: 'modern', label: 'Moderne Épuré' },
                      { id: 'bistro', label: 'Bistrot Parisien' },
                      { id: 'prestige', label: 'Grand Cru Or' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setConfig({ ...config, theme: t.id as any })}
                        className={`p-2 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                          config.theme === t.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Disposition des Colonnes</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, columns: 1 })}
                      className={`p-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                        config.columns === 1
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Rows className="w-4 h-4" />
                      1 Colonne
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, columns: 2 })}
                      className={`p-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                        config.columns === 2
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      2 Colonnes
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Espacement des Lignes</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'compact', label: 'Compact' },
                      { id: 'normal', label: 'Standard' },
                      { id: 'spacious', label: 'Aéré' }
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setConfig({ ...config, spacing: s.id as any })}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                          config.spacing === s.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-700 font-medium">Afficher le Logo Premnord</span>
                    <input
                      type="checkbox"
                      checked={config.showLogo}
                      onChange={e => setConfig({ ...config, showLogo: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-700 font-medium">Afficher la colonne Millésime</span>
                    <input
                      type="checkbox"
                      checked={config.showVintage}
                      onChange={e => setConfig({ ...config, showVintage: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOMMELIER REPLENISHMENT */}
          {sidebarTab === 'sommelier' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in text-slate-800">
              <div className="flex items-center gap-2 text-slate-950 font-bold border-b border-slate-100 pb-3">
                <Sparkles className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                <h3 className="font-sans text-sm">Réassorts de Salle en 1 Clic</h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Transférez automatiquement du stock depuis la réserve (Site 5) vers les sites de la carte (Sites 1, 2, 3, 4) lorsqu'une référence arrive à épuisement.
              </p>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {wines.filter(w => ['site-1', 'site-2', 'site-3', 'site-4'].includes(w.siteId) && w.quantity <= 2).length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tous les vins des sites 1 à 4 ont un stock suffisant.</span>
                  </div>
                ) : (
                  wines.filter(w => ['site-1', 'site-2', 'site-3', 'site-4'].includes(w.siteId) && w.quantity <= 2).map(lowWine => {
                    const reserveInfo = getReserveStock(lowWine);
                    const hasReserve = reserveInfo.total > 0;
                    const isReplenishing = replenishingId === lowWine.id;

                    return (
                      <div 
                        key={lowWine.id}
                        className={`p-3 rounded-xl border transition-all ${
                          hasReserve 
                            ? 'bg-amber-50/50 border-amber-200/80 text-amber-950' 
                            : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div>
                            <p className="font-bold text-xs leading-tight text-slate-900">{lowWine.name}</p>
                            <p className="text-[11px] text-slate-500 italic">{getCanonicalDomain(lowWine.domain)} &bull; {lowWine.vintage}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            lowWine.quantity === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {lowWine.quantity} en salle
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 text-xs">
                          <span className="text-[11px] text-slate-600">
                            {hasReserve ? (
                              <strong className="text-emerald-700 font-bold">{reserveInfo.total} en réserve</strong>
                            ) : (
                              <span className="text-rose-600 font-medium">Épuisé en réserve</span>
                            )}
                          </span>

                          {hasReserve && (
                            <button
                              disabled={isReplenishing}
                              onClick={() => handleReplenish(lowWine, reserveInfo.items[0])}
                              className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              {isReplenishing ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3 h-3" />
                              )}
                              +6 btl en salle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

