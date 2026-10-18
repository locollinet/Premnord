import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine as WineIcon, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCw, Layers, Euro, Activity, ShieldCheck, TrendingUp, Sparkles, Plus, AlertOctagon, CheckCircle, Eye, FileSpreadsheet } from 'lucide-react';
import { WineColor, normalizeWineString, getCanonicalDomain, Wine } from '../types';
import { DuplicateInspectionModal } from './DuplicateInspectionModal';

interface DashboardProps {
  onNavigateToWines: () => void;
  onNavigateToSites: () => void;
  onSelectWine: (wineId: string) => void;
  onNavigateToAccounting?: () => void;
}

const COLOR_MAP: Record<WineColor, { label: string; bg: string; text: string; border: string; barBg: string }> = {
  rouge: { label: 'Rouge', bg: 'bg-rose-50', text: 'text-red-700', border: 'border-red-200', barBg: 'bg-red-600' },
  blanc: { label: 'Blanc', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', barBg: 'bg-amber-500' },
  rose: { label: 'Rosé', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', barBg: 'bg-pink-500' },
  bulle: { label: 'Bulles / Champ.', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', barBg: 'bg-teal-500' },
  orange: { label: 'Orange', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', barBg: 'bg-orange-500' },
  spiritueux: { label: 'Spiritueux', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', barBg: 'bg-purple-600' },
  cidre_biere: { label: 'Bière / Cidre', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', barBg: 'bg-yellow-500' },
  soft: { label: 'Softs', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', barBg: 'bg-blue-500' },
  autre: { label: 'Autre', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', barBg: 'bg-slate-500' }
};

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToWines, onNavigateToSites, onSelectWine, onNavigateToAccounting }) => {
  const { wines, sites, movements, deduplicateCellar, repairWinesData } = useFirebase();

  // Deduplication UI states
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupResult, setDedupResult] = useState<number | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Repair UI states
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<number | null>(null);

  // Check if there are duplicates
  const hasDuplicates = React.useMemo(() => {
    const keys = new Set<string>();
    for (const wine of wines) {
      const vintageStr = (wine.vintage || '').toString().trim().toLowerCase();
      const colorStr = (wine.color || '').toString().trim().toLowerCase();
      const d = normalizeWineString(getCanonicalDomain(wine.domain));
      const n = normalizeWineString(wine.name);
      const key = `${d}||${n}||${vintageStr}||${colorStr}||${wine.siteId}`;
      if (keys.has(key)) {
        return true;
      }
      keys.add(key);
    }
    return false;
  }, [wines]);

  // Check if there are wines with truncated/corrupted regions or broken DPR imports from excel imports
  const needsDataRepair = React.useMemo(() => {
    return wines.some(w => {
      const reg = (w.region || '').trim().toLowerCase();
      const dom = (w.domain || '').trim().toLowerCase();
      const appell = (w.appellation || '').trim().toLowerCase();
      
      const isChileBroken = (
        reg.startsWith('valle d') || 
        reg === 'valle' || 
        reg === 'val de' ||
        ((reg === '' || reg === 'bt') && (dom.includes('henriquez') || dom.includes('henríquez'))) ||
        ((reg === 'valle d' || reg === '' || reg === 'bt') && (appell.includes('biobio') || appell.includes('bio bio') || appell.includes('itata')))
      );
      
      const isYear = /^\d{4}$/.test(dom);
      const isDprBroken = reg === 'bourgogne' && isYear && dom === (w.vintage || '');
      
      return isChileBroken || isDprBroken;
    });
  }, [wines]);

  const handleDeduplicate = async (
    selectedKeys?: string[],
    customOverrides?: Record<string, Partial<Wine>>
  ): Promise<number> => {
    setIsDeduplicating(true);
    setDedupResult(null);
    try {
      const mergedCount = await deduplicateCellar(selectedKeys, customOverrides);
      setDedupResult(mergedCount);
      setTimeout(() => setDedupResult(null), 8000);
      return mergedCount;
    } catch (err) {
      console.error("Deduplication error:", err);
      throw err;
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleRepairWines = async () => {
    setIsRepairing(true);
    setRepairResult(null);
    try {
      const count = await repairWinesData();
      setRepairResult(count);
      setTimeout(() => setRepairResult(null), 8000);
    } catch (err) {
      console.error("Repair error:", err);
    } finally {
      setIsRepairing(false);
    }
  };

  // Statistics calculations
  const stats = React.useMemo(() => {
    const totalReferences = wines.length;
    const totalBottles = wines.reduce((acc, w) => acc + (w.quantity || 0), 0);
    
    const alertWines = wines.filter(w => (w.quantity || 0) <= w.alertThreshold && (w.quantity || 0) > 0);
    const outOfStockWines = wines.filter(w => (w.quantity || 0) === 0);
    
    const totalBuyValue = wines.reduce((acc, w) => acc + ((w.priceBuy || 0) * (w.quantity || 0)), 0);
    const totalSellValue = wines.reduce((acc, w) => acc + ((w.priceSell || 0) * (w.quantity || 0)), 0);
    const potentialMargin = totalSellValue - totalBuyValue;
    const marginPercentage = totalSellValue ? (potentialMargin / totalSellValue) * 100 : 0;

    // Breakdown by wine color
    const colorBreakdown = wines.reduce((acc, w) => {
      acc[w.color] = (acc[w.color] || 0) + (w.quantity || 0);
      return acc;
    }, {} as Record<WineColor, number>);

    // Breakdown by storage sites
    const siteBreakdown = wines.reduce((acc, w) => {
      acc[w.siteId] = (acc[w.siteId] || 0) + (w.quantity || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalReferences,
      totalBottles,
      alertWines,
      outOfStockWines,
      totalBuyValue,
      totalSellValue,
      potentialMargin,
      marginPercentage,
      colorBreakdown,
      siteBreakdown
    };
  }, [wines]);

  const {
    totalReferences,
    totalBottles,
    alertWines,
    outOfStockWines,
    totalBuyValue,
    totalSellValue,
    potentialMargin,
    marginPercentage,
    colorBreakdown,
    siteBreakdown
  } = stats;

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Informational banner when database is empty */}
      {totalReferences === 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
          <div className="space-y-1 z-10 max-w-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-red-600 shrink-0" />
              <h2 className="text-sm font-serif font-black tracking-wide text-slate-900 uppercase">
                Base de données réinitialisée
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              La base est prête pour votre nouvel inventaire. Vous pouvez ajouter vos références manuellement ou utiliser le module d'importation CSV ("Copier-coller magique").
            </p>
          </div>

          <div className="shrink-0 z-10 w-full sm:w-auto">
            <button
              onClick={onNavigateToWines}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer uppercase tracking-wider font-mono"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              Saisir des fiches
            </button>
          </div>
        </div>
      )}

      {/* Alerte Doublons Détectés */}
      {hasDuplicates && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="text-xs font-sans font-black tracking-wide text-amber-950 uppercase">
                Doublons détectés sur un même site de stockage
              </h4>
              <span className="text-[10px] font-mono font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">
                Audit disponible
              </span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed font-sans">
              Des fiches identiques ont été repérées dans le même lieu de stockage. Pour vous garantir un contrôle absolu et sans risque, vous pouvez examiner chaque fiche avant de valider : les quantités seront rigoureusement additionnées et aucune bouteille ne sera perdue.
            </p>
          </div>
          <button
            onClick={() => setIsDuplicateModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all select-none whitespace-nowrap"
          >
            <Eye className="w-4 h-4" />
            Examiner & Fusionner
          </button>
        </div>
      )}

      {dedupResult !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm flex items-center gap-4 animate-fade-in">
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-sans font-bold text-emerald-900 uppercase tracking-wide">
              Dédoublonnement réussi !
            </h4>
            <p className="text-xs text-emerald-800 font-sans">
              <strong>{dedupResult}</strong> fiche{dedupResult > 1 ? 's doublons ont été fusionnées' : ' doublon a été fusionné'} avec succès ! Les stocks ont été cumulés de manière transparente.
            </p>
          </div>
        </div>
      )}

      {/* Alerte Données Tronquées/Corrompues Détectées */}
      {needsDataRepair && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="text-xs font-sans font-black tracking-wide text-amber-950 uppercase">
                Anomalies de données ou imports décalés détectés
              </h4>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed font-sans max-w-3xl">
              Votre base de données contient des fiches corrompues : des fiches <span className="font-semibold">Domaine Prieuré-Roch (DPR)</span> où le millésime a écrasé le nom du domaine, ou des fiches chiliennes avec des pays manquants (ex. <span className="font-semibold">"Valle d"</span>). Nous pouvons tout corriger proprement en un clic !
            </p>
          </div>
          <button
            onClick={handleRepairWines}
            disabled={isRepairing}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors select-none whitespace-nowrap"
          >
            {isRepairing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Correction en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Réparer les fiches (Pays & Imports DPR)
              </>
            )}
          </button>
        </div>
      )}

      {repairResult !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm flex items-center gap-4 animate-fade-in">
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-sans font-bold text-emerald-900 uppercase tracking-wide">
              Fiches réparées avec succès !
            </h4>
            <p className="text-xs text-emerald-800 font-sans">
              <strong>{repairResult}</strong> fiche{repairResult > 1 ? 's pays ont été corrigées' : ' pays a été corrigée'} avec succès ! Tous les vins concernés portent désormais la mention officielle de leur pays (ex: <span className="font-semibold">Chili</span>).
            </p>
          </div>
        </div>
      )}



      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total References */}
        <div 
          onClick={onNavigateToWines}
          className="bg-white border border-slate-200 p-5 rounded-2xl cursor-pointer hover:border-red-400 transition-all shadow-sm select-none"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Fiches Références</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 mt-1">{totalReferences}</h3>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl">
              <WineIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-mono">Références uniques enregistrées</p>
        </div>

        {/* Card 2: Total Bottles */}
        <div 
          onClick={onNavigateToWines}
          className="bg-white border border-slate-200 p-5 rounded-2xl cursor-pointer hover:border-red-400 transition-all shadow-sm select-none"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Total Bouteilles</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 mt-1">{totalBottles}</h3>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl">
              <WineIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-mono">Stock physique total cumulé</p>
        </div>

        {/* Card 3: Stock alerts */}
        <div 
          onClick={onNavigateToWines}
          className={`border p-5 rounded-2xl cursor-pointer transition-all shadow-sm select-none ${
            alertWines.length > 0 || outOfStockWines.length > 0
              ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
              : 'bg-white border-slate-200 hover:border-red-400'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Alertes Stock</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 mt-1">
                {alertWines.length + outOfStockWines.length}
              </h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              alertWines.length > 0 || outOfStockWines.length > 0
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 font-mono">
            <strong>{outOfStockWines.length}</strong> épuisé{outOfStockWines.length > 1 ? 's' : ''} | <strong>{alertWines.length}</strong> critique{alertWines.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Card 4: Financial Valuation */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Valeur du Stock (Achat)</p>
                <h3 className="text-3xl font-serif font-black text-slate-900 mt-1">
                  {totalBuyValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl">
                <Euro className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 font-mono">
              Vente estimée : {totalSellValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </p>
          </div>

          {onNavigateToAccounting && (
            <button
              onClick={onNavigateToAccounting}
              className="mt-3 w-full py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none shadow-2xs"
              title="Accéder au module d'extraction comptable et d'inventaire certifié"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Extraction Comptable (Excel)
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout for Activities & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Alerts and Activities (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Commercial margin indicator banner */}
          {totalSellValue > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 font-sans">Performance Commerciale estimée</h4>
                  <p className="text-xs text-emerald-700 font-sans mt-0.5">Marge brute moyenne globale sur l'inventaire en cours.</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-mono font-black text-emerald-800">
                  +{potentialMargin.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg ml-2">
                  {marginPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Critical Stock Alerts list */}
          {(alertWines.length > 0 || outOfStockWines.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Alertes de stock et ruptures
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                {outOfStockWines.map(wine => {
                  const site = sites.find(s => s.id === wine.siteId);
                  const siteDigit = site?.name?.match(/\d/)?.[0] || '1';
                  const locationCode = wine.bin ? `${siteDigit}${wine.bin.replace(/[\s\-_]/g, '').toUpperCase()}` : `${siteDigit}?`;

                  return (
                    <div 
                      key={wine.id} 
                      onClick={() => onSelectWine(wine.id)}
                      className="flex justify-between items-center bg-rose-50/50 border border-rose-100 p-3 rounded-xl cursor-pointer hover:bg-rose-50 transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold uppercase bg-rose-100 text-rose-700 px-1.5 rounded">Rupture</span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold">Pos: {locationCode}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{wine.name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{wine.domain}</p>
                      </div>
                      <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded-lg text-xs font-mono font-bold shrink-0">
                        0 bt
                      </span>
                    </div>
                  );
                })}

                {alertWines.map(wine => {
                  const site = sites.find(s => s.id === wine.siteId);
                  const siteDigit = site?.name?.match(/\d/)?.[0] || '1';
                  const locationCode = wine.bin ? `${siteDigit}${wine.bin.replace(/[\s\-_]/g, '').toUpperCase()}` : `${siteDigit}?`;

                  return (
                    <div 
                      key={wine.id} 
                      onClick={() => onSelectWine(wine.id)}
                      className="flex justify-between items-center bg-amber-50/50 border border-amber-100 p-3 rounded-xl cursor-pointer hover:bg-amber-50 transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold uppercase bg-amber-100 text-amber-700 px-1.5 rounded">Seuil: {wine.alertThreshold}</span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold">Pos: {locationCode}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{wine.name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{wine.domain}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-xs font-mono font-bold shrink-0">
                        {wine.quantity} bt
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Movements Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Flux récents & Traçabilité
                </h3>
              </div>
            </div>

            {movements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-mono text-xs">
                Aucun flux enregistré pour le moment. Allez sur l'inventaire ou le menu pour effectuer des opérations.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-2">
                {movements.slice(0, 10).map((mov) => {
                  const isPositive = mov.type === 'in' || (mov.type === 'correction' && mov.quantity > 0);
                  const isTransfer = mov.type === 'transfer';
                  
                  return (
                    <div key={mov.id} className="py-3 flex justify-between items-center text-sm gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl border shrink-0 ${
                          isTransfer 
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : isPositive 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}>
                          {isTransfer ? (
                            <RefreshCw className="w-4 h-4" />
                          ) : isPositive ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        
                        <div className="min-w-0">
                          <h4 
                            onClick={() => onSelectWine(mov.wineId)}
                            className="text-xs font-bold text-slate-900 truncate hover:underline cursor-pointer"
                          >
                            {mov.wineName}
                          </h4>
                          <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                            <span className="uppercase font-bold text-red-600">{mov.reason}</span>
                            <span>&bull;</span>
                            <span>Par {mov.userName}</span>
                            <span>&bull;</span>
                            <span>{new Date(mov.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs border ${
                          isTransfer 
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : isPositive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isTransfer ? 'TF' : isPositive ? '+' : '-'}{Math.abs(mov.quantity)} bt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Wine colors & sites breakdown (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Breakdown by Wine Colors */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 font-sans mb-4">
              Répartition par catégories
            </h3>
            
            <div className="space-y-4">
              {(Object.keys(COLOR_MAP) as WineColor[]).map((colorKey) => {
                const count = colorBreakdown[colorKey] || 0;
                const percentage = totalBottles > 0 ? (count / totalBottles) * 100 : 0;
                const styles = COLOR_MAP[colorKey];
                
                return (
                  <div key={colorKey} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase ${styles.bg} ${styles.text} border ${styles.border}`}>
                        {styles.label}
                      </span>
                      <span className="text-slate-500 font-mono text-xs">
                        {count} bt <span className="text-[10px] text-slate-400 font-bold">({percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${styles.barBg}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown by storage Sites */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Stocks par Sites
              </h3>
              <button 
                onClick={onNavigateToSites}
                className="text-xs text-red-600 hover:underline font-bold"
              >
                Gérer
              </button>
            </div>

            <div className="space-y-3.5">
              {sites.map((site) => {
                const count = siteBreakdown[site.id] || 0;
                const percentage = totalBottles > 0 ? (count / totalBottles) * 100 : 0;
                
                return (
                  <div key={site.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[150px]">
                        {site.name.split(' - ')[0]}
                      </span>
                      <span className="text-slate-500 font-mono text-xs">
                        {count} bt ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-600 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {sites.length === 0 && (
                <div className="text-center py-4 text-slate-400 font-mono text-xs">
                  Aucun site de stockage configuré.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal d'audit pédagogique des doublons */}
      <DuplicateInspectionModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onConfirmDeduplicate={handleDeduplicate}
        wines={wines}
        sites={sites}
      />
    </div>
  );
};
