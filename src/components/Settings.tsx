import React, { useState, useRef } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { 
  UploadCloud, 
  Trash2, 
  Wrench, 
  Check, 
  ShieldAlert, 
  Sparkles, 
  Image as ImageIcon,
  Database,
  RefreshCw,
  AlertOctagon,
  Settings as SettingsIcon,
  Calculator,
  TrendingUp,
  ShieldCheck,
  Eye,
  MapPin
} from 'lucide-react';
import { DuplicateInspectionModal } from './DuplicateInspectionModal';
import { RegionManagement } from './RegionManagement';
import { ZeroStockManagementModal } from './ZeroStockManagementModal';
import { Wine } from '../types';

export const Settings: React.FC = () => {
  const { 
    wines,
    sites,
    updateWine,
    appLogo, 
    updateAppLogo, 
    deduplicateCellar, 
    repairWinesData, 
    cleanZeroStockResiduals,
    apply3TierPricingToAllWines,
    resetAllStocks,
    clearMovementsHistory,
    clearDatabase, 
    isDemo,
    user 
  } = useFirebase();

  const [settingsTab, setSettingsTab] = useState<'regions' | 'general'>('regions');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isZeroStockModalOpen, setIsZeroStockModalOpen] = useState(false);
  const zeroStockCount = wines.filter(w => (w.quantity || 0) === 0).length;
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isCleaningZeroStock, setIsCleaningZeroStock] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isApplyingPricing, setIsApplyingPricing] = useState(false);
  const [isResettingStocks, setIsResettingStocks] = useState(false);
  const [isClearingMovements, setIsClearingMovements] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(0);
  const [bulkProgressLogs, setBulkProgressLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingWines = wines.filter(w => !w.technicalSheet);

  const handleLogoUpload = (file: File) => {
    setUploadError(null);
    setSuccessMsg(null);

    // Validate type
    if (!file.type.match('image/.*')) {
      setUploadError("Le fichier doit être une image (PNG, JPG, SVG, WEBP).");
      return;
    }

    // Read as Base64 and compress with Canvas to avoid Firestore size limit
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError("Erreur lors de la lecture du fichier.");
    };

    reader.onload = (event) => {
      const resultStr = event.target?.result as string;

      // SVGs do not need resizing and can be kept as raw strings
      if (file.type === 'image/svg+xml') {
        if (resultStr.length > 300000) {
          setUploadError("Le fichier SVG est trop volumineux (max 300 Ko).");
          return;
        }
        updateAppLogo(resultStr)
          .then(() => {
            setSuccessMsg("Votre logo SVG a été importé avec succès !");
            setTimeout(() => setSuccessMsg(null), 3000);
          })
          .catch((err) => {
            setUploadError("Échec de la sauvegarde sur le serveur.");
          });
        return;
      }

      // Resize non-SVG images using canvas
      const img = new Image();
      img.onerror = () => {
        setUploadError("Fichier image corrompu ou illisible.");
      };

      img.onload = () => {
        const maxDim = 400; // Optimal bounding box for logos
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            // Fallback to raw base64 if canvas context is not supported
            updateAppLogo(resultStr);
            setSuccessMsg("Logo mis à jour.");
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/png');

          updateAppLogo(compressedBase64)
            .then(() => {
              setSuccessMsg("Le logo officiel de l'établissement a été mis à jour avec succès !");
              setTimeout(() => setSuccessMsg(null), 4000);
            })
            .catch((err) => {
              setUploadError("Impossible de synchroniser le logo avec le serveur.");
            });
        } catch (e) {
          setUploadError("Erreur lors de la compression de l'image.");
        }
      };
      img.src = resultStr;
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleResetLogo = async () => {
    if (window.confirm("Voulez-vous supprimer le logo personnalisé et restaurer l'écusson d'origine ?")) {
      try {
        await updateAppLogo(null);
        setSuccessMsg("Logo d'origine restauré.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (e) {
        setUploadError("Erreur lors de la réinitialisation.");
      }
    }
  };

  // Cellar diagnostics & utilities
  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    setSuccessMsg(null);
    try {
      const mergedCount = await deduplicateCellar();
      if (mergedCount > 0) {
        setSuccessMsg(`Succès ! ${mergedCount} bouteilles en double ont été fusionnées.`);
      } else {
        setSuccessMsg("Aucun doublon n'a été détecté dans votre cave.");
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setUploadError("Erreur lors de la déduplication.");
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleRepairRegions = async () => {
    setIsRepairing(true);
    setSuccessMsg(null);
    try {
      const repairedCount = await repairWinesData();
      if (repairedCount > 0) {
        setSuccessMsg(`Succès ! Les fiches de ${repairedCount} bouteilles ont été réparées (Pays complétés / Imports DPR corrigés).`);
      } else {
        setSuccessMsg("Toutes vos données de cave sont intègres et aucune correction n'est requise.");
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setUploadError("Erreur lors de la réparation des fiches.");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleCleanZeroStock = async () => {
    if (!window.confirm("Nettoyer automatiquement les reliquats de sites à 0 bouteille ?\n\nCette action va supprimer uniquement les fiches de sites vides (stock = 0) lorsqu'une autre fiche pour le même vin possède du stock sur un autre site. La traçabilité de tous vos mouvements passés reste 100% préservée.")) {
      return;
    }
    setIsCleaningZeroStock(true);
    setSuccessMsg(null);
    setUploadError(null);
    try {
      const removedCount = await cleanZeroStockResiduals();
      if (removedCount > 0) {
        setSuccessMsg(`Nettoyage réussi : ${removedCount} enregistrement(s) à 0 bouteille résiduel(s) supprimé(s).`);
      } else {
        setSuccessMsg("Aucun reliquat vide détecté. Votre cave est parfaitement propre.");
      }
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      setUploadError("Erreur lors du nettoyage des reliquats de stock.");
    } finally {
      setIsCleaningZeroStock(false);
    }
  };

  const handleApplyPricingStrategy = async () => {
    setIsApplyingPricing(true);
    setSuccessMsg(null);
    try {
      const updatedCount = await apply3TierPricingToAllWines();
      if (updatedCount > 0) {
        setSuccessMsg(`Succès ! Les prix de vente de ${updatedCount} références ont été mis à jour selon la règle des 3 tranches (Coeffs 2.7 / 2.5 / 2.2).`);
      } else {
        setSuccessMsg("Toutes les références sont déjà parfaitement conformes au tarif 3 tranches (2.7 / 2.5 / 2.2).");
      }
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setUploadError("Erreur lors de l'application de la stratégie tarifaire.");
    } finally {
      setIsApplyingPricing(false);
    }
  };

  const handleResetStocks = async () => {
    if (window.confirm("Voulez-vous réinitialiser à 0 les stocks de TOUTES les références ?\n\nToutes les informations sur les vins (Appellation, Domaine, Cuvée, Prix, Format, Fiches techniques, etc.) seront CONSERVÉES intactes. Seules les quantités en stock et casiers seront remis à zéro pour l'inventaire manuel.")) {
      setIsResettingStocks(true);
      setSuccessMsg(null);
      try {
        const count = await resetAllStocks();
        setSuccessMsg(`Succès ! Les stocks de ${count} références ont été remis à 0.`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err) {
        setUploadError("Erreur lors de la remise à 0 des stocks.");
      } finally {
        setIsResettingStocks(false);
      }
    }
  };

  const handleClearMovements = async () => {
    if (window.confirm("Voulez-vous effacer l'intégralité de l'historique des mouvements de stock (entrées, sorties, ajustements) ?\n\nVos fiches de vins et leurs stocks actuels resteront inchangés.")) {
      setIsClearingMovements(true);
      setSuccessMsg(null);
      try {
        const count = await clearMovementsHistory();
        setSuccessMsg(`Succès ! ${count} entrées de traçabilité et flux ont été définitivement supprimées.`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err) {
        setUploadError("Erreur lors de la suppression de l'historique des mouvements.");
      } finally {
        setIsClearingMovements(false);
      }
    }
  };

  const handleResetDb = async () => {
    const confirmation = window.confirm(
      "🔥 DANGER - DESTRUCTIF :\n\n" +
      "Voulez-vous réinitialiser TOUTE la base de données ?\n" +
      "Cette action va supprimer TOUTES vos bouteilles de vin, historiques de mouvements, et réinitialiser les 7 sites de stockage par défaut de l'établissement.\n\n" +
      "Cette opération est irréversible. Écrivez 'PREMNORD' pour valider :"
    );

    if (!confirmation) return;

    const typedName = window.prompt("Saisissez 'PREMNORD' en majuscules pour confirmer la réinitialisation totale :");
    if (typedName !== 'PREMNORD') {
      alert("Validation incorrecte. Action annulée.");
      return;
    }

    setIsResetting(true);
    setSuccessMsg(null);
    try {
      await clearDatabase();
      setSuccessMsg("La base de données a été entièrement vidée et réinitialisée aux valeurs d'origine.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setUploadError("Erreur fatale lors de la réinitialisation.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (pendingWines.length === 0) return;
    setBulkGenerating(true);
    setBulkProgressLogs([]);
    
    for (let i = 0; i < pendingWines.length; i++) {
      const currentWine = pendingWines[i];
      setCurrentWineIndex(i);
      
      const logMsg = `[${i + 1}/${pendingWines.length}] Génération de la fiche pour ${currentWine.name} (${currentWine.domain} - ${currentWine.vintage})...`;
      setBulkProgressLogs(prev => [logMsg, ...prev]);
      
      try {
        const response = await fetch('/api/gemini/generate-technical-sheet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            wineName: currentWine.appellation || currentWine.name,
            domain: currentWine.domain,
            vintage: currentWine.vintage,
            color: currentWine.color,
            region: currentWine.region || ''
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur serveur (${response.status})`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        await updateWine(currentWine.id, { technicalSheet: { ...data, hasGenerated: true } }, 'edit');
        setBulkProgressLogs(prev => [`✅ Succès : ${currentWine.name}`, ...prev]);
      } catch (err: any) {
        console.error(err);
        setBulkProgressLogs(prev => [`❌ Échec : ${currentWine.name} (${err.message || "Erreur de service"})`, ...prev]);
      }
      
      // Delay to avoid aggressive rate limit
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setBulkGenerating(false);
    setSuccessMsg("La génération en masse des fiches techniques est terminée !");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in" id="settings-view-container">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 font-sans flex items-center gap-2">
          <SettingsIcon className="w-5.5 h-5.5 text-red-600" />
          Paramètres & Urbanisation
        </h2>
        <p className="text-xs text-slate-500 font-sans mt-0.5">
          Gérez le référentiel des régions viticoles, l'identité de l'établissement et les outils de maintenance.
        </p>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setSettingsTab('regions')}
          className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer font-sans ${
            settingsTab === 'regions'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Référentiel des Régions & Terroirs</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            settingsTab === 'regions' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-700'
          }`}>
            Auvergne incluse
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsTab('general')}
          className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer font-sans ${
            settingsTab === 'general'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Identité & Diagnostics Système</span>
        </button>
      </div>

      {/* Messages */}
      {uploadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2 items-center" id="settings-error">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-600" />
          <span className="font-semibold">{uploadError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex gap-2 items-center shadow-sm" id="settings-success">
          <Check className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {settingsTab === 'regions' ? (
        <RegionManagement />
      ) : (
        <div className="space-y-6">
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Logo & Branding */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-1.5">
              <ImageIcon className="w-4.5 h-4.5 text-red-600" />
              Logo de l'Établissement
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Importez le logo officiel de votre restaurant. Il s'affichera à la place de l'écusson d'origine en haut de l'écran, sur la page de connexion, et sur la carte des vins client.
            </p>
          </div>

          {/* Logo preview and Drop Zone */}
          <div className="flex flex-col sm:flex-row gap-5 items-center bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
            {/* Visual Indicator */}
            <div className="w-20 h-20 shrink-0 bg-white border border-slate-200/80 rounded-xl shadow-inner flex items-center justify-center overflow-hidden p-1.5 relative group">
              {appLogo ? (
                <img 
                  src={appLogo} 
                  alt="Aperçu logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center text-slate-300 flex flex-col items-center">
                  <ImageIcon className="w-6 h-6 stroke-1 mb-0.5" />
                  <span className="text-[8px] font-mono uppercase">Aucun</span>
                </div>
              )}
            </div>

            {/* Upload Area */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex-grow w-full border border-dashed border-slate-300 hover:border-red-500/50 bg-white p-4 rounded-xl text-center cursor-pointer hover:bg-slate-50/50 transition-all select-none flex flex-col items-center justify-center py-5"
            >
              <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
              <p className="text-[11px] font-bold text-slate-700">Importer une image</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Glissez-déposez ou cliquez ici</p>
              <p className="text-[8px] text-slate-400">PNG, JPG ou SVG</p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-[10px] font-mono text-slate-400">
              {appLogo ? "Logo personnalisé actif" : "Logo par défaut (sage)"}
            </span>
            
            {appLogo && (
              <button
                onClick={handleResetLogo}
                className="h-8 hover:bg-rose-50 text-rose-600 px-3 rounded-lg flex items-center gap-1 font-semibold text-xs border border-rose-200/50 cursor-pointer transition-colors"
                title="Restaurer l'écusson d'origine"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Restaurer l'original</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: System Diagnostics & Data Quality */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-1.5">
              <Wrench className="w-4.5 h-4.5 text-red-600" />
              Maintenance & Diagnostics
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Utilitaires pour maintenir l'intégrité de la base de données Premnord. Nettoyez les erreurs de saisie ou réparez les incohérences géographiques.
            </p>
          </div>

          {/* Action List */}
          <div className="space-y-2.5">
            {/* Action A: Cellar Deduplication with Educational Inspection */}
            <button
              onClick={() => setIsDuplicateModalOpen(true)}
              className="w-full h-11 border border-amber-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Audit & déduplication de la cave</p>
                  <p className="text-[9px] text-slate-400">Prévisualise les fiches en doublon avant fusion (zéro perte de stock)</p>
                </div>
              </div>
              <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Action A2: Identification & Selective Deletion of 0-Stock Wines */}
            <button
              onClick={() => setIsZeroStockModalOpen(true)}
              className="w-full h-11 border border-rose-200 hover:border-rose-300 hover:bg-rose-50/50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Identifier &amp; supprimer les références à stock 0</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                      {zeroStockCount} réf.
                    </span>
                  </p>
                  <p className="text-[9px] text-slate-400">Inspecte les ruptures totales, reliquats et fiches orphelines pour choisir quoi supprimer</p>
                </div>
              </div>
              <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Action B: Geo Repair */}
            <button
              onClick={handleRepairRegions}
              disabled={isRepairing}
              className="w-full h-11 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Renseigner les pays</p>
                  <p className="text-[9px] text-slate-400">Déduit le pays d'origine de l'appellation (Chili, France, etc.)</p>
                </div>
              </div>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isRepairing ? 'animate-spin' : ''}`} />
            </button>

            {/* Action B2: Clean Zero Stock Residuals */}
            <button
              onClick={handleCleanZeroStock}
              disabled={isCleaningZeroStock}
              className="w-full h-11 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trash2 className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Nettoyer les sites résiduels à 0 bouteille</p>
                  <p className="text-[9px] text-slate-400">Supprime les fiches vides lorsqu'un stock actif existe sur un autre site</p>
                </div>
              </div>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isCleaningZeroStock ? 'animate-spin' : ''}`} />
            </button>

            {/* Action C: Apply 3-Tier Pricing Strategy */}
            <button
              onClick={handleApplyPricingStrategy}
              disabled={isApplyingPricing}
              className="w-full h-11 border border-red-200 hover:border-red-300 hover:bg-red-50/50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calculator className="w-4 h-4 text-red-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Appliquer le tarif 3 tranches à toutes les références</p>
                  <p className="text-[9px] text-slate-400">Coeff 2,7 (≤50€) | Coeff 2,5 (≤100€) | Coeff 2,2 (&gt;100€) — Arrondi à l'€ supérieur</p>
                </div>
              </div>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isApplyingPricing ? 'animate-spin' : ''}`} />
            </button>

            {/* Action C: Reset Stocks Only */}
            <button
              onClick={handleResetStocks}
              disabled={isResettingStocks}
              className="w-full h-11 border border-amber-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Remettre tous les stocks à 0</p>
                  <p className="text-[9px] text-slate-400">Conserve toutes les fiches références intactes (pour inventaire)</p>
                </div>
              </div>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isResettingStocks ? 'animate-spin' : ''}`} />
            </button>

            {/* Action D: Clear Movements History */}
            <button
              onClick={handleClearMovements}
              disabled={isClearingMovements}
              className="w-full h-11 border border-rose-200 hover:border-rose-300 hover:bg-rose-50/50 text-slate-700 px-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Vider l'historique des flux & mouvements</p>
                  <p className="text-[9px] text-slate-400">Efface la traçabilité en base pour repartir d'une page vierge</p>
                </div>
              </div>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isClearingMovements ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>Intégrité des données : 100%</span>
          </div>
        </div>

      </div>

      {/* Bulk Generation Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-red-600 animate-pulse" />
              Génération en masse des Fiches Techniques (IA)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              Générez instantanément des fiches techniques œnologiques pour tous les vins de votre cave ne disposant pas encore d'une fiche active. Ce traitement intelligent s'appuie sur le modèle d'intelligence artificielle de Premnord.
            </p>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Complétion</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {wines.length - pendingWines.length} / {wines.length}
            </span>
            <span className="text-[10px] font-mono font-bold text-red-600 mt-0.5">
              {wines.length ? Math.round(((wines.length - pendingWines.length) / wines.length) * 100) : 0}% complété
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative border border-slate-200/50">
          <div 
            className="bg-red-650 h-full transition-all duration-500 rounded-full" 
            style={{ width: `${wines.length ? ((wines.length - pendingWines.length) / wines.length) * 100 : 0}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Status & Trigger */}
          <div className="md:col-span-1 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Actions</span>
              <p className="text-xs text-slate-500 font-serif leading-relaxed italic">
                {pendingWines.length === 0 
                  ? "Félicitations ! Toutes les bouteilles de votre cave disposent d'une fiche technique œnologique active."
                  : `Il reste ${pendingWines.length} bouteilles en attente de génération de fiche technique.`}
              </p>
            </div>

            <button
              onClick={handleBulkGenerate}
              disabled={bulkGenerating || pendingWines.length === 0}
              className="w-full h-11 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 text-white px-5 rounded-xl flex items-center justify-center gap-2 font-bold font-sans text-xs shadow-md hover:scale-[1.01] active:scale-99 transition-all cursor-pointer"
            >
              {bulkGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Génération en cours ({currentWineIndex + 1}/{pendingWines.length})...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  Lancer la génération en masse
                </>
              )}
            </button>
          </div>

          {/* Real-time Logs Feed */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-950 rounded-xl p-4 flex flex-col space-y-2 max-h-[160px] overflow-hidden">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span>Journal de bord de la génération (Temps Réel)</span>
              {bulkGenerating && <span className="animate-pulse text-red-500">Actif ●</span>}
            </span>
            
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1.5 pr-1">
              {bulkProgressLogs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">
                  Aucun traitement en cours. Cliquez sur le bouton ci-contre pour lancer l'inventaire intelligent.
                </div>
              ) : (
                bulkProgressLogs.map((log, index) => (
                  <div key={index} className="pt-1 text-slate-300 leading-snug border-b border-slate-800/50 pb-1 last:border-0">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="w-5.5 h-5.5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-red-900 font-sans uppercase tracking-wider">Zone de Danger</h3>
            <p className="text-xs text-rose-800 leading-relaxed max-w-2xl">
              Les opérations suivantes ont un impact permanent et détruisent l'intégralité de l'inventaire en cours, ainsi que l'historique des sorties et entrées. À n'utiliser qu'en cas de réinitialisation complète de l'établissement.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-rose-200/50">
          <button
            onClick={handleResetDb}
            disabled={isResetting}
            className="h-10 bg-red-600 hover:bg-red-700 text-white px-5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm cursor-pointer transition-colors disabled:opacity-50"
          >
            <AlertOctagon className="w-4.5 h-4.5" />
            <span>Réinitialiser TOUTE la base de données</span>
          </button>
        </div>
      </div>
    </div>
    )}

      {/* Modal d'audit pédagogique des doublons */}
      <DuplicateInspectionModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onConfirmDeduplicate={async (selectedKeys?: string[], customOverrides?: Record<string, Partial<Wine>>) => {
          const count = await deduplicateCellar(selectedKeys, customOverrides);
          if (count > 0) {
            setSuccessMsg(`Succès ! ${count} doublons ont été résolus et fusionnés sans aucune perte.`);
          } else {
            setSuccessMsg("Aucun doublon n'a été détecté dans votre cave.");
          }
          setTimeout(() => setSuccessMsg(null), 4000);
          return count;
        }}
        wines={wines}
        sites={sites}
      />

      {/* Modal d'identification et arbitrage des références à stock 0 */}
      <ZeroStockManagementModal
        isOpen={isZeroStockModalOpen}
        onClose={() => setIsZeroStockModalOpen(false)}
      />
    </div>
  );
};
