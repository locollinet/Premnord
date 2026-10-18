import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Site } from '../types';
import { Plus, Edit2, Trash2, Home, Check, ShieldAlert, X, RefreshCw, Database } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const SiteManagement: React.FC = () => {
  const { sites, wines, addSite, updateSite, deleteSite, seedDefaultSites } = useFirebase();

  // Local component states
  const [subTab, setSubTab] = useState<'list' | 'import'>('list');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Stats calculation
  const getSiteStats = (siteId: string) => {
    const siteWines = wines.filter(w => w.siteId === siteId);
    const totalRefs = siteWines.length;
    const totalBottles = siteWines.reduce((acc, w) => acc + (w.quantity || 0), 0);
    return { totalRefs, totalBottles };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) return;

    try {
      await addSite(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      setShowAddForm(false);
      setSuccessMsg("Le site de stockage a été créé avec succès.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMsg("Échec de la création du site. Veuillez vérifier vos droits.");
    }
  };

  const handleEditInit = (site: Site) => {
    setEditingSiteId(site.id);
    setName(site.name);
    setDescription(site.description || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleUpdate = async (siteId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) return;

    try {
      await updateSite(siteId, name.trim(), description.trim() || undefined);
      setEditingSiteId(null);
      setName('');
      setDescription('');
      setSuccessMsg("Le site de stockage a été mis à jour.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMsg("Échec de la mise à jour.");
    }
  };

  const handleDelete = async (siteId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const stats = getSiteStats(siteId);
    if (stats.totalBottles > 0 || stats.totalRefs > 0) {
      setErrorMsg("Impossible de supprimer ce site : il contient encore des bouteilles de vin.");
      return;
    }

    if (!window.confirm("Êtes-vous certain de vouloir supprimer ce site de stockage ?")) {
      return;
    }

    try {
      await deleteSite(siteId);
      setSuccessMsg("Le site de stockage a été supprimé.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de la suppression.");
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm("Attention : cela va re-créer les 7 sites de stockage par défaut (Site 1 à 7). Vos sites personnalisés existants sans stock seront conservés. Continuer ?")) {
      return;
    }

    setIsResetting(true);
    setErrorMsg(null);
    try {
      await seedDefaultSites();
      setSuccessMsg(`Les ${sites.length || 6} sites de stockage par défaut ont été re-générés !`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
      setErrorMsg("Erreur lors de la réinitialisation.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">Sites de Stockage (Caves)</h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">Configuration des {sites.length} sites de stockage de l'établissement Premnord.</p>
        </div>
        
        {subTab === 'list' && (
          <div className="flex gap-2">
            <button
              onClick={handleResetToDefault}
              disabled={isResetting}
              className="h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 rounded-xl flex items-center gap-1.5 font-semibold text-xs cursor-pointer select-none transition-colors"
              title="Recréer les sites 1 à 6 de l'oncle"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Réinitialiser les {sites.length} sites</span>
            </button>

            {!showAddForm && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingSiteId(null);
                  setName('');
                  setDescription('');
                }}
                className="h-10 bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm select-none"
              >
                <Plus className="w-4 h-4" />
                Nouveau Site
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto scrollbar-none pb-px">
        <button
          onClick={() => setSubTab('list')}
          className={`pb-3 px-4 font-bold text-xs font-mono uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'list'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Les {sites.length} Zones actives
        </button>
        <button
          onClick={() => setSubTab('import')}
          className={`pb-3 px-4 font-bold text-xs font-mono uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'import'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Importer de l'Excel / CSV
        </button>
      </div>

      {/* Conditional Content Rendering */}
      {subTab === 'import' ? (
        <CsvImporter onImportComplete={() => setSubTab('list')} />
      ) : (
        <div className="space-y-6">
          {/* Messages */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2 items-center">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex gap-2 items-center shadow-sm">
              <Check className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Site Creation Form */}
          {showAddForm && (
            <form onSubmit={handleCreate} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-md space-y-4 animate-fade-in text-slate-800">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest font-mono">Ajouter un site de stockage</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    Nom du site / Zone de stockage *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Site 6 - Spiritueux Lounge"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    Description ou consigne
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Température constante 14°C, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 rounded-xl font-semibold text-xs font-sans cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="h-10 bg-slate-900 hover:bg-slate-800 text-white px-5 rounded-xl font-bold text-xs font-sans cursor-pointer shadow-sm"
                >
                  Créer le site
                </button>
              </div>
            </form>
          )}

          {/* Sites list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sites.map((site) => {
              const stats = getSiteStats(site.id);
              const isEditing = editingSiteId === site.id;

              // Site digits badge
              const siteDigit = site.name.match(/\d/)?.[0] || 'X';

              return (
                <div 
                  key={site.id} 
                  className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  {isEditing ? (
                    // Editing state
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">Nom du site</label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">Description</label>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingSiteId(null)}
                          className="h-8 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(site.id)}
                          className="h-8 bg-red-600 hover:bg-red-700 text-white px-4 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Regular view
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 shrink-0 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-600 font-mono font-black text-sm">
                              {siteDigit}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 font-sans truncate" title={site.name}>{site.name}</h3>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">ID: {site.id}</span>
                            </div>
                          </div>
                          
                          {/* Controls */}
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleEditInit(site)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-amber-600 border border-slate-200/60 transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(site.id)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-red-600 border border-slate-200/60 transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed min-h-[2rem] italic font-serif">
                          {site.description ? `"${site.description}"` : 'Aucune consigne spécifique.'}
                        </p>
                      </div>

                      {/* Site Capacity / Stats */}
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-[10px] font-mono text-slate-500 bg-slate-50 rounded-xl p-2">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Références</p>
                          <strong className="text-slate-800 text-xs font-bold">{stats.totalRefs}</strong>
                        </div>
                        <div className="border-l border-slate-200">
                          <p className="text-[9px] text-slate-400 uppercase">Bouteilles</p>
                          <strong className="text-slate-800 text-xs font-bold">{stats.totalBottles}</strong>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {sites.length === 0 && (
              <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 py-12 text-center text-slate-400 font-mono text-xs p-4 rounded-2xl">
                Aucun site de stockage configuré. Cliquez sur "Nouveau Site" ou "Réinitialiser" ci-dessus pour démarrer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
