import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, Movement, isSameWineReference, TechnicalSheet } from '../types';
import { MultiSiteDispatchModal } from './MultiSiteDispatchModal';
import { 
  X, 
  Copy,
  Calendar, 
  Edit2, 
  Edit3,
  CheckCircle,
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft,
  RefreshCw, 
  Layers, 
  MapPin, 
  Tag, 
  Euro, 
  Notebook, 
  History, 
  Plus, 
  AlertTriangle, 
  ShieldCheck,
  Sparkles,
  Compass,
  Droplet,
  Thermometer,
  Clock,
  Utensils,
  BookOpen,
  Award,
  ChevronRight,
  ShieldCheck as VerifiedIcon,
  Check,
  Printer
} from 'lucide-react';

const PremiumFicheBottle: React.FC<{ color: any }> = ({ color }) => {
  let bgLiquid = 'bg-red-800';
  let capColor = 'bg-red-950';
  
  if (color === 'blanc') {
    bgLiquid = 'bg-[#FAF2D8]';
    capColor = 'bg-amber-800';
  } else if (color === 'rose') {
    bgLiquid = 'bg-pink-300';
    capColor = 'bg-pink-700';
  } else if (color === 'bulle') {
    bgLiquid = 'bg-[#FEF08A]';
    capColor = 'bg-yellow-700';
  } else if (color === 'orange') {
    bgLiquid = 'bg-[#FDBA74]';
    capColor = 'bg-orange-800';
  } else if (color === 'spiritueux') {
    bgLiquid = 'bg-amber-700';
    capColor = 'bg-stone-800';
  }

  return (
    <div className="flex flex-col items-center py-8 px-4 bg-white border border-stone-200/40 rounded-2xl h-full shadow-inner relative overflow-hidden select-none min-h-[360px] justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-50/40 to-transparent pointer-events-none" />
      
      <div className="w-16 flex flex-col items-center relative z-10 filter drop-shadow-sm">
        {/* Cap */}
        <div className={`w-3.5 h-7 ${capColor} rounded-t-sm border border-black/15 shadow-sm relative`}>
          <div className="absolute bottom-1 left-0 right-0 h-[1px] bg-yellow-400/40" />
        </div>
        {/* Neck */}
        <div className="w-4.5 h-14 border-x border-black/10 bg-stone-800/10 relative flex items-end">
          <div className={`w-full h-9 ${bgLiquid} opacity-95`} />
        </div>
        {/* Shoulder */}
        <div className="w-13 h-8 overflow-hidden relative flex justify-center">
          <div className="absolute top-0 w-13 h-16 rounded-t-full border border-black/15 bg-stone-850/10 flex items-end">
            <div className={`w-full h-10 ${bgLiquid} opacity-95 rounded-t-full`} />
          </div>
        </div>
        {/* Body */}
        <div className="w-13 h-36 border-x border-b border-black/15 rounded-b-lg bg-stone-850/10 relative flex flex-col items-center justify-start pt-3 shadow-sm">
          <div className={`absolute inset-0 ${bgLiquid} opacity-95 rounded-b-md`} />
          <div className="absolute left-1 top-0 bottom-0 w-1 bg-white/15 blur-[0.5px]" />
          
          {/* Elegant paper label */}
          <div className="w-9 h-20 bg-[#FCFAF6] border border-stone-300 shadow-sm rounded-xs flex flex-col items-center justify-between py-1.5 px-0.5 text-center relative z-20">
            <span className="text-[3px] uppercase tracking-widest text-stone-400 font-mono font-bold block leading-none">Domaine</span>
            <div className="w-3 h-[0.5px] bg-stone-300 my-0.5" />
            <span className="text-[5px] font-serif italic text-stone-800 font-bold leading-tight block truncate w-full px-0.5">Grand Vin</span>
            <div className="w-3 h-[0.5px] bg-stone-300 my-0.5" />
            <span className="text-[3px] font-mono font-bold text-red-800 leading-none block">Reserve</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WineDetailModalProps {
  wineId: string;
  onClose: () => void;
  onEditWine: (wine: Wine) => void;
  onDuplicateWine: (wine: Wine) => void;
  onRecordMovement: (wine: Wine) => void;
}

const COLOR_LABELS: Record<string, string> = {
  rouge: 'Vin Rouge',
  blanc: 'Vin Blanc',
  rose: 'Vin Rosé',
  bulle: 'Vin Effervescent / Champagne',
  orange: 'Vin Orange',
  spiritueux: 'Spiritueux d\'élite',
  cidre_biere: 'Bières & Cidres',
  autre: 'Autre Boisson'
};

const BottleIllustration: React.FC<{ color: string, name: string, domain: string, vintage: string }> = ({ color, name, domain, vintage }) => {
  // Determine color theme for the CSS bottle
  let liquidColor = 'bg-red-800'; // Rouge
  let capColor = 'bg-red-950';
  
  if (color === 'blanc') {
    liquidColor = 'bg-amber-100/75';
    capColor = 'bg-amber-800';
  } else if (color === 'rose') {
    liquidColor = 'bg-rose-200/80';
    capColor = 'bg-rose-700';
  } else if (color === 'bulle') {
    liquidColor = 'bg-yellow-100/80';
    capColor = 'bg-yellow-700';
  } else if (color === 'orange') {
    liquidColor = 'bg-amber-500/70';
    capColor = 'bg-amber-800';
  } else if (color === 'spiritueux') {
    liquidColor = 'bg-amber-700/80';
    capColor = 'bg-amber-900';
  } else if (color === 'cidre_biere') {
    liquidColor = 'bg-yellow-600/70';
    capColor = 'bg-amber-850';
  } else if (color === 'soft') {
    liquidColor = 'bg-sky-200/50';
    capColor = 'bg-sky-600';
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50 border border-slate-150/80 rounded-2xl h-full shadow-inner relative overflow-hidden select-none min-h-[340px]">
      {/* Background soft glow */}
      <div className="absolute inset-0 bg-radial-gradient from-white to-transparent opacity-60 pointer-events-none" />

      {/* Stylized CSS Wine Bottle */}
      <div className="w-24 flex flex-col items-center relative z-10 filter drop-shadow-md">
        
        {/* Capsule / Cork */}
        <div className={`w-5 h-8 ${capColor} rounded-t-sm border border-black/10 relative shadow-md`}>
          {/* Subtle gold line on cap */}
          <div className="absolute bottom-1 left-0 right-0 h-0.5 bg-yellow-400/50" />
        </div>

        {/* Neck of the bottle */}
        <div className="w-6 h-16 border-x border-black/20 bg-slate-800/25 relative flex items-end justify-center">
          {/* Liquid in neck */}
          <div className={`w-full h-12 ${liquidColor} border-t border-black/5 opacity-90`} />
          
          {/* Collar ring */}
          <div className="absolute top-1 w-7 h-1.5 bg-black/10 rounded-full border-b border-black/15" />
        </div>

        {/* Shoulders of the bottle */}
        <div className="w-16 h-10 overflow-hidden relative flex justify-center">
          <div className="absolute top-0 w-16 h-20 rounded-t-full border border-black/20 bg-slate-800/25 flex items-end justify-center">
            {/* Liquid in shoulders */}
            <div className={`w-full h-14 ${liquidColor} rounded-t-full opacity-90`} />
          </div>
        </div>

        {/* Body of the bottle */}
        <div className="w-16 h-40 border-x border-b border-black/20 rounded-b-lg bg-slate-800/25 relative flex flex-col items-center justify-start pt-3.5 shadow-md">
          {/* Liquid in body */}
          <div className={`absolute inset-0 ${liquidColor} opacity-90 rounded-b-md`} />

          {/* Sparkles on glass */}
          <div className="absolute left-1.5 top-0 bottom-0 w-1 bg-white/20 blur-[0.5px]" />
          <div className="absolute right-1.5 top-0 bottom-0 w-0.5 bg-black/15" />

          {/* High-end Wine Label */}
          <div className="w-13 h-24 bg-white/95 border border-amber-900/20 shadow-sm relative z-20 rounded-sm flex flex-col items-center justify-between p-1.5 text-center select-none">
            {/* Fine border inside label */}
            <div className="absolute inset-0.5 border border-amber-900/5 pointer-events-none" />
            
            <div className="w-full flex flex-col items-center pt-1">
              <span className="text-[5px] uppercase tracking-wider font-mono text-amber-800/80 font-bold truncate w-full px-0.5 leading-none">{domain}</span>
              <div className="w-5 h-px bg-amber-900/20 my-0.5" />
              <span className="text-[7px] font-serif font-black text-slate-900 line-clamp-3 leading-tight w-full px-0.5">{name}</span>
            </div>

            <div className="w-full flex flex-col items-center pb-0.5">
              <div className="w-5 h-px bg-amber-900/20 my-0.5" />
              <span className="text-[6px] font-mono font-extrabold text-red-750 leading-none">{vintage}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to check if a technical sheet is truly populated with meaningful data
export const isTechSheetPopulated = (sheet?: TechnicalSheet): boolean => {
  if (!sheet) return false;
  return Boolean(
    sheet.hasGenerated ||
    sheet.sol?.trim() ||
    sheet.cepage?.trim() ||
    sheet.vinification?.trim() ||
    sheet.elevage?.trim() ||
    sheet.lieuDit?.trim() ||
    sheet.degustation?.oeil?.trim() ||
    sheet.degustation?.nez?.trim() ||
    sheet.degustation?.bouche?.trim() ||
    sheet.service?.temperature?.trim() ||
    sheet.service?.accords?.trim()
  );
};

export const WineDetailModal: React.FC<WineDetailModalProps> = ({ wineId, onClose, onEditWine, onDuplicateWine, onRecordMovement }) => {
  const { wines, sites, movements, deleteWine, updateWine, addMovement } = useFirebase();
  const [currentWineId, setCurrentWineId] = useState(wineId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCurrentWineId(wineId);
  }, [wineId]);

  const wine = wines.find(w => w.id === currentWineId) || wines.find(w => w.id === wineId);

  const hasPopulatedSheet = wine ? isTechSheetPopulated(wine.technicalSheet) : false;

  // Tabs: default to 'tech' if tech sheet is populated, otherwise 'stock'
  const [activeTab, setActiveTab] = useState<'stock' | 'tech'>(hasPopulatedSheet ? 'tech' : 'stock');

  // Quick Location & Site Edit state
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [quickSiteId, setQuickSiteId] = useState(wine?.siteId || '');
  const [quickBin, setQuickBin] = useState(wine?.bin || '');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  // Multi-site Dispatch Modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  useEffect(() => {
    if (wine) {
      setQuickSiteId(wine.siteId);
      setQuickBin(wine.bin || '');
      if (isTechSheetPopulated(wine.technicalSheet)) {
        setActiveTab('tech');
      }
    }
  }, [wine?.id, wine?.siteId, wine?.bin]);

  const site = wine ? sites.find(s => s.id === wine.siteId) : undefined;
  const matchingWineIds = React.useMemo(() => {
    if (!wine) return new Set<string>();
    return new Set(wines.filter(w => isSameWineReference(w, wine)).map(w => w.id));
  }, [wines, wine]);
  const wineMovements = movements.filter(m => matchingWineIds.has(m.wineId));

  const otherSitesWines = React.useMemo(() => {
    if (!wine) return [];
    return wines.filter(w => 
      w.id !== wine.id &&
      isSameWineReference(w, wine) &&
      w.quantity > 0
    );
  }, [wines, wine]);

  const handleQuickSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wine) return;
    setIsSavingLocation(true);
    try {
      const siteChanged = quickSiteId !== wine.siteId;
      const oldSiteId = wine.siteId;

      await updateWine(wine.id, {
        siteId: quickSiteId,
        bin: (quickBin || '').trim()
      }, 'edit');

      if (siteChanged) {
        const targetMatch = wines.find(w => w.id !== wine.id && w.siteId === quickSiteId && isSameWineReference(w, wine));
        const oldSiteName = sites.find(s => s.id === oldSiteId)?.name || 'Ancien site';
        const newSiteName = sites.find(s => s.id === quickSiteId)?.name || 'Nouveau site';
        await addMovement({
          wineId: targetMatch ? targetMatch.id : wine.id,
          wineName: `${wine.name} (${wine.vintage})`,
          type: 'transfer',
          quantity: wine.quantity,
          reason: 'transfert',
          fromSiteId: oldSiteId,
          toSiteId: quickSiteId,
          notes: targetMatch
            ? `Changement de site et fusion de stock (${oldSiteName} -> ${newSiteName}). Rang: ${(quickBin || '').trim()}`
            : `Changement de site effectué via modification rapide (${oldSiteName} -> ${newSiteName}). Rang: ${(quickBin || '').trim()}`
        });
      }

      setLocationSuccessMsg("Site et rang mis à jour avec succès !");
      setIsEditingLocation(false);
      setTimeout(() => setLocationSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du site/rang", err);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    if (!wine) return;
    const targetId = wine.id;
    setIsDeleting(true);
    try {
      // Close modal first to avoid stale state in App.tsx
      onClose();
      await deleteWine(targetId);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression. Veuillez réessayer.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteResidualSite = async () => {
    if (!wine) return;
    const currentSiteName = site?.name?.split(' - ')[0] || 'ce site';
    if (!confirm(`Supprimer définitivement l'enregistrement sans stock (0 bouteille) sur "${currentSiteName}" ? L'historique des mouvements passés reste préservé.`)) {
      return;
    }
    const targetId = wine.id;
    if (otherSitesWines.length > 0) {
      setCurrentWineId(otherSitesWines[0].id);
    } else {
      onClose();
    }
    try {
      await deleteWine(targetId);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression de ce site.");
    }
  };

  // If wine was deleted or does not exist, safely exit AFTER all hooks are called
  if (!wine) return null;


  const handleGenerateTechSheet = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);
    try {
      const effectiveName = wine.appellation || wine.name || '';
      const response = await fetch('/api/gemini/generate-technical-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wineName: effectiveName,
          cuvee: wine.cuvee || '',
          domain: wine.domain,
          vintage: wine.vintage,
          color: wine.color,
          region: wine.region || ''
        })
      });

      if (!response.ok) {
        let errorMsg = `Erreur serveur (${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const newSheet: TechnicalSheet = { ...data, hasGenerated: true };

      // Update current wine and automatically propagate to all other sites via atomic batch
      await updateWine(wine.id, { technicalSheet: newSheet }, 'edit');

      setGenerationSuccess("Fiche technique œnologique générée et synchronisée avec succès !");
      setActiveTab('tech');
      setTimeout(() => setGenerationSuccess(null), 6000);
    } catch (err: any) {
      console.error("[handleGenerateTechSheet] Error:", err);
      setGenerationError(err.message || "Impossible de joindre le service d'intelligence artificielle Premnord.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Margin stats
  const marginVal = wine.priceSell && wine.priceBuy ? wine.priceSell - wine.priceBuy : null;
  const marginPct = wine.priceSell && marginVal ? (marginVal / wine.priceSell) * 105 : null; // calibrated ratio

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm text-slate-800" id="wine-detail-modal">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-fade-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-start bg-slate-50 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-lg uppercase">
                {COLOR_LABELS[wine.color] || 'Vin'}
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg uppercase">
                {wine.vintage !== 'N.V.' ? `Millésime ${wine.vintage}` : 'Sans millésime (N.V.)'}
              </span>
              {wine.region && (
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-lg">
                  {wine.region}
                  {wine.subRegion && wine.subRegion !== wine.region ? ` • ${wine.subRegion}` : ''}
                </span>
              )}
              {wine.country && wine.country !== 'France' && wine.country !== wine.region && (
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                  {wine.country}
                </span>
              )}
              {hasPopulatedSheet && (
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase">
                  <VerifiedIcon className="w-3 h-3 text-emerald-600" /> Fiche Activée
                </span>
              )}
            </div>
            <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">{wine.name}</h2>
            <p className="text-sm font-semibold text-slate-600 italic mt-0.5">{wine.domain}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50/50 px-3 sm:px-5 gap-2 flex-wrap py-1 shrink-0">
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('tech')}
              className={`py-2.5 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-[11px] uppercase font-mono tracking-wider font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                activeTab === 'tech'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Fiche Œnologique {hasPopulatedSheet ? '✓' : ''}
            </button>
            
            <button
              onClick={() => setActiveTab('stock')}
              className={`py-2.5 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-[11px] uppercase font-mono tracking-wider font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                activeTab === 'stock'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Stock & Traçabilité ({wine.quantity})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDispatchModal(true)}
            className="my-1 text-[11px] sm:text-xs font-bold font-mono text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
            title="Ventiler ou transférer facilement les bouteilles entre les différents sites"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Ventiler multi-sites</span>
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

          {/* TAB 1: TECHNICAL SHEET */}
          {activeTab === 'tech' && (
            <div className="space-y-6">
              {/* Feedback Notifications */}
              {generationSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-sans font-medium flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{generationSuccess}</span>
                </div>
              )}

              {generationError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-sans flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Impossible de générer la fiche technique :</span>
                    <span className="text-[11px] font-mono text-rose-700 leading-relaxed block mt-0.5">{generationError}</span>
                  </div>
                </div>
              )}

              {hasPopulatedSheet && wine.technicalSheet ? (
                <div className="space-y-8 animate-fade-in bg-[#FAF9F5] border border-stone-200 rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
                  
                  {/* Subtle paper watermark texture */}
                  <div className="absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15] pointer-events-none" />

                  {/* Top toolbar inside Fiche */}
                  <div className="flex justify-between items-center pb-4 border-b border-stone-200/80 relative z-10 print:hidden flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-600 bg-stone-200/60 px-2 py-0.5 rounded">
                        Fiche Certifiée Premnord
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-2.5 py-1.5 border border-stone-300 bg-white hover:bg-stone-50 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Imprimer cette fiche technique"
                      >
                        <Printer className="w-3 h-3 text-stone-500" />
                        Imprimer
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditWine(wine)}
                        className="px-2.5 py-1.5 border border-stone-300 bg-white hover:bg-stone-50 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Edit2 className="w-3 h-3 text-amber-600" />
                        Modifier
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateTechSheet}
                        disabled={isGenerating}
                        className="px-3 py-1.5 border border-amber-300/80 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="Régénérer et enrichir la fiche via l'IA sommelier"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin text-amber-700' : 'text-amber-700'}`} />
                        {isGenerating ? 'Génération...' : "Régénérer par l'IA"}
                      </button>
                    </div>
                  </div>

                  {/* Elegant Fiche Design */}
                  <div className="space-y-8 text-stone-900 relative z-10">
                    
                    {/* Visual Header Ornament - Garamond Domain style */}
                    <div className="text-center space-y-1.5 border-b border-stone-200 pb-5">
                      <h1 className="text-2xl sm:text-3xl font-serif tracking-[0.15em] text-[#C4A47A] font-medium uppercase leading-tight">
                        {wine.domain}
                      </h1>
                      <h2 className="text-base sm:text-xl font-serif tracking-tight text-[#B09066] font-normal italic">
                        {wine.technicalSheet.aop || wine.appellation || wine.name} {wine.vintage !== 'N.V.' ? `« ${wine.vintage} »` : ''}
                      </h2>
                    </div>

                    {/* Layout Body: Bottle on Left, Structured specs on Right */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      
                      {/* Left: Bottle illustration */}
                      <div className="md:col-span-4 flex justify-center">
                        <PremiumFicheBottle color={wine.color} />
                      </div>

                      {/* Right: Detailed list of technical properties */}
                      <div className="md:col-span-8 space-y-4 font-serif text-stone-800">
                        <div className="space-y-3">
                          
                          {/* AOP */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">AOP :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.aop || wine.appellation || wine.name}</span>
                          </div>

                          {/* Lieu-dit */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Lieu-dit :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.lieuDit || 'Non renseigné'}</span>
                          </div>

                          {/* Sol */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Sol :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.sol || 'Non renseigné'}</span>
                          </div>

                          {/* Cépage */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Cépage :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.cepage || 'Non renseigné'}</span>
                          </div>

                          {/* Âge des vignes */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Age moyen :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.ageVignes || 'Non renseigné'}</span>
                          </div>

                          {/* Rendement */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Rendement :</span>
                            <span className="text-xs sm:text-sm text-stone-950 leading-snug">{wine.technicalSheet.rendement || 'Non renseigné'}</span>
                          </div>

                          {/* Densité */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Densité :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.densite || 'Non renseigné'}</span>
                          </div>

                          {/* Surface */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Surface :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.surface || 'Non renseigné'}</span>
                          </div>

                          {/* Culture */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Mode de culture :</span>
                            <span className="text-xs sm:text-sm text-stone-900 leading-snug">{wine.technicalSheet.culture || 'Non renseigné'}</span>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Full Vinification & Élevage block */}
                    <div className="space-y-4 pt-2 font-serif text-stone-800 leading-relaxed text-xs sm:text-sm">
                      {wine.technicalSheet.vinification && (
                        <div className="space-y-1">
                          <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 block">Méthode de vinification :</span>
                          <p className="text-stone-900 text-justify whitespace-pre-line">{wine.technicalSheet.vinification}</p>
                        </div>
                      )}

                      {wine.technicalSheet.elevage && (
                        <div className="space-y-1 pt-1">
                          <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 block">Elevage :</span>
                          <p className="text-stone-900 text-justify whitespace-pre-line">{wine.technicalSheet.elevage}</p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-1.5 pt-1.5 gap-1">
                        <span className="font-bold uppercase tracking-wider text-[10px] font-sans text-stone-500 w-full sm:w-[150px] shrink-0">Mise en bouteilles :</span>
                        <span className="text-xs sm:text-sm text-stone-900 leading-snug">Par nos soins à la propriété.</span>
                      </div>
                    </div>

                    {/* Sommelier Tasting notes (Oeil, Nez, Bouche) */}
                    {(wine.technicalSheet.degustation?.oeil || wine.technicalSheet.degustation?.nez || wine.technicalSheet.degustation?.bouche) && (
                      <div className="border-t border-stone-300 pt-5 space-y-3">
                        <h4 className="text-[10px] font-mono uppercase text-[#C4A47A] font-black tracking-widest text-center">
                          Conseils & Notes de Dégustation
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-stone-800 font-serif leading-relaxed text-[11px] sm:text-xs">
                          {wine.technicalSheet.degustation?.oeil && (
                            <div className="space-y-0.5">
                              <span className="font-bold uppercase tracking-widest text-[9px] font-sans text-[#B09066] block">L'Œil :</span>
                              <p className="italic text-stone-600">« {wine.technicalSheet.degustation.oeil} »</p>
                            </div>
                          )}

                          {wine.technicalSheet.degustation?.nez && (
                            <div className="space-y-0.5 border-t md:border-t-0 md:border-x border-stone-200/60 pt-2 md:pt-0 md:px-3">
                              <span className="font-bold uppercase tracking-widest text-[9px] font-sans text-[#B09066] block">Le Nez :</span>
                              <p className="italic text-stone-600">« {wine.technicalSheet.degustation.nez} »</p>
                            </div>
                          )}

                          {wine.technicalSheet.degustation?.bouche && (
                            <div className="space-y-0.5 border-t md:border-t-0 pt-2 md:pt-0">
                              <span className="font-bold uppercase tracking-widest text-[9px] font-sans text-[#B09066] block">La Bouche :</span>
                              <p className="italic text-stone-600">« {wine.technicalSheet.degustation.bouche} »</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sommelier Service & Accords block */}
                    {(wine.technicalSheet.service?.temperature || wine.technicalSheet.service?.garde || wine.technicalSheet.service?.accords) && (
                      <div className="border-t border-stone-200 pt-4 text-[11px] font-sans text-stone-600 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {wine.technicalSheet.service?.temperature && (
                          <div className="space-y-0.5">
                            <span className="font-bold uppercase tracking-wider text-[8px] text-stone-400 block">Température de Service :</span>
                            <span className="font-bold text-stone-800">{wine.technicalSheet.service.temperature}</span>
                          </div>
                        )}

                        {wine.technicalSheet.service?.garde && (
                          <div className="space-y-0.5">
                            <span className="font-bold uppercase tracking-wider text-[8px] text-stone-400 block">Potentiel de Garde :</span>
                            <span className="font-bold text-stone-800">{wine.technicalSheet.service.garde}</span>
                          </div>
                        )}

                        {wine.technicalSheet.service?.accords && (
                          <div className="space-y-0.5">
                            <span className="font-bold uppercase tracking-wider text-[8px] text-stone-400 block">Accords Gastronomiques :</span>
                            <span className="text-stone-800 font-serif font-medium leading-relaxed block">{wine.technicalSheet.service.accords}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Regenerate by AI inside sheet */}
                    <div className="pt-2 flex justify-end border-t border-stone-100 print:hidden">
                      <button
                        onClick={handleGenerateTechSheet}
                        disabled={isGenerating}
                        className="px-3 py-1.5 border border-stone-200 bg-white hover:bg-stone-50 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider text-stone-500 hover:text-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                        Régénérer par l'IA
                      </button>
                    </div>

                  </div>

                </div>
              ) : (
                // EMPTY STATE / INVITATION TO GENERATE
                <div className="text-center py-10 px-6 border-2 border-dashed border-slate-200 rounded-2xl space-y-5 animate-fade-in bg-slate-50/50">
                  <div className="w-14 h-14 bg-red-50 text-red-600 border border-red-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 font-sans">
                      Aucune fiche technique œnologique détaillée
                    </h3>
                    <p className="text-xs text-slate-500 font-serif leading-relaxed italic">
                      Générez instantanément une fiche complète contenant l'AOP, le terroir, les cépages, l'âge des vignes, la vinification et les conseils de sommelier indispensables au service de votre établissement.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleGenerateTechSheet}
                      disabled={isGenerating}
                      className="h-11 bg-red-600 hover:bg-red-700 text-white disabled:bg-slate-300 disabled:text-slate-500 px-6 rounded-xl flex items-center gap-2 font-bold font-sans text-xs shadow-md hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Génération de la fiche par l'IA en cours...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-yellow-300" />
                          Générer la Fiche Technique (IA)
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditWine(wine)}
                      disabled={isGenerating}
                      className="h-11 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-5 rounded-xl flex items-center gap-2 font-semibold font-sans text-xs shadow-2xs transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                      Saisir manuellement
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OPERATIONS & STOCK */}
          {activeTab === 'stock' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Main Info Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" /> Stock En Cave
                  </span>
                  <p className={`text-base font-bold font-mono ${
                    wine.quantity === 0 
                      ? 'text-rose-600' 
                      : wine.quantity <= wine.alertThreshold 
                        ? 'text-amber-600' 
                        : 'text-emerald-600'
                  }`}>
                    {wine.quantity} bouteille{wine.quantity > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-slate-400" /> Seuil Alerte
                  </span>
                  <p className="text-base font-bold font-mono text-slate-700">
                    {wine.alertThreshold} bt{wine.alertThreshold > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Emplacement
                  </span>
                  <p className="text-xs font-bold text-slate-700 truncate" title={site?.name}>
                    {site?.name?.split(' - ')[0] || 'Non défini'}
                  </p>
                  {wine.bin && (
                    <p className="text-[10px] font-mono font-bold text-red-600">
                      Code : {wine.bin.replace(/[\s\-_]/g, '').toUpperCase()}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <Euro className="w-3.5 h-3.5 text-slate-400" /> Prix de vente TTC
                  </span>
                  <p className="text-base font-bold font-mono text-slate-800">
                    {wine.priceSell ? `${wine.priceSell.toFixed(2)} €` : 'N/C'}
                  </p>
                  
                  <div className="mt-1 space-y-0.5 text-[10px] border-t border-slate-100 pt-1 font-mono text-slate-500">
                    {wine.priceBuy !== undefined && (
                      <div className="text-slate-500 text-[10px]">
                        <span className="text-slate-400">Achat :</span> <span className="font-bold text-slate-700">{wine.priceBuy.toFixed(2)} €</span>
                        {wine.priceBuyHt !== undefined && wine.shippingCost !== undefined && wine.shippingCost > 0 ? (
                          <span className="text-amber-800 font-medium block mt-0.5 text-[9px]">
                            ({wine.priceBuyHt.toFixed(2)} € HT + {wine.shippingCost.toFixed(2)} € port)
                          </span>
                        ) : wine.shippingCost !== undefined && wine.shippingCost > 0 ? (
                          <span className="text-amber-800 font-medium block mt-0.5 text-[9px]">
                            (dont {wine.shippingCost.toFixed(2)} € de frais de port)
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Site & Rang Modification Panel */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 border border-slate-800 shadow-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                      Modification rapide : Site & Rang
                    </span>
                  </div>
                  {!isEditingLocation && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDispatchModal(true)}
                        className="text-xs font-bold text-amber-300 hover:text-white bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Ventiler ou transférer facilement les bouteilles entre les sites"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                        Ventiler les sites
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickSiteId(wine.siteId);
                          setQuickBin(wine.bin || '');
                          setIsEditingLocation(true);
                        }}
                        className="text-xs font-bold text-red-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-red-400" />
                        Modifier
                      </button>
                    </div>
                  )}
                </div>

                {locationSuccessMsg && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{locationSuccessMsg}</span>
                  </div>
                )}

                {isEditingLocation ? (
                  <form onSubmit={handleQuickSaveLocation} className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                          Nouveau site
                        </label>
                        <select
                          value={quickSiteId}
                          onChange={(e) => setQuickSiteId(e.target.value)}
                          className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-red-500 font-sans"
                        >
                          {sites.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                          Code Rang / Emplacement
                        </label>
                        <input
                          type="text"
                          value={quickBin}
                          onChange={(e) => setQuickBin(e.target.value)}
                          placeholder="Ex: 1D4, Rang A2..."
                          className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-red-500 uppercase"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingLocation(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingLocation}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isSavingLocation ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Valider Emplacement
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 font-mono">
                    <div>
                      <span className="text-[9px] uppercase text-slate-400 font-bold block">Site Affecté :</span>
                      <span className="font-bold text-slate-200">{site?.name || 'Non attribué'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-slate-400 font-bold block">Rang / Code :</span>
                      <span className="font-bold text-red-400">
                        {wine.bin ? wine.bin.replace(/[\s\-_]/g, '').toUpperCase() : 'Non renseigné'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Regional details and notes */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wine.region && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-150 p-3 rounded-xl">
                      <Tag className="w-4.5 h-4.5 text-red-600 shrink-0" />
                      <span>Région d'origine : <strong className="text-slate-900 font-sans">{wine.region}</strong></span>
                    </div>
                  )}

                  {marginVal !== null && marginPct !== null && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl font-mono">
                      <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                      <span>Marge brute HT/TTC : <strong className="text-emerald-800 font-sans">+{marginVal.toFixed(2)} € ({marginPct.toFixed(1)}%)</strong></span>
                    </div>
                  )}
                </div>

                {wine.notes && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Notebook className="w-3.5 h-3.5 text-red-600" /> Notes de dégustation & Inventaires
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-serif italic whitespace-pre-line">
                      "{wine.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Warning and Action if current site is empty (0 stock) but stock exists elsewhere */}
              {wine.quantity === 0 && otherSitesWines.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Stock à 0 sur ce site ({site?.name?.split(' - ')[0] || 'ce site'})
                    </span>
                    <p className="text-[11px] text-amber-800 leading-tight">
                      Cette référence possède {otherSitesWines.reduce((acc, w) => acc + (w.quantity || 0), 0)} bouteille(s) disponible(s) sur d'autres sites.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCurrentWineId(otherSitesWines[0].id)}
                      className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors shadow-2xs"
                    >
                      Basculer sur le site en stock
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteResidualSite}
                      className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                      title="Supprimer ce site vide"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Supprimer ce site vide
                    </button>
                  </div>
                </div>
              )}

              {/* Other Sites Stock Panel */}
              {otherSitesWines.length > 0 && (
                <div className="p-4 bg-red-50/35 border border-red-100 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-red-600 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" /> Également disponible sur d'autres sites
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {otherSitesWines.map((otherWine) => {
                      const otherSite = sites.find(s => s.id === otherWine.siteId);
                      const otherSiteName = otherSite ? otherSite.name : 'Site inconnu';
                      return (
                        <div
                          key={otherWine.id}
                          onClick={() => setCurrentWineId(otherWine.id)}
                          className="bg-white border border-slate-200 hover:border-amber-400 hover:shadow-xs rounded-lg p-2.5 flex justify-between items-center text-xs cursor-pointer transition-all group"
                          title="Cliquez pour afficher la fiche sur ce site"
                        >
                          <div>
                            <p className="font-bold text-slate-800 group-hover:text-amber-900 transition-colors">
                              {otherSiteName.split(' - ')[0]}
                            </p>
                            {otherWine.bin && (
                              <p className="text-[10px] font-mono text-slate-400">Rang : {otherWine.bin}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-900 transition-colors">
                              {otherWine.quantity} bt{otherWine.quantity > 1 ? 's' : ''}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock History & Logs Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <History className="w-4 h-4 text-red-600" /> Historique & Traçabilité des Mouvements
                  </h3>
                  <button
                    onClick={() => onRecordMovement(wine)}
                    className="text-[10px] uppercase font-mono font-bold bg-slate-150 text-slate-700 hover:text-slate-950 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Enregistrer un flux
                  </button>
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {wineMovements.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-mono text-xs">
                      Aucun historique de mouvements enregistré pour cette référence.
                    </div>
                  ) : (
                    wineMovements.map((mov) => {
                      const isPositive = mov.type === 'in' || (mov.type === 'correction' && mov.quantity > 0);
                      const isTransfer = mov.type === 'transfer';
                      
                      return (
                        <div key={mov.id} className="pt-2.5 flex justify-between items-start text-xs gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${
                              isTransfer 
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : isPositive 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {isTransfer ? (
                                <RefreshCw className="w-3.5 h-3.5" />
                              ) : isPositive ? (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <p className="text-slate-800 font-medium leading-normal text-xs">
                                <span className="uppercase font-mono font-bold text-red-600 mr-1.5">{mov.reason}</span>
                                {mov.notes && <span className="text-slate-500 font-serif"> - "{mov.notes}"</span>}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span>Par {mov.userName}</span>
                                <span>&bull;</span>
                                <span>{new Date(mov.createdAt).toLocaleString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`font-mono font-bold px-2 py-0.5 rounded-lg text-[10px] shrink-0 border ${
                            isTransfer 
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isPositive 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isTransfer ? 'TF' : isPositive ? '+' : '-'}{Math.abs(mov.quantity)} bt
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-2.5 mt-auto shrink-0">
          {/* Delete Action button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`h-10 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold font-sans transition-all duration-200 cursor-pointer border ${
              confirmDelete 
                ? 'bg-red-600 border-red-700 text-white animate-pulse shadow-sm'
                : 'bg-transparent hover:bg-rose-50 text-slate-400 hover:text-red-600 border-slate-200 hover:border-red-200'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? 'Confirmer la suppression' : 'Supprimer la fiche'}
          </button>

          {/* Edit Buttons */}
          <div className="flex gap-2.5 font-sans">
            <button
              onClick={() => onDuplicateWine(wine)}
              className="h-10 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer text-xs"
              title="Dupliquer cette référence pour changer le millésime ou créer une variante"
            >
              <Copy className="w-3.5 h-3.5 text-blue-500" />
              Dupliquer
            </button>

            <button
              onClick={() => onEditWine(wine)}
              className="h-10 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer text-xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-500" />
              Modifier la Fiche
            </button>

            <button
              onClick={() => onRecordMovement(wine)}
              className="h-10 bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl flex items-center gap-1.5 font-bold transition-colors cursor-pointer text-xs shadow-sm"
            >
              Ajuster le stock
            </button>
          </div>
        </div>

      </div>

      {showDispatchModal && (
        <MultiSiteDispatchModal
          referenceWine={wine}
          onClose={() => setShowDispatchModal(false)}
        />
      )}
    </div>
  );
};
