import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, MovementType, MovementReason, isSameWineReference } from '../types';
import { matchesWineSearch, getWineSearchRelevanceScore } from '../lib/stringUtils';
import { X, Save, ArrowDownLeft, ArrowUpRight, RefreshCw, AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { WineFormModal } from './WineFormModal';

interface MovementFormModalProps {
  preselectedWine?: Wine;
  onClose: () => void;
  onAlertTriggered?: (wineName: string, finalQty: number) => void;
}

export const MovementFormModal: React.FC<MovementFormModalProps> = ({ preselectedWine, onClose, onAlertTriggered }) => {
  const { wines, sites, addMovement, updateWine, addWine } = useFirebase();

  // Form states
  const [selectedWineId, setSelectedWineId] = useState('');
  const [type, setType] = useState<MovementType>('out');
  const [quantity, setQuantity] = useState(1);
  const [fromSiteId, setFromSiteId] = useState('');
  const [toSiteId, setToSiteId] = useState('');
  const [targetBin, setTargetBin] = useState('');
  const [reason, setReason] = useState<MovementReason>('vente');
  const [notes, setNotes] = useState('');
  const [wineFilterTerm, setWineFilterTerm] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreatingWine, setIsCreatingWine] = useState(false);

  const filteredWinesForSelection = React.useMemo(() => {
    if (!wineFilterTerm.trim()) return wines;
    
    return wines
      .filter(w => matchesWineSearch(w, wineFilterTerm))
      .sort((a, b) => {
        const scoreB = getWineSearchRelevanceScore(b, wineFilterTerm);
        const scoreA = getWineSearchRelevanceScore(a, wineFilterTerm);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.quantity || 0) - (a.quantity || 0);
      });
  }, [wines, wineFilterTerm]);

  const wine = preselectedWine || wines.find(w => w.id === selectedWineId);

  useEffect(() => {
    if (preselectedWine) {
      setSelectedWineId(preselectedWine.id);
      setFromSiteId(preselectedWine.siteId);
    } else if (wines.length > 0) {
      setSelectedWineId(wines[0].id);
      setFromSiteId(wines[0].siteId);
    }
  }, [preselectedWine, wines]);

  // Adjust defaults based on movement type
  useEffect(() => {
    if (type === 'in') {
      setReason('livraison');
    } else if (type === 'out') {
      setReason('vente');
    } else if (type === 'transfer') {
      setReason('transfert');
      if (wine) {
        setFromSiteId(wine.siteId);
        // Default target is any site other than the wine's current site
        const otherSite = sites.find(s => s.id !== wine.siteId);
        if (otherSite) setToSiteId(otherSite.id);
      }
    } else if (type === 'correction') {
      setReason('correction');
    }
  }, [type, wine, sites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedWineId || !wine) {
      setFormError("Veuillez sélectionner un vin.");
      return;
    }

    if (quantity <= 0) {
      setFormError("La quantité doit être supérieure à zéro.");
      return;
    }

    // Safety checks for exits
    if (type === 'out' && wine.quantity - quantity < 0) {
      setFormError(`Stock insuffisant. Il ne reste que ${wine.quantity} bouteille(s) de ce vin.`);
      return;
    }

    if (type === 'transfer') {
      if (!fromSiteId || !toSiteId) {
        setFormError("Veuillez renseigner les sites d'origine et de destination.");
        return;
      }
      if (fromSiteId === toSiteId) {
        setFormError("Le site de destination doit être différent du site d'origine.");
        return;
      }
      if (wine.quantity - quantity < 0) {
        setFormError(`Stock insuffisant en origine pour effectuer ce transfert. Max disponible: ${wine.quantity} bt.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (type === 'in') {
        const finalQty = wine.quantity + quantity;
        
        // Log movement
        await addMovement({
          wineId: wine.id,
          wineName: `${wine.name} (${wine.vintage})`,
          type: 'in',
          quantity,
          reason,
          notes: notes.trim() || undefined,
          toSiteId: wine.siteId
        });

        // Update stock
        await updateWine(wine.id, { quantity: finalQty }, 'stock');

      } else if (type === 'out') {
        const finalQty = Math.max(0, wine.quantity - quantity);
        
        // Log movement
        await addMovement({
          wineId: wine.id,
          wineName: `${wine.name} (${wine.vintage})`,
          type: 'out',
          quantity,
          reason,
          notes: notes.trim() || undefined,
          fromSiteId: wine.siteId
        });

        // Update stock
        await updateWine(wine.id, { quantity: finalQty }, 'stock');

        // Check if alert needs to trigger (exactly 1 or exactly 0)
        if (onAlertTriggered && (finalQty === 1 || finalQty === 0)) {
          onAlertTriggered(`${wine.name} (${wine.vintage})`, finalQty);
        }

      } else if (type === 'transfer') {
        // SMART TRANSFER SYSTEM
        // 1. Subtract quantity from source wine
        const sourceFinalQty = wine.quantity - quantity;
        await updateWine(wine.id, { quantity: sourceFinalQty }, 'stock');

        // Check if source wine alert is triggered
        if (onAlertTriggered && (sourceFinalQty === 1 || sourceFinalQty === 0)) {
          onAlertTriggered(`${wine.name} (${wine.vintage}) [Origine]`, sourceFinalQty);
        }

        // 2. Find or create matching wine at target site B
        const targetMatch = wines.find(w => 
          w.siteId === toSiteId && isSameWineReference(w, wine)
        );

        let targetWineId = '';

        if (targetMatch) {
          // Add to existing wine stock and update bin if provided
          targetWineId = targetMatch.id;
          const updates: Partial<Wine> = { quantity: targetMatch.quantity + quantity };
          if (targetBin.trim()) updates.bin = targetBin.trim();
          await updateWine(targetMatch.id, updates, 'stock');
        } else {
          // Clone wine sheet on target site with transferred quantity, keeping all sommelier & accounting data
          targetWineId = await addWine({
            name: wine.name,
            domain: wine.domain,
            vintage: wine.vintage,
            color: wine.color,
            region: wine.region,
            subRegion: wine.subRegion,
            country: wine.country,
            appellation: wine.appellation,
            cuvee: wine.cuvee,
            format: wine.format,
            quantity: quantity,
            alertThreshold: wine.alertThreshold || 3,
            siteId: toSiteId,
            bin: targetBin.trim() || undefined,
            priceBuyHt: wine.priceBuyHt,
            shippingCost: wine.shippingCost,
            priceBuy: wine.priceBuy,
            priceSell: wine.priceSell,
            technicalSheet: wine.technicalSheet,
            notes: wine.notes ? `${wine.notes}\n(Transféré depuis ${sites.find(s => s.id === fromSiteId)?.name || 'autre site'})` : undefined
          });
        }

        // 3. Log movement
        await addMovement({
          wineId: wine.id,
          wineName: `${wine.name} (${wine.vintage})`,
          type: 'transfer',
          quantity,
          reason: 'transfert',
          notes: notes.trim() ? notes.trim() : `Transfert interne de ${quantity} bouteilles.`,
          fromSiteId,
          toSiteId
        });

      } else if (type === 'correction') {
        // Treat correction as setting or adjusting stock
        // For simple adjustments, we add if positive, or subtract if negative.
        // Let's assume correction here behaves like an addition by default.
        // If notes mention manual inventory audit, we update accordingly.
        const finalQty = wine.quantity + quantity;
        await updateWine(wine.id, { quantity: finalQty }, 'stock');

        await addMovement({
          wineId: wine.id,
          wineName: `${wine.name} (${wine.vintage})`,
          type: 'correction',
          quantity,
          reason: 'correction',
          notes: notes.trim() || undefined,
          toSiteId: wine.siteId
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
      setFormError("Erreur lors de l'enregistrement du mouvement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto text-slate-800">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col my-8 animate-fade-in">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-sans">
              Enregistrer un mouvement de stock
            </h2>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Mises à jour instantanées de la cave et de la carte.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2 items-center">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-600" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* 1. Wine Selection */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
              Sélection du produit *
            </label>
            {preselectedWine ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm font-bold text-slate-900 truncate">{preselectedWine.name}</p>
                <p className="text-xs text-slate-500 truncate font-mono">
                  {preselectedWine.domain} &bull; Emplacement: {preselectedWine.bin ? preselectedWine.bin : 'N/C'} &bull; Stock : <span className="font-bold text-slate-800">{preselectedWine.quantity} bt</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer la liste (ex: Domaine, Cuvée, Année, Emplacement)..."
                    value={wineFilterTerm}
                    onChange={(e) => setWineFilterTerm(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg pl-9 pr-3 text-xs text-slate-800 outline-none font-sans"
                  />
                </div>

                <div className="flex gap-2 w-full">
                  <select
                    value={selectedWineId}
                    onChange={(e) => setSelectedWineId(e.target.value)}
                    required
                    className="w-full min-w-0 flex-1 h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-800 text-xs rounded-xl px-2.5 outline-none cursor-pointer font-medium"
                  >
                    <option value="">Sélectionner une référence...</option>
                    {filteredWinesForSelection.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.domain}) • Stock: {w.quantity} bt {w.bin ? `[${w.bin}]` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCreatingWine(true)}
                    className="h-11 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-sans font-bold cursor-pointer transition-colors flex items-center shrink-0 whitespace-nowrap shadow-xs"
                    title="Créer une nouvelle référence de vin"
                  >
                    + Nouvelle Réf
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-sans">
                  Si le vin n'existe pas encore en cave, créez sa fiche produit d'abord en cliquant sur le bouton.
                </p>
              </div>
            )}
          </div>

          {/* 2. Movement Type Buttons */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5 font-mono uppercase tracking-wider font-bold">
              Type de flux *
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setType('out')}
                className={`h-12 rounded-xl font-mono text-[10px] uppercase font-bold border transition-all cursor-pointer flex flex-col justify-center items-center gap-0.5 ${
                  type === 'out'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>Sortie</span>
              </button>

              <button
                type="button"
                onClick={() => setType('in')}
                className={`h-12 rounded-xl font-mono text-[10px] uppercase font-bold border transition-all cursor-pointer flex flex-col justify-center items-center gap-0.5 ${
                  type === 'in'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>Entrée</span>
              </button>

              <button
                type="button"
                onClick={() => setType('transfer')}
                className={`h-12 rounded-xl font-mono text-[10px] uppercase font-bold border transition-all cursor-pointer flex flex-col justify-center items-center gap-0.5 ${
                  type === 'transfer'
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Transfert</span>
              </button>

              <button
                type="button"
                onClick={() => setType('correction')}
                className={`h-12 rounded-xl font-mono text-[10px] uppercase font-bold border transition-all cursor-pointer flex flex-col justify-center items-center gap-0.5 ${
                  type === 'correction'
                    ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Ajuster</span>
              </button>
            </div>
          </div>

          {/* 3. Site transfers locations */}
          {type === 'transfer' && (
            <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5">
              <p className="text-[10px] font-mono font-bold text-blue-800 uppercase">Paramètres du transfert de stock</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-bold">
                    Origine
                  </label>
                  <div className="h-10 px-3 bg-white border border-slate-200 rounded-lg flex items-center text-xs font-mono font-bold text-slate-700 truncate">
                    {sites.find(s => s.id === fromSiteId)?.name.split(' - ')[0] || 'Inconnu'}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-bold">
                    Cible
                  </label>
                  <select
                    value={toSiteId}
                    onChange={(e) => setToSiteId(e.target.value)}
                    required
                    className="w-full h-10 bg-white border border-slate-200 text-xs rounded-lg px-2 outline-none cursor-pointer font-mono font-bold text-slate-700"
                  >
                    <option value="">Sélectionner...</option>
                    {sites.filter(s => s.id !== fromSiteId).map((s) => (
                      <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-bold">
                  Casier / Emplacement sur le site cible (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: Rang 2, Casier 14..."
                  value={targetBin}
                  onChange={(e) => setTargetBin(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-200 text-xs rounded-lg px-3 outline-none font-mono font-bold text-slate-900 uppercase"
                />
              </div>

              <p className="text-[10px] text-slate-500 leading-normal">
                💡 Si la fiche produit n'existe pas encore sur le site cible, elle sera automatiquement dupliquée pour maintenir une traçabilité propre par cave.
              </p>
            </div>
          )}

          {/* 4. Quantity and Reason */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                Quantité (Bouteilles) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl px-4 text-slate-950 text-sm outline-none transition-all font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                Motif réglementaire *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as MovementReason)}
                required
                className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer"
              >
                {type === 'in' && (
                  <>
                    <option value="livraison">Achat / Livraison fournisseur</option>
                    <option value="correction">Correction positive d'inventaire</option>
                    <option value="autre">Autre entrée de stock</option>
                  </>
                )}
                {type === 'out' && (
                  <>
                    <option value="vente">Service client / Vente à la table</option>
                    <option value="casse">Casse / Perte en cave / Bouchonné</option>
                    <option value="correction">Correction négative d'inventaire</option>
                    <option value="autre">Autre sortie de stock</option>
                  </>
                )}
                {type === 'transfer' && (
                  <option value="transfert">Transfert inter-celliers standard</option>
                )}
                {type === 'correction' && (
                  <>
                    <option value="correction">Audit d'inventaire manuel</option>
                    <option value="livraison">Livraison tardive régularisée</option>
                    <option value="casse">Casse constatée après coup</option>
                    <option value="autre">Autre ajustement manuel</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
              Notes de suivi / Justification
            </label>
            <input
              type="text"
              placeholder="Ex: Facture #FR-2900, Table 104, Client mécontent..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 border border-slate-200 hover:bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center gap-2 font-semibold transition-colors cursor-pointer text-xs font-sans"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 text-white px-5 rounded-xl flex items-center gap-2 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le mouvement'}
            </button>
          </div>
        </form>

      </div>

      {isCreatingWine && (
        <WineFormModal
          onClose={() => setIsCreatingWine(false)}
          onCreated={(newId) => {
            setSelectedWineId(newId);
            setIsCreatingWine(false);
          }}
        />
      )}
    </div>
  );
};
