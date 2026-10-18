import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Layers, 
  Globe, 
  Tag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Wine as WineIcon, 
  Sparkles, 
  ArrowRight, 
  X,
  RefreshCw,
  FolderPlus,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { WineRegion } from '../types';
import { DEFAULT_REGION_GROUPS } from '../lib/regions';

export const RegionManagement: React.FC = () => {
  const { 
    regions, 
    regionGroups, 
    wines, 
    addRegion, 
    updateRegion, 
    deleteRegion, 
    resetRegionsToDefault 
  } = useFirebase();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<WineRegion | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<WineRegion | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isOrphanSyncOpen, setIsOrphanSyncOpen] = useState(false);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [] as string[],
    newSubRegionInput: '',
    description: '',
    propagateRename: true
  });

  // Delete modal reassign state
  const [reassignTarget, setReassignTarget] = useState<string>('');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // Live wine bottle count mapped to each region
  const wineCountByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    wines.forEach(w => {
      const reg = (w.region || '').trim();
      if (reg) {
        const key = reg.toLowerCase();
        const qty = w.quantity || 0;
        map[reg] = (map[reg] || 0) + qty;
        if (key !== reg) {
          map[key] = (map[key] || 0) + qty;
        }
      }
    });
    return map;
  }, [wines]);

  // Detect orphan regions in wines that are not in the master repository
  const orphanRegionsInCellar = useMemo(() => {
    const knownNames = new Set(regions.map(r => r.name.toLowerCase().trim()));
    const orphansMap = new Map<string, { bottles: number; refs: number }>();
    
    wines.forEach(w => {
      const r = (w.region || '').trim();
      if (r && !knownNames.has(r.toLowerCase())) {
        const current = orphansMap.get(r) || { bottles: 0, refs: 0 };
        current.bottles += (w.quantity || 0);
        current.refs += 1;
        orphansMap.set(r, current);
      }
    });

    return Array.from(orphansMap.entries()).map(([name, data]) => ({ 
      name, 
      count: data.bottles, 
      refs: data.refs 
    }));
  }, [wines, regions]);

  // Filtered regions list
  const filteredRegions = useMemo(() => {
    return regions.filter(r => {
      const matchesSearch = 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.subRegions.some(sr => sr.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGroup = selectedGroup === 'all' || r.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [regions, searchTerm, selectedGroup]);

  // Statistics
  const stats = useMemo(() => {
    const totalSubRegions = regions.reduce((acc, r) => acc + (r.subRegions?.length || 0), 0);
    const totalCellarBottles = wines.reduce((acc, w) => acc + (w.quantity || 0), 0);
    const totalLinkedBottles = wines.reduce((acc, w) => {
      const hasKnownRegion = regions.some(r => r.name.toLowerCase().trim() === (w.region || '').toLowerCase().trim());
      return hasKnownRegion ? acc + (w.quantity || 0) : acc;
    }, 0);

    return {
      totalRegions: regions.length,
      totalSubRegions,
      totalLinkedBottles,
      totalCellarBottles,
      orphanCount: orphanRegionsInCellar.length
    };
  }, [regions, wines, orphanRegionsInCellar]);

  // Open Edit Modal
  const handleOpenEdit = (region: WineRegion) => {
    setEditingRegion(region);
    setFormData({
      name: region.name,
      group: region.group || 'Vignobles de France',
      country: region.country || 'France',
      subRegions: [...(region.subRegions || [])],
      newSubRegionInput: '',
      description: region.description || '',
      propagateRename: true
    });
  };

  // Open Add Modal
  const handleOpenAdd = (presetName = '', presetGroup = 'Vignobles de France') => {
    setEditingRegion(null);
    setFormData({
      name: presetName,
      group: presetGroup,
      country: presetGroup.includes('France') ? 'France' : 'International',
      subRegions: [],
      newSubRegionInput: '',
      description: '',
      propagateRename: false
    });
    setIsAddModalOpen(true);
  };

  // Sub-region chip management inside form
  const handleAddSubRegion = () => {
    const val = formData.newSubRegionInput.trim();
    if (val && !formData.subRegions.includes(val)) {
      setFormData(prev => ({
        ...prev,
        subRegions: [...prev.subRegions, val],
        newSubRegionInput: ''
      }));
    }
  };

  const handleRemoveSubRegion = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      subRegions: prev.subRegions.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Save Add or Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('error', 'Le nom de la région est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRegion) {
        // Edit existing
        const res = await updateRegion(
          editingRegion.id, 
          {
            name: formData.name.trim(),
            group: formData.group.trim(),
            country: formData.country.trim(),
            subRegions: formData.subRegions,
            description: formData.description.trim()
          },
          {
            propagateRenameToWines: formData.propagateRename,
            oldName: editingRegion.name
          }
        );

        if (res.winesUpdatedCount > 0) {
          showNotification('success', `Région "${formData.name}" mise à jour et propagée à ${res.winesUpdatedCount} bouteille(s) en cave !`);
        } else {
          showNotification('success', `Région "${formData.name}" mise à jour avec succès.`);
        }
        setEditingRegion(null);
      } else {
        // Create new
        await addRegion({
          name: formData.name.trim(),
          group: formData.group.trim(),
          country: formData.country.trim(),
          subRegions: formData.subRegions,
          description: formData.description.trim()
        });
        showNotification('success', `Nouvelle région "${formData.name}" ajoutée au référentiel.`);
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Region
  const handleConfirmDelete = async () => {
    if (!deletingRegion) return;
    setIsSubmitting(true);
    try {
      const res = await deleteRegion(deletingRegion.id, {
        reassignWinesToRegion: reassignTarget ? reassignTarget : undefined
      });

      if (res.winesReassignedCount > 0) {
        showNotification('success', `Région "${deletingRegion.name}" supprimée et ${res.winesReassignedCount} bouteille(s) réassignée(s) vers "${reassignTarget}".`);
      } else {
        showNotification('success', `Région "${deletingRegion.name}" retirée du référentiel.`);
      }
      setDeletingRegion(null);
      setReassignTarget('');
    } catch (err: any) {
      showNotification('error', err.message || 'Impossible de supprimer la région.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset to default sommelier catalog
  const handleResetDefaults = async () => {
    setIsSubmitting(true);
    try {
      await resetRegionsToDefault();
      showNotification('success', 'Référentiel réinitialisé avec les appellations et terroirs d\'origine (Auvergne incluse).');
      setIsResetConfirmOpen(false);
    } catch (err: any) {
      showNotification('error', 'Erreur lors de la réinitialisation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch import orphan cellar regions into master
  const handleImportAllOrphans = async () => {
    setIsSubmitting(true);
    try {
      let imported = 0;
      for (const orphan of orphanRegionsInCellar) {
        try {
          await addRegion({
            name: orphan.name,
            group: 'Vignobles de France',
            country: 'France',
            subRegions: [],
            description: 'Importé automatiquement depuis l\'inventaire cave'
          });
          imported++;
        } catch (e) {
          // ignore duplicate
        }
      }
      showNotification('success', `${imported} région(s) orpheline(s) intégrée(s) au référentiel avec succès !`);
      setIsOrphanSyncOpen(false);
    } catch (e) {
      showNotification('error', 'Erreur lors de l\'intégration des régions orphelines.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div 
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-3 ${
            notification.type === 'success' 
              ? 'bg-emerald-900 border-emerald-700 text-emerald-100' 
              : 'bg-rose-900 border-rose-700 text-rose-100'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner & MDM Urbanisation Notice */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-50 text-red-700 rounded-xl">
                <MapPin className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight">
                  Référentiel des Régions & Terroirs
                </h2>
                <p className="text-xs text-slate-500">
                  Urbanisation des données viticoles : gérez, ajoutez et personnalisez les régions et sous-régions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {orphanRegionsInCellar.length > 0 && (
              <button
                type="button"
                onClick={() => setIsOrphanSyncOpen(true)}
                className="h-9 px-3 bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{orphanRegionsInCellar.length} région(s) orpheline(s) détectée(s)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurer la liste d'origine des régions"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser par défaut</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une région</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Régions actives</span>
            <span className="text-xl font-bold font-mono text-slate-900">{stats.totalRegions}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Sous-Régions & Terroirs</span>
            <span className="text-xl font-bold font-mono text-slate-900">{stats.totalSubRegions}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Bouteilles indexées</span>
            <span className="text-xl font-bold font-mono text-slate-900">{stats.totalLinkedBottles}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Région Auvergne</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-800">
                {regions.some(r => r.name.toLowerCase() === 'auvergne') ? 'Configurée & Active' : 'Non configurée'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher une région, un terroir, une appellation ou un pays..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 focus:border-red-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Macro-Group Pill selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedGroup === 'all'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tous les groupes ({regions.length})
          </button>
          {regionGroups.map(grp => {
            const count = regions.filter(r => r.group === grp).length;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={`h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedGroup === grp
                    ? 'bg-red-600 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {grp} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Regions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRegions.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">Aucune région trouvée pour cette recherche.</p>
            <p className="text-xs text-slate-400 mt-1">Vous pouvez ajouter une nouvelle région en cliquant sur le bouton ci-dessus.</p>
          </div>
        ) : (
          filteredRegions.map((reg) => {
            const bottleCount = wineCountByRegion[reg.name] || 0;
            const isAuvergne = reg.name.toLowerCase() === 'auvergne';

            return (
              <div 
                key={reg.id}
                className={`bg-white border rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                  isAuvergne 
                    ? 'border-red-300 ring-1 ring-red-400/30 bg-gradient-to-b from-red-50/20 to-white' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top row: Name, Badge, Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                          {reg.name}
                        </h3>
                        {isAuvergne && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold rounded-md uppercase tracking-wider font-mono">
                            Demandé
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-500">
                          {reg.country}
                        </span>
                        <span className="text-[11px] text-slate-300">•</span>
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">
                          {reg.group}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(reg)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Modifier la région et ses sous-régions"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRegion(reg)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer cette région"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sub-regions list */}
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block mb-1.5">
                      Sous-Régions & Terroirs ({reg.subRegions?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {reg.subRegions && reg.subRegions.length > 0 ? (
                        reg.subRegions.map((sr, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200/60"
                          >
                            {sr}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Aucun terroir spécifique renseigné
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer info: Wine bottles linked */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <WineIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">
                      {bottleCount} {bottleCount > 1 ? 'bouteilles en cave' : 'bouteille en cave'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(reg)}
                    className="text-[11px] text-red-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Gérer</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT REGION */}
      {(isAddModalOpen || editingRegion) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-red-50 text-red-700 rounded-xl">
                  {editingRegion ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRegion ? `Modifier la région "${editingRegion.name}"` : 'Ajouter une nouvelle région'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paramétrez le référentiel pour la saisie des vins, les filtres et les fiches sommeliers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setEditingRegion(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Region Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600 mb-1">
                    Nom de la région *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Auvergne, Alsace, Napa Valley..."
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl text-sm text-slate-900 outline-none"
                  />
                </div>

                {/* Macro-Group */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600 mb-1">
                    Groupe d'appartenance
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData(prev => ({ ...prev, group: e.target.value }))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl text-sm text-slate-800 outline-none cursor-pointer"
                  >
                    {regionGroups.map(grp => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                    <option value="Autre / Région personnalisée">+ Nouveau groupe personnalisé...</option>
                  </select>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600 mb-1">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Ex: France, Italie, Espagne..."
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl text-sm text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Sub-regions manager */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600 mb-1.5">
                  Sous-Régions, Terroirs & Appellations ({formData.subRegions.length})
                </label>
                <div className="flex gap-2 mb-2.5">
                  <input
                    type="text"
                    value={formData.newSubRegionInput}
                    onChange={(e) => setFormData(prev => ({ ...prev, newSubRegionInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubRegion();
                      }
                    }}
                    placeholder="Ex: Saint-Pourçain, Côtes d'Auvergne, Boudes..."
                    className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl text-xs text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubRegion}
                    className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Ajouter terroir
                  </button>
                </div>

                {/* Chips list */}
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[48px]">
                  {formData.subRegions.length === 0 ? (
                    <span className="text-xs text-slate-400 italic p-1">
                      Aucun terroir ajouté. Tapez un nom et appuyez sur Entrée pour ajouter.
                    </span>
                  ) : (
                    formData.subRegions.map((sr, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg shadow-2xs font-mono"
                      >
                        <span>{sr}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubRegion(idx)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Urbanisation / Propagation to existing wines */}
              {editingRegion && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="propagate-toggle"
                      checked={formData.propagateRename}
                      onChange={(e) => setFormData(prev => ({ ...prev, propagateRename: e.target.checked }))}
                      className="w-4 h-4 text-red-600 rounded cursor-pointer"
                    />
                    <label htmlFor="propagate-toggle" className="text-xs font-bold text-amber-950 cursor-pointer">
                      Urbaniser & propager le renommage dans la cave
                    </label>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed pl-6">
                    Si le nom est modifié, les <strong>{wineCountByRegion[editingRegion.name] || 0} bouteille(s)</strong> actuellement enregistrées sous "{editingRegion.name}" seront automatiquement mises à jour vers "{formData.name || 'le nouveau nom'}" en base de données.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingRegion(null); }}
                  className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>{editingRegion ? 'Enregistrer les modifications' : 'Créer la région'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE REGION */}
      {deletingRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Supprimer la région "{deletingRegion.name}" ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cette région ne sera plus suggérée lors de l'ajout ou la modification des vins.
                </p>
              </div>
            </div>

            {(wineCountByRegion[deletingRegion.name] || 0) > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <p className="text-xs font-bold text-rose-900">
                  Attention : {wineCountByRegion[deletingRegion.name]} bouteille(s) portent actuellement cette région.
                </p>
                <label className="block text-[11px] text-rose-800 font-medium">
                  Réassigner ces bouteilles vers une autre région :
                </label>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  className="w-full h-9 bg-white border border-rose-300 text-slate-800 text-xs rounded-lg px-2 outline-none cursor-pointer"
                >
                  <option value="">Ne pas réassigner (garder le texte brut)</option>
                  {regions.filter(r => r.id !== deletingRegion.id).map(r => (
                    <option key={r.id} value={r.name}>{r.name} ({r.group})</option>
                  ))}
                  <option value="Autre">Autre</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRegion(null)}
                className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET DEFAULTS */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Réinitialiser le référentiel des régions ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cette action restaure le catalogue sommelier standard (France, Auvergne, Europe, Nouveau Monde) et ses terroirs recommandés. Vos bouteilles en cave ne seront pas supprimées.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isSubmitting}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Réinitialisation...' : 'Oui, restaurer par défaut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ORPHAN REGIONS INTEGRATION */}
      {isOrphanSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 mt-0.5">
                <FolderPlus className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Régions orphelines détectées dans votre cave
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Les bouteilles suivantes ont des régions saisies manuellement qui ne figurent pas encore dans le référentiel officiel :
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {orphanRegionsInCellar.map(({ name, count, refs }) => (
                <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 last:border-0">
                  <span className="font-bold text-slate-800">{name}</span>
                  <span className="text-slate-500 font-mono">
                    {count} bt{refs > 0 ? ` (${refs} réf.)` : ''}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500">
              En cliquant sur "Intégrer", ces régions seront automatiquement enregistrées dans le référentiel afin d'être disponibles pour tous les sommeliers et les futurs imports.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOrphanSyncOpen(false)}
                className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleImportAllOrphans}
                disabled={isSubmitting}
                className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Intégration...' : 'Intégrer au référentiel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
