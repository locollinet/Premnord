import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, isSameWineReference, getWineReferenceKey, getCanonicalDomain, isDPRWine } from '../types';
import { matchesWineSearch } from '../lib/stringUtils';
import { classifyWineRegionAndSubRegion } from '../lib/wineGrouping';
import { exportLiveStockToExcel } from '../lib/accountingExportXlsx';
import { MultiSiteDispatchModal } from './MultiSiteDispatchModal';
import { ZeroStockManagementModal } from './ZeroStockManagementModal';
import { Search, Plus, Filter, ArrowUpDown, ChevronRight, SlidersHorizontal, AlertTriangle, Check, RefreshCw, ArrowRightLeft, FileSpreadsheet, X, Package, Download, Sparkles, Trash2, EyeOff } from 'lucide-react';

interface WineListProps {
  onSelectWine: (wineId: string) => void;
  onAddWine: () => void;
  onNavigateToAccounting?: () => void;
}

const COLOR_BADGES: Record<WineColor, { label: string; badge: string }> = {
  rouge: { label: 'Rouge', badge: 'bg-red-50 text-red-700 border-red-200' },
  blanc: { label: 'Blanc', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { label: 'Rosé', badge: 'bg-pink-50 text-pink-700 border-pink-200' },
  bulle: { label: 'Bulle / Champ.', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  orange: { label: 'Orange', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  spiritueux: { label: 'Spiritueux', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  cidre_biere: { label: 'Bière / Cidre', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  soft: { label: 'Softs / Boissons', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  autre: { label: 'Autre', badge: 'bg-slate-50 text-slate-700 border-slate-200' }
};

export const WineList: React.FC<WineListProps> = ({ onSelectWine, onAddWine, onNavigateToAccounting }) => {
  const { wines, sites, updateWine, addMovement } = useFirebase();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'normal' | 'alert' | 'empty'>('all');
  const [excludeZeroStock, setExcludeZeroStock] = useState<boolean>(false);
  const [volumeFilterType, setVolumeFilterType] = useState<'all' | 'greater_than' | 'less_than'>('all');
  const [volumeFilterValue, setVolumeFilterValue] = useState<string>('12');
  const [priceFilterType, setPriceFilterType] = useState<'all' | 'less_than' | 'greater_than'>('all');
  const [priceFilterValue, setPriceFilterValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'domain' | 'quantity' | 'price' | 'vintage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Local search context: locale vs global search toggle
  const [searchContext, setSearchContext] = useState<'local' | 'global'>('global');

  // Pagination / progressive rendering to keep UI fluid and interactive
  const [visibleCount, setVisibleCount] = useState(30);

  React.useEffect(() => {
    setVisibleCount(30);
  }, [searchTerm, selectedColor, selectedSite, selectedRegion, selectedDomain, stockFilter, excludeZeroStock, volumeFilterType, volumeFilterValue, priceFilterType, priceFilterValue, sortBy, sortOrder, searchContext]);

  // Precompute lookup map of total stock per reference key across all sites
  const totalStockByRefKey = React.useMemo(() => {
    const map = new Map<string, number>();
    wines.forEach(w => {
      const key = getWineReferenceKey(w);
      map.set(key, (map.get(key) || 0) + (w.quantity || 0));
    });
    return map;
  }, [wines]);

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

  // Quick transition states for animation feedback
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [dispatchWine, setDispatchWine] = useState<Wine | null>(null);
  const [isZeroStockModalOpen, setIsZeroStockModalOpen] = useState(false);

  // Live count of zero stock references in cellar
  const zeroStockCount = React.useMemo(() => wines.filter(w => (w.quantity || 0) === 0).length, [wines]);

  // Quick stock change handler (+1 / -1 bottle)
  const handleQuickStockChange = async (e: React.MouseEvent, wine: Wine, change: number) => {
    e.stopPropagation(); // Prevent opening details modal
    if (wine.quantity + change < 0) return;
    
    setAdjustingId(`${wine.id}_${change > 0 ? 'inc' : 'dec'}`);
    const newQuantity = wine.quantity + change;
    
    try {
      // 1. Update the wine quantity
      await updateWine(wine.id, { quantity: newQuantity }, 'stock');
      
      // 2. Add stock audit movement
      await addMovement({
        wineId: wine.id,
        wineName: `${wine.name} (${wine.vintage})`,
        type: change > 0 ? 'in' : 'out',
        quantity: Math.abs(change),
        reason: change > 0 ? 'livraison' : 'vente',
        notes: `Ajustement rapide de stock (+/- 1) depuis le catalogue de cave.`,
        fromSiteId: change < 0 ? wine.siteId : undefined,
        toSiteId: change > 0 ? wine.siteId : undefined
      });
    } catch (e) {
      console.error("Error during quick stock change:", e);
    } finally {
      setTimeout(() => setAdjustingId(null), 300);
    }
  };

  // Helper to extract canonical region & sub-region for a wine
  const getWineRegionAndSub = React.useCallback((wine: Wine) => {
    let reg = (wine.region || '').trim();
    let sub = (wine.subRegion || '').trim();

    if (!reg) {
      const classified = classifyWineRegionAndSubRegion(wine);
      reg = classified.region || 'Autres Régions';
      if (!sub && classified.subRegion && classified.subRegion !== classified.region) {
        sub = classified.subRegion;
      }
    } else if (!sub) {
      // Wine has region, check if classification can provide sub-region from appellation
      const classified = classifyWineRegionAndSubRegion(wine);
      if (classified.subRegion && classified.subRegion !== classified.region) {
        let candidate = classified.subRegion;
        if (candidate.toLowerCase().startsWith(`${reg.toLowerCase()} –`)) {
          candidate = candidate.slice(reg.length + 2).trim();
        } else if (candidate.toLowerCase().startsWith(`${reg.toLowerCase()} -`)) {
          candidate = candidate.slice(reg.length + 2).trim();
        }
        sub = candidate;
      }
    }

    if (sub) {
      if (sub.toLowerCase().startsWith(`${reg.toLowerCase()} –`)) {
        sub = sub.slice(reg.length + 2).trim();
      } else if (sub.toLowerCase().startsWith(`${reg.toLowerCase()} -`)) {
        sub = sub.slice(reg.length + 2).trim();
      }
    }

    return { region: reg, subRegion: sub || null };
  }, []);

  // Check if a wine matches the selected region/sub-region filter
  const wineMatchesRegionFilter = React.useCallback((wine: Wine, regionFilter: string): boolean => {
    if (regionFilter === 'all') return true;

    const { region, subRegion } = getWineRegionAndSub(wine);

    if (regionFilter.startsWith('reg:')) {
      const target = regionFilter.slice(4).trim().toLowerCase();
      return region.toLowerCase() === target || (wine.region || '').trim().toLowerCase() === target;
    }

    if (regionFilter.startsWith('sub:')) {
      const [targetReg, targetSub] = regionFilter.slice(4).split(':::');
      const regLower = targetReg.trim().toLowerCase();
      const subLower = targetSub.trim().toLowerCase();

      const regMatches = region.toLowerCase() === regLower || (wine.region || '').trim().toLowerCase() === regLower;
      const subMatches = 
        (subRegion && subRegion.toLowerCase() === subLower) ||
        ((wine.subRegion || '').trim().toLowerCase() === subLower) ||
        ((wine.subRegion || '').trim().toLowerCase().includes(subLower));

      return regMatches && Boolean(subMatches);
    }

    return (wine.region || '').trim().toLowerCase() === regionFilter.trim().toLowerCase();
  }, [getWineRegionAndSub]);

  // Build dynamic region and sub-region hierarchy from the wine database
  const regionHierarchy = React.useMemo(() => {
    const regionMap = new Map<string, { totalWines: number; subRegionsMap: Map<string, number> }>();

    wines.forEach((wine) => {
      const { region, subRegion } = getWineRegionAndSub(wine);
      if (!region) return;

      if (!regionMap.has(region)) {
        regionMap.set(region, { totalWines: 0, subRegionsMap: new Map() });
      }

      const regEntry = regionMap.get(region)!;
      regEntry.totalWines += 1;

      if (subRegion) {
        regEntry.subRegionsMap.set(subRegion, (regEntry.subRegionsMap.get(subRegion) || 0) + 1);
      }
    });

    const result = Array.from(regionMap.entries()).map(([regionName, entry]) => {
      const subRegions = Array.from(entry.subRegionsMap.entries()).map(([subName, count]) => ({
        name: subName,
        count
      })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

      return {
        region: regionName,
        totalWines: entry.totalWines,
        subRegions
      };
    });

    return result.sort((a, b) => a.region.localeCompare(b.region, 'fr', { sensitivity: 'base' }));
  }, [wines, getWineRegionAndSub]);

  // Dynamically extract domains available within the selected region/sub-region
  const availableDomains = React.useMemo(() => {
    // Wines that match the selected region/sub-region filter
    const winesInRegion = wines.filter((wine) => wineMatchesRegionFilter(wine, selectedRegion));

    const domainCounts = new Map<string, number>();
    let hasDPR = false;

    winesInRegion.forEach((wine) => {
      const rawDomain = (wine.domain || '').trim();
      if (!rawDomain) return;

      const norm = rawDomain.toLowerCase();
      if (norm.includes('prieuré-roch') || norm.includes('prieure-roch') || norm === 'dpr') {
        hasDPR = true;
      }

      domainCounts.set(rawDomain, (domainCounts.get(rawDomain) || 0) + 1);
    });

    const list = Array.from(domainCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { list, hasDPR, totalCount: domainCounts.size };
  }, [wines, selectedRegion, wineMatchesRegionFilter]);

  // Handle region filter change and auto-adjust domain filter if needed
  const handleRegionChange = (newRegion: string) => {
    setSelectedRegion(newRegion);

    if (selectedDomain !== 'all') {
      const winesInNewRegion = wines.filter((w) => wineMatchesRegionFilter(w, newRegion));
      const isValidInNewRegion = winesInNewRegion.some((w) => {
        if (selectedDomain === 'prieure_roch') {
          const norm = (w.domain || '').toLowerCase();
          return norm.includes('prieuré-roch') || norm.includes('prieure-roch') || norm === 'dpr';
        }
        return (w.domain || '').trim().toLowerCase() === selectedDomain.toLowerCase() ||
               getCanonicalDomain(w.domain).toLowerCase() === selectedDomain.toLowerCase();
      });

      if (!isValidInNewRegion) {
        setSelectedDomain('all');
      }
    }
  };

  // Filtering Logic
  const filteredWines = React.useMemo(() => {
    return wines.filter((wine) => {
      const site = sites.find(s => s.id === wine.siteId);
      const siteNum = site?.name?.match(/\d/)?.[0] || '1';
      const computedLocation = wine.bin ? `${siteNum}${wine.bin.replace(/[\s\-_]/g, '').toUpperCase()}` : '';

      const matchesSearch = matchesWineSearch(wine, searchTerm, computedLocation);
        
      const matchesColor = selectedColor === 'all' || wine.color === selectedColor;
      
      // Smart search context: local (only selected site) vs global (all sites)
      let matchesSite = true;
      if (searchContext === 'local' && selectedSite !== 'all') {
        matchesSite = wine.siteId === selectedSite;
      } else if (selectedSite !== 'all') {
        matchesSite = wine.siteId === selectedSite;
      }
      
      let matchesStock = true;
      if (stockFilter === 'alert') {
        matchesStock = wine.quantity <= wine.alertThreshold && wine.quantity > 0;
      } else if (stockFilter === 'empty') {
        matchesStock = wine.quantity === 0;
      } else if (stockFilter === 'normal') {
        matchesStock = wine.quantity > wine.alertThreshold;
      }

      // Exclude references with 0 stock when active
      let matchesExcludeZero = true;
      if (excludeZeroStock) {
        const refStock = (selectedSite === 'all' && searchContext === 'global')
          ? (totalStockByRefKey.get(getWineReferenceKey(wine)) ?? wine.quantity)
          : wine.quantity;
        matchesExcludeZero = refStock > 0;
      }

      // Quantity / Volume filter (detects large stock volumes)
      let matchesVolume = true;
      if (volumeFilterType !== 'all' && volumeFilterValue !== '') {
        const targetQty = parseInt(volumeFilterValue, 10);
        if (!isNaN(targetQty)) {
          // If viewing all sites, check total reference stock across sites; if specific site, check site stock
          const wineQty = selectedSite === 'all' 
            ? (totalStockByRefKey.get(getWineReferenceKey(wine)) ?? wine.quantity)
            : wine.quantity;
            
          if (volumeFilterType === 'greater_than') {
            matchesVolume = wineQty >= targetQty;
          } else if (volumeFilterType === 'less_than') {
            matchesVolume = wineQty <= targetQty;
          }
        }
      }

      let matchesPrice = true;
      if (priceFilterType !== 'all' && priceFilterValue !== '') {
        const targetPrice = parseFloat(priceFilterValue);
        if (!isNaN(targetPrice)) {
          const winePrice = wine.priceSell || 0;
          if (priceFilterType === 'less_than') {
            matchesPrice = winePrice <= targetPrice;
          } else if (priceFilterType === 'greater_than') {
            matchesPrice = winePrice >= targetPrice;
          }
        }
      }

      // Region & Sub-region filter
      const matchesRegion = wineMatchesRegionFilter(wine, selectedRegion);

      // Domain filter (scoped to region or global)
      let matchesDomain = true;
      if (selectedDomain === 'prieure_roch') {
        matchesDomain = isDPRWine(wine);
      } else if (selectedDomain !== 'all') {
        const targetDomain = selectedDomain.trim().toLowerCase();
        const wineDomain = (wine.domain || '').trim().toLowerCase();
        const canonicalDomain = getCanonicalDomain(wine.domain).toLowerCase();
        matchesDomain = wineDomain === targetDomain || canonicalDomain === targetDomain;
      }

      return matchesSearch && matchesColor && matchesSite && matchesStock && matchesExcludeZero && matchesVolume && matchesPrice && matchesRegion && matchesDomain;
    });
  }, [wines, sites, searchTerm, selectedColor, searchContext, selectedSite, selectedRegion, selectedDomain, stockFilter, excludeZeroStock, volumeFilterType, volumeFilterValue, priceFilterType, priceFilterValue, wineMatchesRegionFilter, totalStockByRefKey]);

  // Compute live synthesis metrics for the filtered selection
  const selectionStats = React.useMemo(() => {
    let totalBottles = 0;
    let totalValue = 0;
    let bottlesWithValueCount = 0;

    filteredWines.forEach((wine) => {
      totalBottles += wine.quantity;
      const buyPrice = wine.priceBuy || wine.priceBuyHt || 0;
      totalValue += buyPrice * wine.quantity;
      if (buyPrice > 0) {
        bottlesWithValueCount += wine.quantity;
      }
    });

    return {
      totalBottles,
      totalValue,
      hasMissingPrices: totalBottles > 0 && bottlesWithValueCount < totalBottles
    };
  }, [filteredWines]);

  // Active filter label for summary and banner
  const activeSelectionLabel = React.useMemo(() => {
    const parts: string[] = [];

    if (excludeZeroStock) {
      parts.push('En stock (> 0 bt)');
    }

    if (volumeFilterType !== 'all' && volumeFilterValue) {
      if (volumeFilterType === 'greater_than') {
        parts.push(`Gros volumes ≥ ${volumeFilterValue} bt`);
      } else {
        parts.push(`Stock ≤ ${volumeFilterValue} bt`);
      }
    }

    if (selectedRegion !== 'all') {
      if (selectedRegion.startsWith('reg:')) {
        parts.push(selectedRegion.slice(4));
      } else if (selectedRegion.startsWith('sub:')) {
        const [reg, sub] = selectedRegion.slice(4).split(':::');
        parts.push(`${reg} › ${sub}`);
      } else {
        parts.push(selectedRegion);
      }
    }

    if (selectedDomain !== 'all') {
      if (selectedDomain === 'prieure_roch') {
        parts.push('Domaine Prieuré-Roch');
      } else {
        parts.push(selectedDomain);
      }
    }

    if (parts.length > 0) {
      return parts.join(' • ');
    }
    return null;
  }, [selectedRegion, selectedDomain, volumeFilterType, volumeFilterValue, excludeZeroStock]);

  // Sorting Logic
  const sortedWines = React.useMemo(() => {
    return [...filteredWines].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
      } else if (sortBy === 'domain') {
        const domainA = (a.domain || '').trim();
        const domainB = (b.domain || '').trim();
        comparison = domainA.localeCompare(domainB, 'fr', { sensitivity: 'base' });
        if (comparison === 0) {
          comparison = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = (a.vintage || '').localeCompare(b.vintage || '');
          }
        }
      } else if (sortBy === 'quantity') {
        comparison = a.quantity - b.quantity;
      } else if (sortBy === 'vintage') {
        comparison = (a.vintage || '').localeCompare(b.vintage || '');
      } else if (sortBy === 'price') {
        comparison = (a.priceSell || 0) - (b.priceSell || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredWines, sortBy, sortOrder]);

  // Grouping Logic for "Fiche Référence" (Option A) - De-duplicates references and sums up stocks in multi-site view
  const groupedWines = React.useMemo(() => {
    const groupsMap = new Map<string, {
      id: string;
      referenceWine: Wine;
      allWines: Wine[];
      totalQuantity: number;
    }>();

    sortedWines.forEach(wine => {
      const key = getWineReferenceKey(wine);
      const existingGroup = groupsMap.get(key);
      if (!existingGroup) {
        groupsMap.set(key, {
          id: wine.id,
          referenceWine: wine,
          allWines: [wine],
          totalQuantity: wine.quantity
        });
      } else {
        existingGroup.allWines.push(wine);
        existingGroup.totalQuantity += wine.quantity;
        // Prioritize the wine that actually holds stock > 0
        if (existingGroup.referenceWine.quantity === 0 && wine.quantity > 0) {
          existingGroup.referenceWine = wine;
          existingGroup.id = wine.id;
        } else if (wine.quantity > existingGroup.referenceWine.quantity) {
          existingGroup.referenceWine = wine;
          existingGroup.id = wine.id;
        }
      }
    });

    const groups = Array.from(groupsMap.values());

    // Explicit post-grouping sort guarantee to ensure multi-site groups strictly follow the requested sort
    if (sortBy === 'domain') {
      groups.sort((a, b) => {
        const domA = (a.referenceWine.domain || '').trim();
        const domB = (b.referenceWine.domain || '').trim();
        let cmp = domA.localeCompare(domB, 'fr', { sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.referenceWine.name || '').localeCompare(b.referenceWine.name || '', 'fr', { sensitivity: 'base' });
          if (cmp === 0) {
            cmp = (a.referenceWine.vintage || '').localeCompare(b.referenceWine.vintage || '');
          }
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else if (sortBy === 'name') {
      groups.sort((a, b) => {
        let cmp = (a.referenceWine.name || '').localeCompare(b.referenceWine.name || '', 'fr', { sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.referenceWine.vintage || '').localeCompare(b.referenceWine.vintage || '');
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else if (sortBy === 'quantity') {
      groups.sort((a, b) => {
        const cmp = a.totalQuantity - b.totalQuantity;
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else if (sortBy === 'vintage') {
      groups.sort((a, b) => {
        const cmp = (a.referenceWine.vintage || '').localeCompare(b.referenceWine.vintage || '');
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else if (sortBy === 'price') {
      groups.sort((a, b) => {
        const cmp = (a.referenceWine.priceSell || 0) - (b.referenceWine.priceSell || 0);
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return groups;
  }, [sortedWines, sortBy, sortOrder]);

  const toggleSort = (type: 'name' | 'domain' | 'quantity' | 'price' | 'vintage') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Search and Quick Filters bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-4 text-slate-800">
        
        {/* Row 1: Search context toggle */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Périmètre de recherche :</span>
          <button
            type="button"
            onClick={() => setSearchContext('global')}
            className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
              searchContext === 'global'
                ? 'bg-red-600 border-red-700 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-150'
            }`}
          >
            Partout (Tous sites)
          </button>
          
          <button
            type="button"
            disabled={selectedSite === 'all'}
            onClick={() => setSearchContext('local')}
            className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
              selectedSite === 'all' 
                ? 'opacity-40 cursor-not-allowed' 
                : searchContext === 'local'
                  ? 'bg-red-600 border-red-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-150'
            }`}
          >
            Local ({selectedSite !== 'all' ? sites.find(s => s.id === selectedSite)?.name.split(' - ')[0] : 'Filtrer un Site'})
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-grow">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher nom, domaine, région, ou coordonnée (ex: 1D4)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl pl-11 pr-4 text-slate-900 text-sm outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Sites filter */}
            <select
              value={selectedSite}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSite(val);
                if (val === 'all') setSearchContext('global');
              }}
              className="h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold"
            >
              <option value="all">Tous les sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name.split(' - ')[0]}</option>
              ))}
            </select>

            {/* Colors filter */}
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold"
            >
              <option value="all">Toutes catégories</option>
              <option value="rouge">Vin Rouge</option>
              <option value="blanc">Vin Blanc</option>
              <option value="rose">Vin Rosé</option>
              <option value="bulle">Champagne & Bulles</option>
              <option value="orange">Vin Orange</option>
              <option value="spiritueux">Spiritueux</option>
              <option value="cidre_biere">Bières & Cidres</option>
              <option value="soft">Softs & Sans Alcool</option>
              <option value="autre">Autre</option>
            </select>

            {/* 1. Filtre Région & Sous-Région dans le même filtre */}
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className={`h-11 border text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold max-w-[210px] truncate transition-colors ${
                selectedRegion !== 'all'
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-red-500'
              }`}
              title="Filtrer par Région & Sous-Région"
            >
              <option value="all">Toutes régions / sous-régions</option>
              {regionHierarchy.map((reg) => (
                <optgroup key={reg.region} label={`${reg.region} (${reg.totalWines})`}>
                  <option value={`reg:${reg.region}`}>
                    {reg.region} (Toute la région • {reg.totalWines})
                  </option>
                  {reg.subRegions.map((sub) => (
                    <option key={`sub:${reg.region}:::${sub.name}`} value={`sub:${reg.region}:::${sub.name}`}>
                      ↳ {sub.name} ({sub.count})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* 2. Filtre Domaine (filtré au sein de la région sélectionnée) */}
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className={`h-11 border text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold max-w-[200px] truncate transition-colors ${
                selectedDomain !== 'all'
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-red-500'
              }`}
              title="Filtrer par Domaine viticole"
            >
              <option value="all">
                {selectedRegion !== 'all'
                  ? `Tous domaines de la région (${availableDomains.list.length})`
                  : `Tous les domaines (${availableDomains.list.length})`}
              </option>

              {availableDomains.hasDPR && (
                <optgroup label="Sélection Spéciale">
                  <option value="prieure_roch">⭐ Domaine Prieuré-Roch</option>
                </optgroup>
              )}

              <optgroup label={selectedRegion !== 'all' ? "Domaines de cette région" : "Domaines viticoles"}>
                {availableDomains.list.map((dom) => (
                  <option key={dom.name} value={dom.name}>
                    {dom.name} ({dom.count})
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Bouton de réinitialisation rapide des filtres région / domaine / volume / stock 0 */}
            {(selectedRegion !== 'all' || selectedDomain !== 'all' || volumeFilterType !== 'all' || excludeZeroStock) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRegion('all');
                  setSelectedDomain('all');
                  setVolumeFilterType('all');
                  setVolumeFilterValue('12');
                  setExcludeZeroStock(false);
                }}
                className="h-11 px-2.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 text-xs rounded-xl flex items-center gap-1 font-bold transition-all cursor-pointer select-none"
                title="Effacer les filtres actifs"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Effacer</span>
              </button>
            )}

            {/* Stock warnings & volumes filter */}
            <select
              value={
                volumeFilterType === 'greater_than' && ['12', '24', '48', '60'].includes(volumeFilterValue)
                  ? `vol_${volumeFilterValue}`
                  : stockFilter
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('vol_')) {
                  setStockFilter('all');
                  setVolumeFilterType('greater_than');
                  setVolumeFilterValue(val.replace('vol_', ''));
                } else {
                  setStockFilter(val as any);
                  if (val === 'empty') {
                    setExcludeZeroStock(false);
                  }
                  if (volumeFilterType === 'greater_than' && ['12', '24', '48', '60'].includes(volumeFilterValue)) {
                    setVolumeFilterType('all');
                  }
                }
              }}
              className="h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold"
            >
              <optgroup label="État du stock">
                <option value="all">Tous les stocks</option>
                <option value="normal">Stocks ok</option>
                <option value="alert">Alertes réappro (≤ seuil)</option>
                <option value="empty">Ruptures (Stock 0)</option>
              </optgroup>
              <optgroup label="Gros volumes">
                <option value="vol_12">📦 Gros volumes (≥ 12 bt)</option>
                <option value="vol_24">📦 Très gros volumes (≥ 24 bt)</option>
                <option value="vol_48">📦 Volumes massifs (≥ 48 bt)</option>
                <option value="vol_60">📦 Stock exceptionnel (≥ 60 bt)</option>
              </optgroup>
            </select>

            {/* Bouton à part pour exclure les références à stock 0 */}
            <button
              type="button"
              onClick={() => {
                const nextState = !excludeZeroStock;
                setExcludeZeroStock(nextState);
                if (nextState && stockFilter === 'empty') {
                  setStockFilter('all');
                }
              }}
              className={`h-11 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none ${
                excludeZeroStock
                  ? 'bg-slate-900 hover:bg-black text-white border-slate-900 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title={excludeZeroStock ? "Désactiver le filtre (afficher également les références à stock 0)" : "Exclure toutes les références ayant 0 bouteille en stock"}
            >
              {excludeZeroStock ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Réf. à 0 exclues</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Exclure réf. à 0</span>
                </>
              )}
            </button>

            {/* Add Wine button */}
            <button
              onClick={onAddWine}
              className="h-11 bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm select-none"
            >
              <Plus className="w-4 h-4" />
              Nouveau Vin
            </button>

            {/* Live Inventory Excel Export button */}
            <button
              onClick={() => {
                const isDPR = selectedDomain === 'prieure_roch';
                const prefix = isDPR ? 'Stock_Prieure_Roch' : 'Inventaire_Stock_Premnord';
                const label = isDPR ? 'Domaine Prieuré-Roch' : (activeSelectionLabel || 'Toute la cave');
                exportLiveStockToExcel(filteredWines, sites, prefix, label);
              }}
              className={`h-11 px-3.5 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm select-none border ${
                selectedDomain === 'prieure_roch'
                  ? 'bg-rose-900 hover:bg-rose-950 text-amber-200 border-amber-500/50'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title={selectedDomain === 'prieure_roch' ? "Télécharger l'inventaire en direct de Prieuré-Roch (.xlsx)" : "Télécharger la sélection courante en Excel (.xlsx)"}
            >
              {selectedDomain === 'prieure_roch' ? (
                <Sparkles className="w-4 h-4 text-amber-300" />
              ) : (
                <Download className="w-4 h-4 text-emerald-600" />
              )}
              <span>{selectedDomain === 'prieure_roch' ? 'Export Prieuré-Roch (.xlsx)' : 'Export Excel (.xlsx)'}</span>
            </button>

            {/* Accounting Extraction button */}
            {onNavigateToAccounting && (
              <button
                onClick={onNavigateToAccounting}
                className="h-11 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm select-none"
                title="Extraction et inventaire pour le comptable (Stock début/fin de mois, Prix d'achat, Mouvements)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                Extraction Comptable
              </button>
            )}

            {/* Zero Stock Management / Identification tool button */}
            <button
              onClick={() => setIsZeroStockModalOpen(true)}
              className="h-11 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer text-xs font-sans shadow-2xs select-none"
              title="Identifier et choisir si supprimer les références à stock 0"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Réf. Stock 0 ({zeroStockCount})</span>
            </button>
          </div>
        </div>

        {/* Secondary filters row (Filtre Volume / Bouteilles & Filtre Prix TTC) */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-150 text-xs">
          
          {/* Section 1: Filtrer par Volume / Nombre de bouteilles en stock */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 font-sans flex items-center gap-1 shrink-0">
              <Package className="w-3.5 h-3.5 text-amber-600" /> Volume en stock :
            </span>

            <select
              value={
                volumeFilterType === 'all'
                  ? 'all'
                  : volumeFilterType === 'greater_than'
                    ? ['12', '24', '36', '48', '60'].includes(volumeFilterValue)
                      ? `gte_${volumeFilterValue}`
                      : 'custom_gte'
                    : 'custom_lte'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setVolumeFilterType('all');
                } else if (val.startsWith('gte_')) {
                  setVolumeFilterType('greater_than');
                  setVolumeFilterValue(val.replace('gte_', ''));
                } else if (val === 'custom_gte') {
                  setVolumeFilterType('greater_than');
                  if (!volumeFilterValue) setVolumeFilterValue('12');
                } else if (val === 'custom_lte') {
                  setVolumeFilterType('less_than');
                  if (!volumeFilterValue) setVolumeFilterValue('6');
                }
              }}
              className="h-9 bg-white border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-lg px-2.5 outline-none cursor-pointer font-semibold"
            >
              <option value="all">Tous les volumes</option>
              <optgroup label="Gros volumes prédéfinis">
                <option value="gte_12">Gros volumes (≥ 12 bt)</option>
                <option value="gte_24">Très gros volumes (≥ 24 bt)</option>
                <option value="gte_36">Importants volumes (≥ 36 bt)</option>
                <option value="gte_48">Volumes massifs (≥ 48 bt)</option>
                <option value="gte_60">Stock exceptionnel (≥ 60 bt)</option>
              </optgroup>
              <optgroup label="Personnalisé">
                <option value="custom_gte">Au moins (≥ X bt)</option>
                <option value="custom_lte">Au plus (≤ X bt)</option>
              </optgroup>
            </select>

            {/* Custom bottle count input */}
            {volumeFilterType !== 'all' && (
              <div className="relative flex items-center">
                <input
                  type="number"
                  placeholder="Nb"
                  value={volumeFilterValue}
                  onChange={(e) => setVolumeFilterValue(e.target.value)}
                  className="w-20 h-9 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-lg pl-3 pr-7 text-slate-900 text-xs outline-none transition-all font-mono font-bold"
                  min="1"
                  step="1"
                />
                <span className="absolute right-2 text-[10px] font-mono text-slate-400">bt</span>
              </div>
            )}

            {/* Quick Clickable Preset Chips for Fast Sommelier Access */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const nextState = !excludeZeroStock;
                  setExcludeZeroStock(nextState);
                  if (nextState && stockFilter === 'empty') {
                    setStockFilter('all');
                  }
                }}
                className={`px-2 py-1 text-[11px] rounded-lg font-mono font-bold border transition-all cursor-pointer select-none ${
                  excludeZeroStock
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Exclure les références à stock 0 (afficher uniquement les vins en stock)"
              >
                {excludeZeroStock ? '✓ > 0 bt' : '> 0 bt'}
              </button>
              {[12, 24, 48, 60].map((preset) => {
                const isSelected = volumeFilterType === 'greater_than' && volumeFilterValue === String(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setVolumeFilterType('all');
                      } else {
                        setVolumeFilterType('greater_than');
                        setVolumeFilterValue(String(preset));
                      }
                    }}
                    className={`px-2 py-1 text-[11px] rounded-lg font-mono font-bold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-600 border-amber-700 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={`Filtrer les références avec au moins ${preset} bouteilles en stock`}
                  >
                    ≥ {preset} bt
                  </button>
                );
              })}
            </div>

            {volumeFilterType !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setVolumeFilterType('all');
                  setVolumeFilterValue('12');
                }}
                className="text-[10px] font-semibold text-red-600 hover:text-red-700 font-mono underline cursor-pointer select-none"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Section 2: Prix de vente TTC */}
          <div className="flex flex-wrap items-center gap-2 xl:border-l xl:border-slate-200 xl:pl-3">
            <span className="font-bold text-slate-700 font-sans flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Prix TTC (€) :
            </span>
            
            <div className="flex items-center gap-1.5">
              <select
                value={priceFilterType}
                onChange={(e) => {
                  setPriceFilterType(e.target.value as any);
                  if (e.target.value === 'all') setPriceFilterValue('');
                }}
                className="h-9 bg-white border border-slate-200 focus:border-red-500 text-slate-700 text-xs rounded-lg px-2.5 outline-none cursor-pointer font-semibold"
              >
                <option value="all">Tous les prix</option>
                <option value="less_than">Moins de (≤)</option>
                <option value="greater_than">Plus de (≥)</option>
              </select>
              
              {priceFilterType !== 'all' && (
                <div className="relative flex items-center">
                  <input
                    type="number"
                    placeholder="Montant"
                    value={priceFilterValue}
                    onChange={(e) => setPriceFilterValue(e.target.value)}
                    className="w-24 h-9 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-lg pl-3 pr-6 text-slate-900 text-xs outline-none transition-all font-mono font-bold"
                    min="0"
                    step="any"
                  />
                  <span className="absolute right-2 text-[10px] font-mono text-slate-400">€</span>
                </div>
              )}
            </div>

            {priceFilterType !== 'all' && priceFilterValue !== '' && (
              <button
                type="button"
                onClick={() => {
                  setPriceFilterType('all');
                  setPriceFilterValue('');
                }}
                className="text-[10px] font-semibold text-red-600 hover:text-red-700 font-mono underline cursor-pointer select-none"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* Sorting and Summary info */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-[10px] font-mono text-slate-500">
          <div>
            Résultats : <span className="text-slate-900 font-bold">{groupedWines.length}</span> référence{groupedWines.length > 1 ? 's' : ''} trouvée{groupedWines.length > 1 ? 's' : ''}
            {excludeZeroStock && (
              <span className="ml-1.5 text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                (Stock &gt; 0 bt uniquement)
              </span>
            )}
            {volumeFilterType !== 'all' && volumeFilterValue && (
              <span className="ml-1.5 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                ({volumeFilterType === 'greater_than' ? '≥' : '≤'} {volumeFilterValue} bt)
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-slate-400 flex items-center gap-1 font-bold">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" /> Trier par :
            </span>
            <button 
              onClick={() => toggleSort('name')}
              className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 ${sortBy === 'name' ? 'text-red-600 font-black' : ''}`}
            >
              Nom {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('domain')}
              className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 ${sortBy === 'domain' ? 'text-red-600 font-black' : ''}`}
              title="Trier par Domaine / Producteur"
            >
              Domaine {sortBy === 'domain' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('quantity')}
              className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 ${sortBy === 'quantity' ? 'text-red-600 font-black' : ''}`}
            >
              Stock {sortBy === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('vintage')}
              className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 ${sortBy === 'vintage' ? 'text-red-600 font-black' : ''}`}
            >
              Année {sortBy === 'vintage' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('price')}
              className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 ${sortBy === 'price' ? 'text-red-600 font-black' : ''}`}
            >
              Tarif {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards for Filtered Selection */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 select-none animate-fadeIn">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <span className="text-[10px] uppercase tracking-wider text-red-400 font-mono font-black">
            {activeSelectionLabel 
              ? `Aperçu de Sélection (${activeSelectionLabel})` 
              : 'Aperçu du Stock Actuel'}
          </span>
          <h3 className="text-sm font-sans font-medium text-slate-200">
            Synthèse en temps réel des bouteilles et valeurs affichées
          </h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full sm:w-auto sm:flex sm:items-center sm:gap-6 shrink-0">
          <div className="bg-slate-800/40 border border-slate-700/55 rounded-xl px-4 py-2.5 min-w-[120px] text-left">
            <span className="text-[10px] text-slate-400 font-mono block mb-1">Bouteilles</span>
            <span className="text-xl font-bold font-mono text-red-400 block leading-none">
              {selectionStats.totalBottles}
            </span>
          </div>
          
          <div className="bg-slate-800/40 border border-slate-700/55 rounded-xl px-4 py-2.5 min-w-[150px] text-left relative overflow-hidden group">
            <span className="text-[10px] text-slate-400 font-mono block mb-1">Valeur Stock (Achat)</span>
            <span className="text-xl font-bold font-mono text-amber-400 block leading-none">
              {selectionStats.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
            {selectionStats.hasMissingPrices && (
              <div className="absolute top-1 right-1" title="Certaines bouteilles n'ont pas de prix d'achat renseigné">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Prompt Banner when filtering for 0-stock wines */}
      {stockFilter === 'empty' && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-950 animate-fadeIn shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0 border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-rose-950 font-sans flex items-center gap-2">
                <span>Ruptures & Références à Stock 0</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-rose-200/70 text-rose-800 rounded-md">
                  {filteredWines.length} référence(s)
                </span>
              </h4>
              <p className="text-xs text-rose-700 font-sans max-w-2xl">
                Identifiez précisément les références épuisées, vérifiez si du stock subsiste sur un autre site ou s'il s'agit de fiches sans mouvement, et choisissez celles à supprimer ou à conserver.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsZeroStockModalOpen(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-mono font-bold shadow-sm transition-all cursor-pointer shrink-0 flex items-center gap-2 self-end sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Ouvrir l'outil de gestion &amp; suppression</span>
          </button>
        </div>
      )}

      {/* Wine Grid view */}
      {groupedWines.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center text-slate-400 font-mono text-xs">
          Aucun vin ou spiritueux ne correspond à vos filtres de recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedWines.slice(0, visibleCount).map((group) => {
            const wine = group.referenceWine;
            const isMultiSite = group.allWines.length > 1;
            const isOutOfStock = group.totalQuantity === 0;
            const isAnyAlert = group.allWines.some(w => w.quantity <= w.alertThreshold && w.quantity > 0);
            
            // Stock count styles
            let stockBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (isOutOfStock) {
              stockBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
            } else if (isAnyAlert) {
              stockBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
            }

            const colorDetails = COLOR_BADGES[wine.color] || COLOR_BADGES.autre;
            
            // If only 1 site, show its location coordinates code
            const site = sites.find(s => s.id === wine.siteId);
            const locationCode = !isMultiSite && wine.bin 
              ? wine.bin.replace(/[\s\-_]/g, '').toUpperCase() 
              : isMultiSite 
                ? 'MULTI' 
                : 'N/C';

            return (
              <div
                key={group.referenceWine.id}
                onClick={() => onSelectWine(wine.id)}
                className="bg-white border border-slate-200 hover:border-slate-350 p-4 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer transition-all duration-150 relative group"
              >
                <div>
                  {/* Top row: Coordinates location badge and color badge */}
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <span className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-0.5 rounded-lg shadow-sm">
                      {locationCode}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase border ${colorDetails.badge}`}>
                      {colorDetails.label}
                    </span>
                  </div>

                  {/* Wine Name & Domain */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors truncate">
                    {wine.name}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 truncate mb-3 italic">
                    {wine.domain} • {wine.vintage !== 'N.V.' ? wine.vintage : 'N.V.'}
                  </p>

                  {/* Location descriptions row */}
                  <div className="flex flex-wrap gap-y-1 gap-x-1.5 text-[10px] text-slate-400 mb-3 font-mono">
                    {!isMultiSite && (
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 border border-slate-200 shrink-0" title={site?.name}>
                        <span>{site?.name?.split(' - ')[0]}</span>
                        {wine.bin && <span className="opacity-75 font-normal">({wine.bin})</span>}
                      </span>
                    )}

                    {wine.region && (
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 shrink-0">
                        {wine.region}
                        {wine.subRegion && wine.subRegion !== wine.region ? ` • ${wine.subRegion}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Price Row */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500 mb-3">
                    <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <span className="text-slate-400">Vente :</span>
                      <strong className="text-slate-900">{wine.priceSell ? `${wine.priceSell.toFixed(2)} € TTC` : 'N/C'}</strong>
                    </span>
                    {wine.priceBuy !== undefined && wine.priceBuy > 0 && (
                      <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 text-slate-400">
                        <span>Achat :</span>
                        <span className="text-slate-600 font-bold">
                          {wine.priceBuy.toFixed(2)} €
                          {wine.priceBuyHt !== undefined && wine.shippingCost !== undefined && wine.shippingCost > 0 ? (
                            <span className="text-amber-800 font-medium ml-1">
                              ({wine.priceBuyHt.toFixed(2)}€ + {wine.shippingCost.toFixed(2)}€ port)
                            </span>
                          ) : wine.shippingCost !== undefined && wine.shippingCost > 0 ? (
                            <span className="text-amber-800 font-medium ml-1">
                              (dont {wine.shippingCost.toFixed(2)}€ port)
                            </span>
                          ) : null}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom line: Stock & Quick Adjustment buttons (Unified for single & multi-sites) */}
                <div className="space-y-2 pt-2.5 border-t border-slate-100 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span>Stock par site ({group.totalQuantity} bt{group.totalQuantity > 1 ? 's' : ''}) :</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDispatchWine(wine);
                      }}
                      className="text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer flex items-center gap-1 transition-colors"
                      title="Ventiler ou transférer rapidement ces bouteilles sur les différents sites"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                      Ventiler
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(() => {
                      const sitesWithStock = group.allWines.filter(w => w.quantity > 0);

                      if (sitesWithStock.length === 0) {
                        return (
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-xs">
                            <span className="text-slate-400 font-mono text-[11px] italic">
                              Aucun stock physique (0 bouteille)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDispatchWine(group.allWines[0] || wine);
                              }}
                              className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              + Entrer du stock
                            </button>
                          </div>
                        );
                      }

                      return sitesWithStock.map(siteWine => {
                        const s = sites.find(item => item.id === siteWine.siteId);
                        const sName = s ? s.name.split(' - ')[0] : 'Inconnu';
                        const sLocation = siteWine.bin ? siteWine.bin.replace(/[\s\-_]/g, '').toUpperCase() : 'N/C';
                        const siteAlert = siteWine.quantity <= siteWine.alertThreshold && siteWine.quantity > 0;
                        const siteStockColor = siteAlert 
                          ? 'bg-amber-50 text-amber-700 border-amber-150' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-150';

                        return (
                          <div key={siteWine.id} className="flex justify-between items-center bg-slate-50 border border-slate-150 p-2 rounded-xl text-xs hover:bg-slate-100/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 font-mono">
                              <span className="font-bold text-slate-800 truncate" title={s?.name}>{sName}</span>
                              <span className="text-[10px] bg-slate-900 text-white font-black px-1.5 py-0.2 rounded">{sLocation}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${siteStockColor}`}>
                                {siteWine.quantity} bt{siteWine.quantity > 1 ? 's' : ''}
                              </span>
                              
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleQuickStockChange(e, siteWine, -1)}
                                  disabled={siteWine.quantity === 0 || adjustingId !== null}
                                  className="w-7 h-7 bg-white hover:bg-rose-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-all active:scale-95 disabled:opacity-30 cursor-pointer select-none"
                                  title="Sortir 1 bouteille"
                                >
                                  {adjustingId === `${siteWine.id}_dec` ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-red-500" />
                                  ) : (
                                    '-'
                                  )}
                                </button>
                                <button
                                  onClick={(e) => handleQuickStockChange(e, siteWine, 1)}
                                  disabled={adjustingId !== null}
                                  className="w-7 h-7 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-all active:scale-95 disabled:opacity-30 cursor-pointer select-none"
                                  title="Entrer 1 bouteille"
                                >
                                  {adjustingId === `${siteWine.id}_inc` ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                                  ) : (
                                    '+'
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groupedWines.length > visibleCount && (
        <div className="flex justify-center pt-6 pb-2 print:hidden">
          <button
            onClick={() => setVisibleCount(prev => prev + 30)}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:shadow active:scale-95 select-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Afficher plus de bouteilles ({groupedWines.length - visibleCount} restantes)
          </button>
        </div>
      )}

      {/* Multi-Site Dispatch Modal */}
      {dispatchWine && (
        <MultiSiteDispatchModal
          referenceWine={dispatchWine}
          onClose={() => setDispatchWine(null)}
        />
      )}

      {/* Zero Stock Management & Identification Modal */}
      <ZeroStockManagementModal
        isOpen={isZeroStockModalOpen}
        onClose={() => setIsZeroStockModalOpen(false)}
        onSelectWine={onSelectWine}
      />
    </div>
  );
};
