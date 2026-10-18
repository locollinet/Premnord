import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wine, 
  Site, 
  WineColor, 
  getWineReferenceKey, 
  extractWineFormat 
} from '../types';
import { 
  ShieldCheck, 
  Layers, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X, 
  ArrowRight, 
  MapPin, 
  RefreshCw, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  CheckSquare,
  Square,
  Edit3,
  RotateCcw
} from 'lucide-react';

export interface GroupCustomization {
  name?: string;
  bin?: string;
  quantity?: number;
  priceBuy?: number;
  priceSell?: number;
}

interface DuplicateGroup {
  key: string;
  wines: Wine[];
  site: Site | undefined;
  siteName: string;
  domainName: string;
  wineName: string;
  vintage: string;
  color: WineColor;
  format: string;
  matchReason: string;
  totalQuantity: number;
  selectedBin: string;
  retainedPriceBuy?: number;
  retainedPriceSell?: number;
}

interface DuplicateInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeduplicate: (
    selectedKeys?: string[],
    customOverrides?: Record<string, Partial<Wine>>
  ) => Promise<number>;
  wines: Wine[];
  sites: Site[];
}

export const DuplicateInspectionModal: React.FC<DuplicateInspectionModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeduplicate,
  wines,
  sites
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPedagogicDetails, setShowPedagogicDetails] = useState(true);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);

  // State for customizing data before merging
  const [customizations, setCustomizations] = useState<Record<string, GroupCustomization>>({});
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);

  // Temporary inputs while editing a group
  const [tempName, setTempName] = useState<string>('');
  const [tempBin, setTempBin] = useState<string>('');
  const [tempQty, setTempQty] = useState<string>('');
  const [tempPriceBuy, setTempPriceBuy] = useState<string>('');
  const [tempPriceSell, setTempPriceSell] = useState<string>('');

  // Group duplicate wines by unified wine reference key + siteId
  const duplicateGroups: DuplicateGroup[] = useMemo(() => {
    const map = new Map<string, Wine[]>();

    for (const wine of wines) {
      const refKey = getWineReferenceKey(wine);
      const key = `${refKey}__${wine.siteId}`;

      const list = map.get(key) || [];
      list.push(wine);
      map.set(key, list);
    }

    const groups: DuplicateGroup[] = [];

    map.forEach((wList, key) => {
      if (wList.length > 1) {
        const master = wList[0];
        const site = sites.find(s => s.id === master.siteId);
        const totalQty = wList.reduce((acc, w) => acc + (w.quantity || 0), 0);
        const chosenBin = wList.find(w => w.bin && w.bin.trim())?.bin || master.bin || '';
        const priceBuy = wList.find(w => w.priceBuy !== undefined && w.priceBuy > 0)?.priceBuy ?? master.priceBuy;
        const priceSell = wList.find(w => w.priceSell !== undefined && w.priceSell > 0)?.priceSell ?? master.priceSell;
        const fmt = extractWineFormat(master);

        // Identify reason for detection
        const uniqueNames = Array.from(new Set(wList.map(w => w.name.trim())));
        let reason = 'Même domaine, cuvée, millésime et format sur le même site';
        if (uniqueNames.length > 1) {
          reason = `Variantes de libellé détectées : "${uniqueNames.join('" vs "')}" (même cuvée canonique)`;
        }

        groups.push({
          key,
          wines: wList,
          site,
          siteName: site?.name || 'Site non spécifié',
          domainName: master.domain,
          wineName: master.name,
          vintage: master.vintage || 'S.A.',
          color: master.color,
          format: fmt,
          matchReason: reason,
          totalQuantity: totalQty,
          selectedBin: chosenBin,
          retainedPriceBuy: priceBuy,
          retainedPriceSell: priceSell
        });
      }
    });

    return groups;
  }, [wines, sites]);

  // Synchronize selection with available groups on open or when groups change
  useEffect(() => {
    if (isOpen) {
      setSelectedGroupKeys(duplicateGroups.map(g => g.key));
    }
  }, [isOpen, duplicateGroups]);

  if (!isOpen) return null;

  const totalDuplicateCards = duplicateGroups.reduce((acc, g) => acc + g.wines.length, 0);
  const totalCardsToRemove = totalDuplicateCards - duplicateGroups.length;

  const selectedCount = selectedGroupKeys.length;
  const isAllSelected = duplicateGroups.length > 0 && selectedCount === duplicateGroups.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedGroupKeys([]);
    } else {
      setSelectedGroupKeys(duplicateGroups.map(g => g.key));
    }
  };

  const toggleSelectGroup = (key: string) => {
    setSelectedGroupKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const startEditing = (group: DuplicateGroup) => {
    const current = customizations[group.key];
    setTempName(current?.name !== undefined ? current.name : group.wineName);
    setTempBin(current?.bin !== undefined ? current.bin : group.selectedBin);
    setTempQty(String(current?.quantity !== undefined ? current.quantity : group.totalQuantity));
    setTempPriceBuy(
      current?.priceBuy !== undefined 
        ? String(current.priceBuy) 
        : (group.retainedPriceBuy !== undefined ? String(group.retainedPriceBuy) : '')
    );
    setTempPriceSell(
      current?.priceSell !== undefined 
        ? String(current.priceSell) 
        : (group.retainedPriceSell !== undefined ? String(group.retainedPriceSell) : '')
    );
    setEditingGroupKey(group.key);
  };

  const cancelEditing = () => {
    setEditingGroupKey(null);
  };

  const applyEditing = (groupKey: string) => {
    const parsedQty = tempQty.trim() !== '' ? parseInt(tempQty.trim(), 10) : undefined;
    const parsedBuy = tempPriceBuy.trim() !== '' ? parseFloat(tempPriceBuy.trim().replace(',', '.')) : undefined;
    const parsedSell = tempPriceSell.trim() !== '' ? parseFloat(tempPriceSell.trim().replace(',', '.')) : undefined;

    setCustomizations(prev => ({
      ...prev,
      [groupKey]: {
        name: tempName.trim() || undefined,
        bin: tempBin.trim(),
        quantity: parsedQty !== undefined && !isNaN(parsedQty) && parsedQty >= 0 ? parsedQty : undefined,
        priceBuy: parsedBuy !== undefined && !isNaN(parsedBuy) && parsedBuy >= 0 ? parsedBuy : undefined,
        priceSell: parsedSell !== undefined && !isNaN(parsedSell) && parsedSell >= 0 ? parsedSell : undefined,
      }
    }));
    setEditingGroupKey(null);
  };

  const resetGroupCustomization = (groupKey: string) => {
    setCustomizations(prev => {
      const copy = { ...prev };
      delete copy[groupKey];
      return copy;
    });
    if (editingGroupKey === groupKey) {
      setEditingGroupKey(null);
    }
  };

  const handleExecute = async () => {
    if (selectedGroupKeys.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const count = await onConfirmDeduplicate(selectedGroupKeys, customizations);
      setSuccessCount(count);
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || "Une erreur est survenue lors de la fusion.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white tracking-tight flex items-center gap-2">
                Audit & Résolution des Doublons
                <span className="text-xs font-mono font-normal bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  Impact Données Garanti
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Vérification méticuleuse avant toute fusion : contrôlez chaque lot, son motif d'identification et sélectionnez ceux à fusionner.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Notifications / Alerts */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Opération réussie ! <strong>{successCount}</strong> fiche(s) redondante(s) ont été fusionnées en toute sécurité.
              </span>
            </div>
          )}

          {/* Pedagogic Explanation Box */}
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
                <Info className="w-4 h-4 text-amber-600" />
                <span>Pourquoi et comment fonctionne cette détection ?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPedagogicDetails(!showPedagogicDetails)}
                className="text-amber-800 hover:text-amber-950 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                {showPedagogicDetails ? (
                  <>Masquer <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Afficher le détail <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>

            {showPedagogicDetails && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                
                <div className="bg-white/90 border border-amber-200/60 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Règle d'or : Même site uniquement</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Des bouteilles situées sur deux restaurants ou dépôts différents ne sont <strong>JAMAIS</strong> fusionnées. Chacun conserve son stock propre.
                  </p>
                </div>

                <div className="bg-white/90 border border-amber-200/60 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Calcul de stock sans perte</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    La quantité résultante est la somme exacte des stocks de chaque fiche doublon. Aucun flacon n'est perdu ou oublié.
                  </p>
                </div>

                <div className="bg-white/90 border border-amber-200/60 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-purple-800">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Données enrichies</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    L'emplacement (casier), les prix d'achat/vente et les commentaires de dégustation sont conservés et regroupés automatiquement.
                  </p>
                </div>

              </div>
            )}
          </div>

          {/* Synthesis Stats & Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-700">
                Diagnostic de cave : <strong className="text-slate-900">{duplicateGroups.length} groupe{duplicateGroups.length > 1 ? 's' : ''} de doublons</strong> identifié{duplicateGroups.length > 1 ? 's' : ''}.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-slate-500">
                {totalDuplicateCards} fiches redondantes &rarr; <span className="text-emerald-700 font-bold">{duplicateGroups.length} fiche{duplicateGroups.length > 1 ? 's' : ''} propre{duplicateGroups.length > 1 ? 's' : ''}</span> ({totalCardsToRemove} fiche{totalCardsToRemove > 1 ? 's' : ''} nettoyée{totalCardsToRemove > 1 ? 's' : ''})
              </div>
              {duplicateGroups.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 text-xs font-bold font-mono text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Tout désélectionner
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      Tout sélectionner ({selectedCount}/{duplicateGroups.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* List of Detected Duplicates with Before / After Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                Prévisualisation des fiches concernées ({duplicateGroups.length}) :
              </h4>
              {duplicateGroups.length > 0 && (
                <span className="text-xs font-mono font-bold text-amber-700">
                  {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''} sur {duplicateGroups.length}
                </span>
              )}
            </div>

            {duplicateGroups.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Aucun doublon dans votre cave</p>
                <p className="text-xs text-slate-500">Votre inventaire est parfaitement ordonné et exempt de fiches multiples sur le même site.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {duplicateGroups.map((group) => {
                  const isChecked = selectedGroupKeys.includes(group.key);
                  return (
                    <div 
                      key={group.key}
                      className={`border rounded-xl p-4 transition-all shadow-2xs space-y-3 ${
                        isChecked 
                          ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400' 
                          : 'border-slate-200 bg-white opacity-70 hover:opacity-100 hover:border-slate-300'
                      }`}
                    >
                      {/* Wine Header with individual Checkbox */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectGroup(group.key)}
                            className="p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                            title={isChecked ? "Désélectionner ce lot" : "Sélectionner ce lot pour la fusion"}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 font-serif">{group.wineName}</span>
                              <span className="text-xs font-mono text-slate-500 font-bold">({group.vintage})</span>
                              <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                                {group.format}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{group.domainName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {group.siteName.split(' - ')[0]}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {group.wines.length} fiches en double
                          </span>
                        </div>
                      </div>

                      {/* Explanatory badge for why these cards are considered duplicates */}
                      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 text-slate-700">
                          <span className="font-bold text-slate-900">Motif de la détection : </span>
                          <span>{group.matchReason}</span>
                        </div>
                      </div>

                      {/* Comparison Grid: Current separate cards vs Merged result */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        
                        {/* Before: Current separate cards */}
                        <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-200/60 space-y-2">
                          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                            Situation actuelle (Fiches séparées sur {group.siteName.split(' - ')[0]}) :
                          </span>
                          <div className="space-y-1.5">
                            {group.wines.map((wine, wIdx) => (
                              <div key={wine.id} className="bg-white px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 truncate" title={wine.name}>
                                    Fiche #{wIdx + 1} : {wine.name}
                                  </span>
                                  <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 ml-2">
                                    {wine.quantity} bt{wine.quantity > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                  {wine.bin && <span>Rang : {wine.bin}</span>}
                                  {wine.priceBuy !== undefined && <span>Achat : {wine.priceBuy.toFixed(2)}€</span>}
                                  {wine.priceSell !== undefined && <span>Vente : {wine.priceSell.toFixed(2)}€</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* After: Consolidated result or In-Place Editor */}
                        {(() => {
                          const custom = customizations[group.key];
                          const isCustomized = Boolean(
                            custom && (
                              (custom.name !== undefined && custom.name !== group.wineName) ||
                              (custom.bin !== undefined && custom.bin !== group.selectedBin) ||
                              (custom.quantity !== undefined && custom.quantity !== group.totalQuantity) ||
                              (custom.priceBuy !== undefined && custom.priceBuy !== group.retainedPriceBuy) ||
                              (custom.priceSell !== undefined && custom.priceSell !== group.retainedPriceSell)
                            )
                          );

                          const effectiveName = custom?.name !== undefined && custom.name.trim() ? custom.name.trim() : group.wineName;
                          const effectiveBin = custom?.bin !== undefined ? custom.bin : group.selectedBin;
                          const effectiveQty = custom?.quantity !== undefined ? custom.quantity : group.totalQuantity;
                          const effectivePriceBuy = custom?.priceBuy !== undefined ? custom.priceBuy : group.retainedPriceBuy;
                          const effectivePriceSell = custom?.priceSell !== undefined ? custom.priceSell : group.retainedPriceSell;

                          const isCurrentlyEditing = editingGroupKey === group.key;

                          const availableBins = Array.from(new Set(group.wines.map(w => (w.bin || '').trim()).filter(Boolean)));
                          const availableBuyPrices = Array.from(new Set(group.wines.map(w => w.priceBuy).filter((p): p is number => p !== undefined && p > 0)));
                          const availableSellPrices = Array.from(new Set(group.wines.map(w => w.priceSell).filter((p): p is number => p !== undefined && p > 0)));
                          const availableNames = Array.from(new Set(group.wines.map(w => w.name.trim()).filter(Boolean)));

                          if (isCurrentlyEditing) {
                            return (
                              <div className="bg-amber-50/80 rounded-lg p-3 border-2 border-amber-400 space-y-3 shadow-xs">
                                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                                  <div className="flex items-center gap-1.5">
                                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                    <span className="text-[11px] font-bold text-amber-950 font-mono uppercase">
                                      Modifier les données avant fusion
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                                    {group.siteName.split(' - ')[0]}
                                  </span>
                                </div>

                                <div className="space-y-2 text-[11px]">
                                  {/* Nom de la fiche */}
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                                      Nom / Cuvée retenue :
                                    </label>
                                    <input
                                      type="text"
                                      value={tempName}
                                      onChange={(e) => setTempName(e.target.value)}
                                      className="w-full h-8 px-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs outline-none font-serif font-bold text-slate-900"
                                      placeholder="Nom de la cuvée"
                                    />
                                    {availableNames.length > 1 && (
                                      <div className="flex items-center gap-1 flex-wrap mt-1">
                                        <span className="text-[9px] text-slate-500 font-mono">Suggestions :</span>
                                        {availableNames.map(n => (
                                          <button
                                            key={n}
                                            type="button"
                                            onClick={() => setTempName(n)}
                                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                              tempName === n ? 'bg-amber-600 text-white border-amber-700 font-bold' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                                            }`}
                                          >
                                            {n}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Emplacement / Casier */}
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                                      Emplacement / Casier :
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={tempBin}
                                        placeholder="Ex: D4, MUR, Casier A..."
                                        onChange={(e) => setTempBin(e.target.value)}
                                        className="flex-1 h-8 px-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs outline-none font-mono font-bold text-slate-900"
                                      />
                                      {tempBin && (
                                        <button
                                          type="button"
                                          onClick={() => setTempBin('')}
                                          className="text-[10px] text-slate-400 hover:text-slate-600 underline font-mono cursor-pointer"
                                        >
                                          Effacer
                                        </button>
                                      )}
                                    </div>
                                    {availableBins.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap mt-1">
                                        <span className="text-[9px] text-slate-500 font-mono">Emplacements existants :</span>
                                        {availableBins.map(b => (
                                          <button
                                            key={b}
                                            type="button"
                                            onClick={() => setTempBin(b)}
                                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                              tempBin === b ? 'bg-amber-600 text-white border-amber-700 font-bold' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                                            }`}
                                          >
                                            {b}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Quantité & Prix */}
                                  <div className="grid grid-cols-3 gap-2 pt-1">
                                    {/* Stock total */}
                                    <div>
                                      <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                                        Stock total :
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={tempQty}
                                        onChange={(e) => setTempQty(e.target.value)}
                                        className="w-full h-8 px-2 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-mono font-bold outline-none text-center"
                                      />
                                      {tempQty !== String(group.totalQuantity) && (
                                        <button
                                          type="button"
                                          onClick={() => setTempQty(String(group.totalQuantity))}
                                          className="text-[8px] text-amber-800 underline font-mono mt-0.5 block cursor-pointer"
                                        >
                                          Auto: {group.totalQuantity}
                                        </button>
                                      )}
                                    </div>

                                    {/* Prix Achat */}
                                    <div>
                                      <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                                        Prix Achat (€) :
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={tempPriceBuy}
                                        onChange={(e) => setTempPriceBuy(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-8 px-2 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-mono outline-none text-center"
                                      />
                                      {availableBuyPrices.length > 1 && (
                                        <div className="flex gap-1 mt-0.5 flex-wrap">
                                          {availableBuyPrices.map(p => (
                                            <button
                                              key={p}
                                              type="button"
                                              onClick={() => setTempPriceBuy(String(p))}
                                              className="text-[8px] font-mono text-slate-600 hover:text-slate-900 underline cursor-pointer"
                                            >
                                              {p}€
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Prix Vente */}
                                    <div>
                                      <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                                        Prix Vente (€) :
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={tempPriceSell}
                                        onChange={(e) => setTempPriceSell(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-8 px-2 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-mono outline-none text-center"
                                      />
                                      {availableSellPrices.length > 1 && (
                                        <div className="flex gap-1 mt-0.5 flex-wrap">
                                          {availableSellPrices.map(p => (
                                            <button
                                              key={p}
                                              type="button"
                                              onClick={() => setTempPriceSell(String(p))}
                                              className="text-[8px] font-mono text-slate-600 hover:text-slate-900 underline cursor-pointer"
                                            >
                                              {p}€
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="px-3 py-1 text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => applyEditing(group.key)}
                                    className="px-3.5 py-1 text-[11px] font-mono font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Valider ces données
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className={`rounded-lg p-3 border transition-all space-y-2 ${
                              isCustomized 
                                ? 'bg-blue-50/70 border-blue-300 shadow-2xs' 
                                : 'bg-emerald-50/60 border-emerald-200/80'
                            }`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-mono uppercase font-bold flex items-center gap-1 ${
                                    isCustomized ? 'text-blue-800' : 'text-emerald-700'
                                  }`}>
                                    <CheckCircle className={`w-3.5 h-3.5 ${isCustomized ? 'text-blue-600' : 'text-emerald-600'}`} />
                                    {isCustomized ? 'Après fusion personnalisée :' : 'Après fusion :'}
                                  </span>
                                  {isCustomized ? (
                                    <span className="text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.2 rounded font-mono">
                                      ✏️ Données modifiées
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono uppercase">
                                      1 seule fiche propre
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isCustomized && (
                                    <button
                                      type="button"
                                      onClick={() => resetGroupCustomization(group.key)}
                                      className="text-[10px] text-slate-500 hover:text-rose-600 font-mono underline cursor-pointer"
                                      title="Rétablir les valeurs calculées automatiquement"
                                    >
                                      Rétablir auto
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startEditing(group)}
                                    className="px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Modifier manuellement l'emplacement, les prix ou le stock avant de fusionner"
                                  >
                                    <Edit3 className="w-3 h-3 text-amber-600" />
                                    Modifier avant fusion
                                  </button>
                                </div>
                              </div>

                              <div className="bg-white p-2.5 rounded-md border border-slate-200 text-[11px] space-y-1.5">
                                <p className="font-bold text-slate-900 font-serif flex items-center justify-between">
                                  <span>{effectiveName} <span className="font-sans text-slate-500 font-normal">({group.vintage})</span></span>
                                  {effectiveName !== group.wineName && (
                                    <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">
                                      nom modifié
                                    </span>
                                  )}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 pt-1 border-t border-slate-100">
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase">Site :</span>
                                    <span className="font-bold text-slate-700">{group.siteName.split(' - ')[0]}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase">Emplacement retenu :</span>
                                    <span className={`font-bold ${effectiveBin ? (isCustomized && custom?.bin !== undefined ? 'text-blue-700' : 'text-emerald-700') : 'text-amber-700'}`}>
                                      {effectiveBin || 'Non renseigné'}
                                    </span>
                                    {custom?.bin !== undefined && custom.bin !== group.selectedBin && (
                                      <span className="text-[8px] text-blue-600 font-bold ml-1">(modifié)</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase">Prix Achat retenu :</span>
                                    <span className="font-bold text-slate-700">
                                      {effectivePriceBuy !== undefined ? `${effectivePriceBuy.toFixed(2)} €` : 'Non renseigné'}
                                    </span>
                                    {custom?.priceBuy !== undefined && custom.priceBuy !== group.retainedPriceBuy && (
                                      <span className="text-[8px] text-blue-600 font-bold ml-1">(modifié)</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase">Prix Vente retenu :</span>
                                    <span className="font-bold text-slate-700">
                                      {effectivePriceSell !== undefined ? `${effectivePriceSell.toFixed(2)} €` : 'Non renseigné'}
                                    </span>
                                    {custom?.priceSell !== undefined && custom.priceSell !== group.retainedPriceSell && (
                                      <span className="text-[8px] text-blue-600 font-bold ml-1">(modifié)</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-1 px-1">
                                <span className="text-slate-600 font-sans">Stock consolidé total :</span>
                                <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded border ${
                                  effectiveQty !== group.totalQuantity
                                    ? 'text-blue-700 bg-blue-100/90 border-blue-300'
                                    : 'text-emerald-700 bg-emerald-100/80 border-emerald-300'
                                }`}>
                                  {effectiveQty} bt{effectiveQty > 1 ? 's' : ''}
                                </span>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  {effectiveQty !== group.totalQuantity ? 'quantité personnalisée' : 'stock cumulé exact'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Fermer sans modifier
            </button>

            {(() => {
              const customizedCount = Object.keys(customizations).filter(k => selectedGroupKeys.includes(k)).length;
              if (customizedCount === 0) return null;
              return (
                <span className="text-[11px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <Edit3 className="w-3 h-3 text-blue-600" />
                  <strong>{customizedCount}</strong> lot{customizedCount > 1 ? 's' : ''} personnalisé{customizedCount > 1 ? 's' : ''}
                </span>
              );
            })()}
          </div>

          {duplicateGroups.length > 0 && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || selectedCount === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Fusion en cours...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Confirmer la fusion sécurisée ({selectedCount} groupe{selectedCount > 1 ? 's' : ''} sur {duplicateGroups.length})
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
