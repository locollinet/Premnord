import React, { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Movement, Wine, isSameWineReference, normalizeWineString } from '../types';
import {
  RotateCcw,
  RotateCw,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  CheckSquare,
  Square,
  Trash2,
  History
} from 'lucide-react';

interface UndoMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'undo' | 'redo';
}

const REASON_LABELS: Record<string, string> = {
  vente: '🍷 Vente',
  offert: '🎁 Offert',
  casse: '💔 Casse',
  bouchon: '🍾 Bouchonné',
  livraison: '📦 Livraison',
  correction: '⚖️ Correction',
  transfert: '🔄 Transfert',
  autre: '📝 Autre'
};

export const UndoMovementsModal: React.FC<UndoMovementsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'undo'
}) => {
  const {
    movements,
    undoneMovements,
    wines,
    sites,
    undoMovements,
    redoMovements,
    clearUndoneMovements
  } = useFirebase();

  const [activeTab, setActiveTab] = useState<'undo' | 'redo'>(initialTab);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [presetCount, setPresetCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const recentMovements = useMemo(() => {
    return [...movements]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
  }, [movements]);

  // Reset default selection when opening or switching tabs
  useEffect(() => {
    if (!isOpen) return;
    setFeedbackMessage(null);
    if (activeTab === 'undo') {
      const count = Math.min(presetCount, recentMovements.length);
      setSelectedIds(recentMovements.slice(0, count).map(m => m.id));
    } else {
      const count = Math.min(1, undoneMovements.length);
      setSelectedIds(undoneMovements.slice(0, count).map(m => m.id));
    }
  }, [isOpen, activeTab, recentMovements.length, undoneMovements.length]);

  if (!isOpen) return null;

  const selectLastX = (count: number) => {
    setPresetCount(count);
    const list = activeTab === 'undo' ? recentMovements : undoneMovements;
    setSelectedIds(list.slice(0, count).map(m => m.id));
  };

  const toggleMovementId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getSiteName = (siteId?: string) => {
    if (!siteId) return 'Cave';
    const found = sites.find(s => s.id === siteId);
    return found ? found.name : siteId;
  };

  const findWineForSite = (mov: Movement, siteId?: string): Wine | undefined => {
    if (!siteId) return wines.find(w => w.id === mov.wineId);
    const direct = wines.find(w => w.id === mov.wineId && w.siteId === siteId);
    if (direct) return direct;
    const base = wines.find(w => w.id === mov.wineId);
    if (base) {
      const sibling = wines.find(w => w.siteId === siteId && isSameWineReference(w, base));
      if (sibling) return sibling;
    }
    return wines.find(
      w =>
        w.siteId === siteId &&
        normalizeWineString(w.name) === normalizeWineString(mov.wineName) &&
        normalizeWineString(w.domain) === normalizeWineString(mov.domain) &&
        normalizeWineString(w.vintage) === normalizeWineString(mov.vintage)
    );
  };

  const activeList = activeTab === 'undo' ? recentMovements : undoneMovements;
  const selectedMovements = activeList.filter(m => selectedIds.includes(m.id));

  // Compute cumulative stock preview per wine/site
  const stockImpactPreview = useMemo(() => {
    const map = new Map<
      string,
      {
        wineId: string;
        wineName: string;
        domain: string;
        vintage: string;
        siteName: string;
        currentStock: number;
        delta: number;
        newStock: number;
      }
    >();

    const applyDelta = (wine: Wine | undefined, mov: Movement, siteId: string | undefined, delta: number) => {
      const key = wine ? wine.id : `${mov.wineId}_${siteId || 'default'}`;
      const existing = map.get(key);
      const currentStock = wine ? wine.quantity : 0;
      const prevDelta = existing ? existing.delta : 0;
      const nextDelta = prevDelta + delta;
      map.set(key, {
        wineId: key,
        wineName: wine?.name || mov.wineName || 'Vin',
        domain: wine?.domain || mov.domain || '',
        vintage: wine?.vintage || mov.vintage || '',
        siteName: getSiteName(wine?.siteId || siteId),
        currentStock,
        delta: nextDelta,
        newStock: Math.max(0, currentStock + nextDelta)
      });
    };

    const sign = activeTab === 'undo' ? 1 : -1; // Undo reverses movement; Redo re-applies movement

    selectedMovements.forEach(mov => {
      const qty = Math.abs(mov.quantity || 0);
      if (!qty) return;

      if (mov.type === 'out') {
        const w = findWineForSite(mov, mov.fromSiteId) || wines.find(x => x.id === mov.wineId);
        applyDelta(w, mov, mov.fromSiteId, sign * qty);
      } else if (mov.type === 'in') {
        const w = findWineForSite(mov, mov.toSiteId) || wines.find(x => x.id === mov.wineId);
        applyDelta(w, mov, mov.toSiteId, -sign * qty);
      } else if (mov.type === 'transfer') {
        const wFrom = findWineForSite(mov, mov.fromSiteId) || wines.find(x => x.id === mov.wineId);
        const wTo = findWineForSite(mov, mov.toSiteId);
        applyDelta(wFrom, mov, mov.fromSiteId, sign * qty);
        applyDelta(wTo, mov, mov.toSiteId, -sign * qty);
      } else if (mov.type === 'correction') {
        if (mov.fromSiteId && !mov.toSiteId) {
          const w = findWineForSite(mov, mov.fromSiteId) || wines.find(x => x.id === mov.wineId);
          applyDelta(w, mov, mov.fromSiteId, sign * qty);
        } else {
          const w = findWineForSite(mov, mov.toSiteId) || wines.find(x => x.id === mov.wineId);
          applyDelta(w, mov, mov.toSiteId, -sign * qty);
        }
      }
    });

    return Array.from(map.values());
  }, [selectedMovements, wines, sites, activeTab]);

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      if (activeTab === 'undo') {
        const count = await undoMovements(selectedIds);
        setFeedbackMessage(
          `${count} opération${count > 1 ? 's' : ''} annulée${count > 1 ? 's' : ''} avec succès. Vous pouvez les rétablir à tout moment dans l'onglet "Rétablir".`
        );
        setSelectedIds([]);
      } else {
        const count = await redoMovements(selectedIds);
        setFeedbackMessage(
          `${count} opération${count > 1 ? 's' : ''} rétablie${count > 1 ? 's' : ''} dans le stock et l'historique.`
        );
        setSelectedIds([]);
      }
    } catch (err: any) {
      setFeedbackMessage(`Erreur : ${err?.message || 'Impossible de traiter cette opération.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Aujourd'hui à ${timeStr}`;
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${timeStr}`;
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">
                Annuler ou Rétablir les mouvements récents
              </h2>
              <p className="text-xs text-stone-300">
                Choisissez combien d'opérations antérieures annuler, vérifiez l'impact exact sur vos stocks et rétablissez en 1 clic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-full hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs : Annuler vs Rétablir */}
        <div className="px-6 pt-4 pb-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-stone-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('undo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'undo'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Annuler des opérations ({recentMovements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('redo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'redo'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <RotateCw className="w-4 h-4 text-emerald-600" />
              Rétablir / Redo
              {undoneMovements.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-600 text-white font-bold">
                  {undoneMovements.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick X selector */}
          {activeList.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-stone-500 mr-1">
                {activeTab === 'undo' ? 'Sélection rapide :' : 'Rétablir :'}
              </span>
              {[1, 2, 3, 5, 10].map(n => {
                if (n > activeList.length && n !== 1) return null;
                const isSelectedPreset =
                  selectedIds.length === Math.min(n, activeList.length) &&
                  activeList
                    .slice(0, Math.min(n, activeList.length))
                    .every(m => selectedIds.includes(m.id));
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => selectLastX(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      isSelectedPreset
                        ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                    }`}
                  >
                    {n === 1 ? 'Dernière (1)' : `${n} dernières`}
                  </button>
                );
              })}
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800"
                >
                  Tout décocher
                </button>
              )}
            </div>
          )}
        </div>

        {/* Feedback banner */}
        {feedbackMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-sm font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            {activeTab === 'undo' && undoneMovements.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('redo')}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 shrink-0 flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Voir / Rétablir
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. Impact Summary Card (Comprendre ce qu'on va annuler / rétablir) */}
          {stockImpactPreview.length > 0 && (
            <div
              className={`p-4 rounded-2xl border-2 ${
                activeTab === 'undo'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-emerald-50/70 border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  {activeTab === 'undo'
                    ? `Ce qui va se passer si vous annulez ces ${selectedMovements.length} opération${selectedMovements.length > 1 ? 's' : ''} :`
                    : `Ce qui va se passer si vous rétablissez ces ${selectedMovements.length} opération${selectedMovements.length > 1 ? 's' : ''} :`}
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                  {stockImpactPreview.length} référence{stockImpactPreview.length > 1 ? 's' : ''} impactée{stockImpactPreview.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stockImpactPreview.map(item => (
                  <div
                    key={item.wineId}
                    className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">
                        {item.wineName}{' '}
                        {item.vintage && (
                          <span className="text-stone-500 font-normal">({item.vintage})</span>
                        )}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {item.domain ? `${item.domain} • ` : ''}
                        <span className="font-medium text-stone-700">{item.siteName}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold">
                        {item.currentStock} bt
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          item.delta > 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.delta < 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {item.newStock} bt ({item.delta > 0 ? `+${item.delta}` : item.delta})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. List of movements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {activeTab === 'undo'
                  ? 'Historique des dernières opérations enregistrées (cochez celles à annuler)'
                  : 'Opérations récemment annulées (cochez celles à rétablir)'}
              </h3>
              {activeTab === 'redo' && undoneMovements.length > 0 && (
                <button
                  type="button"
                  onClick={clearUndoneMovements}
                  className="text-xs text-stone-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vider la liste Rétablir
                </button>
              )}
            </div>

            {activeList.length === 0 ? (
              <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <p className="text-stone-500 font-medium text-sm">
                  {activeTab === 'undo'
                    ? 'Aucun mouvement récent dans l’historique.'
                    : 'Aucune opération annulée en attente de rétablissement.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeList.map((mov, index) => {
                  const isChecked = selectedIds.includes(mov.id);
                  const isOut = mov.type === 'out' || (mov.type === 'correction' && !!mov.fromSiteId && !mov.toSiteId);
                  const isTransfer = mov.type === 'transfer';
                  const reasonText = mov.reason ? REASON_LABELS[mov.reason] || mov.reason : isTransfer ? '🔄 Transfert' : '';

                  return (
                    <div
                      key={mov.id}
                      onClick={() => toggleMovementId(mov.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isChecked
                          ? activeTab === 'undo'
                            ? 'bg-amber-50/50 border-amber-400 shadow-xs'
                            : 'bg-emerald-50/50 border-emerald-400 shadow-xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 text-stone-700">
                          {isChecked ? (
                            <CheckSquare
                              className={`w-5 h-5 ${
                                activeTab === 'undo' ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            />
                          ) : (
                            <Square className="w-5 h-5 text-stone-300" />
                          )}
                        </div>
                        <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-500 text-xs font-bold flex items-center justify-center shrink-0">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm">
                              {mov.wineName}
                            </span>
                            {mov.vintage && (
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-xs font-semibold">
                                {mov.vintage}
                              </span>
                            )}
                            {reasonText && (
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-800 rounded-md text-xs font-bold">
                                {reasonText}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 flex-wrap">
                            {mov.domain && <span className="font-medium text-stone-600">{mov.domain}</span>}
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-stone-400" />
                              {isTransfer
                                ? `${getSiteName(mov.fromSiteId)} ➔ ${getSiteName(mov.toSiteId)}`
                                : getSiteName(mov.fromSiteId || mov.toSiteId)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {formatTimestamp(mov.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-xl text-xs font-bold ${
                              isTransfer
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isOut
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isTransfer
                              ? `Transfert ${mov.quantity} bt`
                              : isOut
                              ? `Sortie -${mov.quantity} bt`
                              : `Entrée +${mov.quantity} bt`}
                          </span>
                          {isChecked && (
                            <p className="text-[11px] font-bold text-stone-600 mt-1">
                              {activeTab === 'undo'
                                ? isTransfer
                                  ? '➔ Remet sur site départ'
                                  : isOut
                                  ? `➔ Remet +${mov.quantity} bt en stock`
                                  : `➔ Retire -${mov.quantity} bt du stock`
                                : '➔ Rétablit ce mouvement'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm hover:bg-stone-100 transition-colors"
          >
            Fermer
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0 || submitting}
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-40 ${
              activeTab === 'undo'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {activeTab === 'undo' ? (
              <>
                <RotateCcw className="w-4 h-4" />
                {submitting
                  ? 'Annulation en cours...'
                  : `Annuler ${selectedIds.length} opération${selectedIds.length > 1 ? 's' : ''} et restaurer le stock`}
              </>
            ) : (
              <>
                <RotateCw className="w-4 h-4" />
                {submitting
                  ? 'Rétablissement...'
                  : `Rétablir ${selectedIds.length} opération${selectedIds.length > 1 ? 's' : ''}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
