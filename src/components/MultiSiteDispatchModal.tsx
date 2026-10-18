import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, isSameWineReference } from '../types';
import { X, CheckCircle, Plus, RefreshCw, MapPin, ArrowRightLeft, AlertTriangle, Layers, Minus } from 'lucide-react';

interface MultiSiteDispatchModalProps {
  referenceWine: Wine;
  onClose: () => void;
  onCompleted?: () => void;
}

export const MultiSiteDispatchModal: React.FC<MultiSiteDispatchModalProps> = ({ referenceWine, onClose, onCompleted }) => {
  const { wines, sites, addWine, updateWine, addSite, addMovement } = useFirebase();

  // Find all existing wine cards matching this reference
  const matchingWines = React.useMemo(() => {
    return wines.filter(w => isSameWineReference(w, referenceWine));
  }, [wines, referenceWine]);

  // Initial total bottles across all sites
  const initialTotalBottles: number = React.useMemo(() => {
    return matchingWines.reduce((sum: number, w: Wine) => sum + (w.quantity || 0), 0);
  }, [matchingWines]);

  // State mapping siteId -> bottle quantity
  const [siteQuantities, setSiteQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    sites.forEach(s => {
      const existing = matchingWines.find(w => w.siteId === s.id);
      map[s.id] = existing ? existing.quantity : 0;
    });
    return map;
  });

  // State mapping siteId -> casier / rang (bin)
  const [siteBins, setSiteBins] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    sites.forEach(s => {
      const existing = matchingWines.find(w => w.siteId === s.id);
      map[s.id] = existing?.bin || '';
    });
    return map;
  });

  // State for adding a new site inline
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [isCreatingSite, setIsCreatingSite] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Computed dispatched total
  const currentDispatchedTotal: number = (Object.values(siteQuantities) as number[]).reduce((acc: number, qty: number) => acc + (qty || 0), 0);

  // Sync state if new sites are created
  React.useEffect(() => {
    setSiteQuantities(prev => {
      const updated = { ...prev };
      sites.forEach(s => {
        if (updated[s.id] === undefined) {
          const existing = matchingWines.find(w => w.siteId === s.id);
          updated[s.id] = existing ? existing.quantity : 0;
        }
      });
      return updated;
    });

    setSiteBins(prev => {
      const updated = { ...prev };
      sites.forEach(s => {
        if (updated[s.id] === undefined) {
          const existing = matchingWines.find(w => w.siteId === s.id);
          updated[s.id] = existing?.bin || '';
        }
      });
      return updated;
    });
  }, [sites, matchingWines]);

  const handleBinChange = (siteId: string, val: string) => {
    setSiteBins(prev => ({
      ...prev,
      [siteId]: val
    }));
  };

  const handleQuantityChange = (siteId: string, value: number) => {
    const validQty = Math.max(0, isNaN(value) ? 0 : value);
    setSiteQuantities(prev => ({
      ...prev,
      [siteId]: validQty
    }));
  };

  const handleAdjustQuantity = (siteId: string, delta: number) => {
    setSiteQuantities(prev => {
      const current = prev[siteId] || 0;
      return {
        ...prev,
        [siteId]: Math.max(0, current + delta)
      };
    });
  };

  const handleCreateSiteInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    setIsCreatingSite(true);
    setErrorMsg(null);

    try {
      const createdSiteId = await addSite(newSiteName.trim(), newSiteDesc.trim() || undefined);
      setSiteQuantities(prev => ({
        ...prev,
        [createdSiteId]: 0
      }));
      setNewSiteName('');
      setNewSiteDesc('');
      setShowAddSiteForm(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur lors de la création du site.");
    } finally {
      setIsCreatingSite(false);
    }
  };

  const handleSaveDispatch = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Loop over each site and update or create wine records
      for (const site of sites) {
        const targetQty = siteQuantities[site.id] || 0;
        const targetBin = (siteBins[site.id] || '').trim();
        const existingWine = matchingWines.find(w => w.siteId === site.id);

        if (existingWine) {
          const updates: Partial<Wine> = {};
          if (existingWine.quantity !== targetQty) updates.quantity = targetQty;
          if (targetBin !== (existingWine.bin || '')) updates.bin = targetBin;

          if (Object.keys(updates).length > 0) {
            await updateWine(existingWine.id, updates, 'stock');
            if (updates.quantity !== undefined) {
              const diff = targetQty - existingWine.quantity;
              await addMovement({
                wineId: existingWine.id,
                wineName: `${existingWine.name} (${existingWine.vintage})`,
                type: 'transfer',
                quantity: Math.abs(diff),
                reason: 'transfert',
                notes: `Ventilation de stock multi-sites (${diff > 0 ? '+' : ''}${diff} bt sur ${site.name.split(' - ')[0]}).`,
                toSiteId: site.id
              });
            }
          }
        } else if (targetQty > 0) {
          // Clone wine card on target site with new target quantity and bin/casier, keeping all metadata
          const newWineId = await addWine({
            name: referenceWine.name,
            domain: referenceWine.domain,
            vintage: referenceWine.vintage,
            color: referenceWine.color,
            region: referenceWine.region,
            subRegion: referenceWine.subRegion,
            country: referenceWine.country,
            appellation: referenceWine.appellation,
            cuvee: referenceWine.cuvee,
            format: referenceWine.format,
            quantity: targetQty,
            alertThreshold: referenceWine.alertThreshold || 3,
            siteId: site.id,
            bin: targetBin || undefined,
            priceBuyHt: referenceWine.priceBuyHt,
            shippingCost: referenceWine.shippingCost,
            priceBuy: referenceWine.priceBuy,
            priceSell: referenceWine.priceSell,
            technicalSheet: referenceWine.technicalSheet,
            notes: referenceWine.notes ? `${referenceWine.notes}\n(Ventilation initiale le ${new Date().toLocaleDateString('fr-FR')})` : undefined
          });

          await addMovement({
            wineId: newWineId,
            wineName: `${referenceWine.name} (${referenceWine.vintage})`,
            type: 'transfer',
            quantity: targetQty,
            reason: 'transfert',
            notes: `Affectation initiale de ${targetQty} bt sur ${site.name.split(' - ')[0]} (Casier: ${targetBin || 'N/C'}) via ventilation multi-sites.`,
            toSiteId: site.id
          });
        }
      }

      setSuccessMsg("Ventilation des stocks enregistrée avec succès !");
      setTimeout(() => {
        if (onCompleted) onCompleted();
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Erreur lors du dispatching", err);
      setErrorMsg("Erreur lors de la sauvegarde de la ventilation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto text-slate-800">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden my-auto animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 text-red-400 font-mono text-[10px] uppercase font-bold tracking-wider">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Répartition & Transfert Multi-sites
            </div>
            <h2 className="text-base sm:text-lg font-bold font-sans mt-0.5 text-white">
              {referenceWine.name}
            </h2>
            <p className="text-xs text-slate-400 font-serif italic">
              {referenceWine.domain} ({referenceWine.vintage}) &bull; Stock global initial : <strong className="text-amber-300 font-mono">{initialTotalBottles} bt</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Realtime Dispatched Indicator */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400 shrink-0" />
              <span>Total dispatché sur les sites :</span>
            </div>
            <div className="flex items-center gap-2 font-bold">
              <span className={`text-base px-2.5 py-0.5 rounded-lg ${
                currentDispatchedTotal === initialTotalBottles
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : currentDispatchedTotal > initialTotalBottles
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-blue-950 text-blue-400 border border-blue-800'
              }`}>
                {currentDispatchedTotal} / {initialTotalBottles} bt
              </span>
            </div>
          </div>

          {currentDispatchedTotal !== initialTotalBottles && (
            <div className={`p-2.5 rounded-xl text-[11px] font-mono flex items-center gap-2 border ${
              currentDispatchedTotal > initialTotalBottles
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {currentDispatchedTotal > initialTotalBottles ? (
                <span>
                  Le stock total augmenté de <strong>+{currentDispatchedTotal - initialTotalBottles} bouteilles</strong> sera appliqué automatiquement.
                </span>
              ) : (
                <span>
                  <strong>{initialTotalBottles - currentDispatchedTotal} bouteille(s)</strong> restante(s) non réparties.
                </span>
              )}
            </div>
          )}

          {/* List of Sites with Touch Counter Controls */}
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
              <span>Répartition par site ({sites.length} sites disponibles)</span>
              <button
                type="button"
                onClick={() => setShowAddSiteForm(!showAddSiteForm)}
                className="text-red-600 hover:text-red-700 text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer underline"
              >
                <Plus className="w-3 h-3" />
                Créer un nouveau site
              </button>
            </div>

            {/* Inline Add Site Form */}
            {showAddSiteForm && (
              <form onSubmit={handleCreateSiteInline} className="p-3 bg-red-50/60 border border-red-200 rounded-xl space-y-2.5 animate-fade-in">
                <div className="text-xs font-bold text-red-800 font-mono uppercase">Nouveau site de stockage</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom du site (ex: Site 7 - Réserve)"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 focus:outline-none focus:border-red-500 font-sans"
                  />
                  <input
                    type="text"
                    placeholder="Description (facultatif)"
                    value={newSiteDesc}
                    onChange={(e) => setNewSiteDesc(e.target.value)}
                    className="h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 focus:outline-none focus:border-red-500 font-sans"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSiteForm(false)}
                    className="px-3 h-8 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSite}
                    className="px-4 h-8 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    {isCreatingSite ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Ajouter le site
                  </button>
                </div>
              </form>
            )}

            {/* Sites List */}
            <div className="space-y-2">
              {sites.map(site => {
                const siteQty = siteQuantities[site.id] || 0;
                const existingCard = matchingWines.find(w => w.siteId === site.id);

                return (
                  <div
                    key={site.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
                      siteQty > 0
                        ? 'bg-slate-50 border-slate-300 shadow-2xs'
                        : 'bg-white border-slate-200/80 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-3.5 h-3.5 shrink-0 ${siteQty > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                          <span className="text-xs font-bold text-slate-900 font-sans truncate">{site.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block pl-5">
                          {existingCard ? `Rang enregistré: ${existingCard.bin || 'N/C'}` : 'Non présent sur ce site'}
                        </span>
                      </div>

                      {/* Touch Counter Controls (min 44px height for mobile/iPad touch accuracy) */}
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(site.id, -5)}
                          disabled={siteQty < 5}
                          className="h-10 px-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 text-slate-700 font-mono font-bold text-xs rounded-lg cursor-pointer select-none"
                          title="-5 bouteilles"
                        >
                          -5
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(site.id, -1)}
                          disabled={siteQty === 0}
                          className="w-10 h-10 bg-slate-200 hover:bg-slate-300 active:scale-95 disabled:opacity-30 text-slate-800 font-mono font-black text-sm rounded-lg flex items-center justify-center cursor-pointer select-none"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={siteQty}
                          onChange={(e) => handleQuantityChange(site.id, parseInt(e.target.value) || 0)}
                          className="w-14 h-10 bg-white border-2 border-slate-300 focus:border-red-600 rounded-lg text-center font-mono font-black text-sm text-slate-900 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(site.id, 1)}
                          className="w-10 h-10 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono font-black text-sm rounded-lg flex items-center justify-center cursor-pointer select-none shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(site.id, 5)}
                          className="h-10 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono font-bold text-xs rounded-lg cursor-pointer select-none"
                          title="+5 bouteilles"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    {/* Casier / Rang input field */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                      <label className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1 shrink-0">
                        <span>Casier / Emplacement :</span>
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Rang 3, Casier 12..."
                        value={siteBins[site.id] || ''}
                        onChange={(e) => handleBinChange(site.id, e.target.value)}
                        className="h-8 bg-white border border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-lg px-2.5 text-xs font-mono font-semibold text-slate-900 uppercase w-full max-w-[210px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-11 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs font-sans cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSaveDispatch}
            disabled={isSubmitting}
            className="px-6 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs font-sans cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Valider la répartition des stocks
          </button>
        </div>

      </div>
    </div>
  );
};
