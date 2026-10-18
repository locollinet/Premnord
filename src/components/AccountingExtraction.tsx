import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { 
  getAvailableMonths, 
  createCustomPeriodOption,
  calculateCellarAccounting, 
  consolidateStockRowsByReference,
  buildFilteredAccountingSummary,
  formatCurrencyFr, 
  formatCompactCurrencyFr,
  WineStockAccountingRow,
  MovementAccountingRow
} from '../lib/accountingCalculations';
import { exportAccountingToExcel, exportStockToCsv, exportDPRMonthlyExcel } from '../lib/accountingExportXlsx';
import { classifyWineRegionAndSubRegion } from '../lib/wineGrouping';
import { ZeroStockManagementModal } from './ZeroStockManagementModal';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CalendarDays, 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  Coins, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Wine as WineIcon, 
  HelpCircle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Package, 
  X, 
  Clock,
  Trash2
} from 'lucide-react';
import { WineColor, isDPRWine, getCanonicalDomain } from '../types';

interface AccountingExtractionProps {
  onSelectWine?: (wineId: string) => void;
  initialFilters?: {
    domain?: string;
    region?: string;
    site?: string;
  };
}

export const AccountingExtraction: React.FC<AccountingExtractionProps> = ({ onSelectWine, initialFilters }) => {
  const { wines, movements, sites, updateWine } = useFirebase();

  // 1. Period Selector state (Month vs Custom Date Range)
  const availableMonths = useMemo(() => getAvailableMonths(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const current = availableMonths.find(m => m.isCurrent);
    return current ? current.key : availableMonths[0].key;
  });

  const defaultDates = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return {
      firstDay: `${y}-${m}-01`,
      currentDay: `${y}-${m}-${d}`,
      yearStart: `${y}-01-01`
    };
  }, []);

  const [periodMode, setPeriodMode] = useState<'month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(defaultDates.firstDay);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultDates.currentDay);

  const selectedMonth = useMemo(() => {
    if (periodMode === 'custom' && customStartDate && customEndDate) {
      return createCustomPeriodOption(customStartDate, customEndDate);
    }
    return availableMonths.find(m => m.key === selectedMonthKey) || availableMonths[0];
  }, [periodMode, customStartDate, customEndDate, availableMonths, selectedMonthKey]);

  // 2. Multi-Criteria Filter states
  const [siteFilter, setSiteFilter] = useState<string>(() => initialFilters?.site || 'all');
  const [regionFilter, setRegionFilter] = useState<string>(() => initialFilters?.region || 'all');
  const [domainFilter, setDomainFilter] = useState<string>(() => initialFilters?.domain || 'all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<
    | 'all'
    | 'active_period'
    | 'exclude_zero_end'
    | 'exclude_zero_start'
    | 'exclude_zero_both'
    | 'only_zero_end'
    | 'only_zero_start'
    | 'only_zero_both'
    | 'moved_only'
    | 'missing_price'
  >('all');
  const [isZeroStockModalOpen, setIsZeroStockModalOpen] = useState(false);
  const zeroStockCount = useMemo(() => wines.filter(w => (w.quantity || 0) === 0).length, [wines]);
  const [volumeFilterType, setVolumeFilterType] = useState<'all' | 'greater_than' | 'less_than'>('all');
  const [volumeFilterValue, setVolumeFilterValue] = useState<string>('12');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements' | 'summary'>('stock');

  // Multi-site reference consolidation mode: 'consolidated' (1 line per wine ref, recommended for accountants) vs 'by_site' (detailed physical site)
  const [groupingMode, setGroupingMode] = useState<'consolidated' | 'by_site'>('consolidated');

  // Sync initial filters if prop changes
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.site) setSiteFilter(initialFilters.site);
      if (initialFilters.region) setRegionFilter(initialFilters.region);
      if (initialFilters.domain) setDomainFilter(initialFilters.domain);
    }
  }, [initialFilters]);

  // Quick inline edit price modal/popover
  const [editingWinePrice, setEditingWinePrice] = useState<{ id: string; name: string; currentPrice: number } | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Pre-computed canonical region & sub-region map for high performance O(N) cached
  const wineRegionMap = useMemo(() => {
    const map = new Map<string, { region: string; subRegion: string | null }>();
    wines.forEach((wine) => {
      let reg = (wine?.region || '').trim();
      let sub = (wine?.subRegion || '').trim();

      if (!reg) {
        const classified = classifyWineRegionAndSubRegion(wine);
        reg = classified.region || 'Autres Régions';
        if (!sub && classified.subRegion && classified.subRegion !== classified.region) {
          sub = classified.subRegion;
        }
      } else if (!sub) {
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

      map.set(wine.id, { region: reg, subRegion: sub || null });
    });
    return map;
  }, [wines]);

  // Fast O(1) getter from memoized map
  const getWineRegionAndSub = useCallback((wine: any) => {
    return wineRegionMap.get(wine?.id) || { region: wine?.region || 'Autres Régions', subRegion: wine?.subRegion || null };
  }, [wineRegionMap]);

  // Check if a wine matches the selected region/sub-region filter
  const wineMatchesRegionFilter = useCallback((wine: any, regionFilterVal: string): boolean => {
    if (regionFilterVal === 'all') return true;

    const { region, subRegion } = getWineRegionAndSub(wine);

    if (regionFilterVal.startsWith('reg:')) {
      const target = regionFilterVal.slice(4).trim().toLowerCase();
      return region.toLowerCase() === target || (wine?.region || '').trim().toLowerCase() === target;
    }

    if (regionFilterVal.startsWith('sub:')) {
      const [targetReg = '', targetSub = ''] = regionFilterVal.slice(4).split(':::');
      const regLower = targetReg.trim().toLowerCase();
      const subLower = targetSub.trim().toLowerCase();

      const regMatches = !regLower || region.toLowerCase() === regLower || (wine?.region || '').trim().toLowerCase() === regLower;
      const subMatches = 
        (subRegion && subRegion.toLowerCase() === subLower) ||
        ((wine?.subRegion || '').trim().toLowerCase() === subLower) ||
        ((wine?.subRegion || '').trim().toLowerCase().includes(subLower));

      return regMatches && Boolean(subMatches);
    }

    return (wine?.region || '').trim().toLowerCase() === regionFilterVal.trim().toLowerCase();
  }, [getWineRegionAndSub]);

  // Build dynamic region and sub-region hierarchy from the wine database
  const regionHierarchy = useMemo(() => {
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

  // Available Domains list (dynamically scoped to selected region)
  const availableDomains = useMemo(() => {
    const winesInRegion = wines.filter((w) => wineMatchesRegionFilter(w, regionFilter));
    const counts = new Map<string, number>();
    let hasDPR = false;

    winesInRegion.forEach(w => {
      if (isDPRWine(w)) {
        hasDPR = true;
      }
      const raw = (w.domain || '').trim();
      if (raw) {
        counts.set(raw, (counts.get(raw) || 0) + 1);
      }
    });

    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { list, hasDPR, totalCount: counts.size };
  }, [wines, regionFilter, wineMatchesRegionFilter]);

  // 3. Compute live calculations for the raw cellar accounting
  const rawCellarAccounting = useMemo(() => {
    return calculateCellarAccounting(wines, movements, selectedMonth, sites, 'all', 'all');
  }, [wines, movements, selectedMonth, sites]);

  // 4. Filter stock rows based on all active criteria
  const filteredStockRows = useMemo(() => {
    return rawCellarAccounting.stockRows.filter(row => {
      // 1. Site filter
      if (siteFilter !== 'all' && row.siteId !== siteFilter) return false;

      // 2. Color filter
      if (colorFilter !== 'all' && row.color !== colorFilter) return false;

      // 3. Region & Sub-region filter
      if (!wineMatchesRegionFilter(row.wine, regionFilter)) return false;

      // 4. Domain filter
      if (domainFilter === 'prieure_roch') {
        if (!isDPRWine(row.wine)) return false;
      } else if (domainFilter !== 'all') {
        const targetDomain = domainFilter.trim().toLowerCase();
        const d = (row.domain || '').trim().toLowerCase();
        const canon = getCanonicalDomain(row.domain).toLowerCase();
        if (d !== targetDomain && canon !== targetDomain) return false;
      }

      // 5. Nuanced Stock status & Zero stock handling filter
      if (stockStatusFilter === 'active_period') {
        if (row.startStock <= 0 && row.endStock <= 0 && row.inQuantity <= 0 && row.outQuantity <= 0) return false;
      } else if (stockStatusFilter === 'exclude_zero_end') {
        if (row.endStock <= 0) return false;
      } else if (stockStatusFilter === 'exclude_zero_start') {
        if (row.startStock <= 0) return false;
      } else if (stockStatusFilter === 'exclude_zero_both') {
        if (row.startStock <= 0 && row.endStock <= 0) return false;
      } else if (stockStatusFilter === 'only_zero_end') {
        if (row.endStock !== 0) return false;
      } else if (stockStatusFilter === 'only_zero_start') {
        if (row.startStock !== 0) return false;
      } else if (stockStatusFilter === 'only_zero_both') {
        if (row.startStock !== 0 || row.endStock !== 0) return false;
      } else if (stockStatusFilter === 'moved_only') {
        if (row.inQuantity === 0 && row.outQuantity === 0) return false;
      } else if (stockStatusFilter === 'missing_price') {
        if (!row.hasMissingBuyPrice) return false;
      }

      // 6. Volume filter
      if (volumeFilterType !== 'all' && volumeFilterValue !== '') {
        const targetQty = parseInt(volumeFilterValue, 10);
        if (!isNaN(targetQty)) {
          if (volumeFilterType === 'greater_than' && row.endStock < targetQty) return false;
          if (volumeFilterType === 'less_than' && row.endStock > targetQty) return false;
        }
      }

      // 7. Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const text = `${row.domain} ${row.name} ${row.cuvee || ''} ${row.appellation || ''} ${row.vintage} ${row.bin || ''} ${row.siteName}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });
  }, [
    rawCellarAccounting.stockRows,
    siteFilter,
    colorFilter,
    regionFilter,
    domainFilter,
    stockStatusFilter,
    volumeFilterType,
    volumeFilterValue,
    searchTerm,
    wineMatchesRegionFilter
  ]);

  // 5. Filter movement rows: strictly restricted to the wines in filteredStockRows for this period
  const filteredWineIdSet = useMemo(() => new Set(filteredStockRows.map(r => r.wineId)), [filteredStockRows]);

  const filteredMovementRows = useMemo(() => {
    return rawCellarAccounting.movementRows.filter(m => {
      // Must be among the filtered wines
      if (!filteredWineIdSet.has(m.wineId)) return false;
      
      // If search term is present, also match
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const text = `${m.wineName} ${m.domain} ${m.vintage} ${m.reasonLabel} ${m.userName} ${m.notes || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });
  }, [rawCellarAccounting.movementRows, filteredWineIdSet, searchTerm]);

  // Determine if any custom filter is active
  const isAnyFilterActive = useMemo(() => {
    return siteFilter !== 'all' || 
           regionFilter !== 'all' || 
           domainFilter !== 'all' || 
           colorFilter !== 'all' || 
           stockStatusFilter !== 'all' || 
           volumeFilterType !== 'all' || 
           searchTerm.trim().length > 0;
  }, [siteFilter, regionFilter, domainFilter, colorFilter, stockStatusFilter, volumeFilterType, searchTerm]);

  // Active filter label for summary and filename
  const activeSelectionLabel = useMemo(() => {
    if (!isAnyFilterActive) return null;
    const parts: string[] = [];
    if (regionFilter !== 'all') {
      if (regionFilter.startsWith('reg:')) parts.push(regionFilter.slice(4));
      else if (regionFilter.startsWith('sub:')) {
        const [r, s] = regionFilter.slice(4).split(':::');
        parts.push(`${r} › ${s}`);
      } else parts.push(regionFilter);
    }
    if (domainFilter === 'prieure_roch') parts.push('Prieuré-Roch');
    else if (domainFilter !== 'all') parts.push(domainFilter);
    if (colorFilter !== 'all') parts.push(colorFilter.toUpperCase());
    if (siteFilter !== 'all') {
      const s = sites.find(x => x.id === siteFilter);
      if (s) parts.push(s.name.split(' - ')[0]);
    }
    if (volumeFilterType === 'greater_than') parts.push(`≥ ${volumeFilterValue} bt`);
    if (stockStatusFilter === 'active_period') parts.push('Actifs sur la période');
    if (stockStatusFilter === 'exclude_zero_end') parts.push('Stock fin > 0');
    if (stockStatusFilter === 'exclude_zero_start') parts.push('Stock début > 0');
    if (stockStatusFilter === 'exclude_zero_both') parts.push('Stock début ou fin > 0');
    if (stockStatusFilter === 'only_zero_end') parts.push('Stock 0 fin de mois');
    if (stockStatusFilter === 'only_zero_start') parts.push('Stock 0 début de mois');
    if (stockStatusFilter === 'only_zero_both') parts.push('Stock 0 début & fin');
    if (stockStatusFilter === 'moved_only') parts.push('Avec mouvements');
    if (stockStatusFilter === 'missing_price') parts.push('Prix manquant');
    if (searchTerm.trim()) parts.push(`"${searchTerm.trim()}"`);
    return parts.join(' • ');
  }, [isAnyFilterActive, regionFilter, domainFilter, colorFilter, siteFilter, sites, volumeFilterType, volumeFilterValue, stockStatusFilter, searchTerm]);

  // 6. Recalculated summary matching the EXACT filtered perimeter
  const summary = useMemo(() => {
    if (!isAnyFilterActive) {
      return rawCellarAccounting.summary;
    }
    return buildFilteredAccountingSummary(
      filteredStockRows,
      filteredMovementRows,
      rawCellarAccounting.summary,
      sites,
      activeSelectionLabel || 'Périmètre filtré'
    );
  }, [isAnyFilterActive, filteredStockRows, filteredMovementRows, rawCellarAccounting.summary, sites, activeSelectionLabel]);

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSiteFilter('all');
    setRegionFilter('all');
    setDomainFilter('all');
    setColorFilter('all');
    setStockStatusFilter('all');
    setVolumeFilterType('all');
    setVolumeFilterValue('12');
    setSearchTerm('');
  };

  // Quick preset helper for custom date ranges
  const applyDatePreset = (preset: '30_days' | '7_days' | 'current_month' | 'last_month' | 'year_to_date') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (preset === '30_days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setCustomStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setCustomEndDate(todayStr);
    } else if (preset === '7_days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setCustomStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setCustomEndDate(todayStr);
    } else if (preset === 'current_month') {
      const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setCustomStartDate(start);
      setCustomEndDate(todayStr);
    } else if (preset === 'last_month') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setCustomStartDate(`${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-01`);
      setCustomEndDate(`${lastDayPrevMonth.getFullYear()}-${pad(lastDayPrevMonth.getMonth() + 1)}-${pad(lastDayPrevMonth.getDate())}`);
    } else if (preset === 'year_to_date') {
      setCustomStartDate(`${now.getFullYear()}-01-01`);
      setCustomEndDate(todayStr);
    }
  };

  // Consolidated stock rows (1 line per unique wine reference across all physical sites)
  const consolidatedFilteredStockRows = useMemo(() => {
    return consolidateStockRowsByReference(filteredStockRows);
  }, [filteredStockRows]);

  // Actual stock rows to display according to the active grouping mode
  const displayStockRows = useMemo(() => {
    return groupingMode === 'consolidated' ? consolidatedFilteredStockRows : filteredStockRows;
  }, [groupingMode, consolidatedFilteredStockRows, filteredStockRows]);

  // Pagination state for Stock table (ultra-fast rendering)
  const [stockPage, setStockPage] = useState<number>(1);
  const [stockPageSize, setStockPageSize] = useState<number>(50);

  useEffect(() => {
    setStockPage(1);
  }, [
    groupingMode,
    selectedMonthKey,
    periodMode,
    customStartDate,
    customEndDate,
    siteFilter,
    regionFilter,
    domainFilter,
    colorFilter,
    stockStatusFilter,
    volumeFilterType,
    volumeFilterValue,
    searchTerm
  ]);

  const totalStockPages = useMemo(() => {
    if (stockPageSize <= 0 || stockPageSize >= displayStockRows.length) return 1;
    return Math.ceil(displayStockRows.length / stockPageSize);
  }, [displayStockRows.length, stockPageSize]);

  const paginatedStockRows = useMemo(() => {
    if (stockPageSize <= 0 || stockPageSize >= displayStockRows.length) {
      return displayStockRows;
    }
    const startIndex = (stockPage - 1) * stockPageSize;
    return displayStockRows.slice(startIndex, startIndex + stockPageSize);
  }, [displayStockRows, stockPage, stockPageSize]);

  // Pagination state for Movements table
  const [movementsPage, setMovementsPage] = useState<number>(1);
  const [movementsPageSize, setMovementsPageSize] = useState<number>(50);

  useEffect(() => {
    setMovementsPage(1);
  }, [filteredMovementRows.length, activeSubTab]);

  const totalMovementPages = useMemo(() => {
    if (movementsPageSize <= 0 || movementsPageSize >= filteredMovementRows.length) return 1;
    return Math.ceil(filteredMovementRows.length / movementsPageSize);
  }, [filteredMovementRows.length, movementsPageSize]);

  const paginatedMovementRows = useMemo(() => {
    if (movementsPageSize <= 0 || movementsPageSize >= filteredMovementRows.length) {
      return filteredMovementRows;
    }
    const startIndex = (movementsPage - 1) * movementsPageSize;
    return filteredMovementRows.slice(startIndex, startIndex + movementsPageSize);
  }, [filteredMovementRows, movementsPage, movementsPageSize]);

  // Dedicated 1-Click DPR Export handler for the selected month (Consolidated 1 line per ref + Detail per site)
  const handleExportDPR = () => {
    try {
      const dprWines = rawCellarAccounting.stockRows.filter(r => isDPRWine(r.wine));
      const consolidatedDprWines = consolidateStockRowsByReference(dprWines);
      const dprWineIds = new Set(dprWines.map(r => r.wineId));
      const dprMovements = rawCellarAccounting.movementRows.filter(m => dprWineIds.has(m.wineId));
      const dprSummary = buildFilteredAccountingSummary(consolidatedDprWines, dprMovements, rawCellarAccounting.summary, sites, 'Domaine Prieuré-Roch');
      exportDPRMonthlyExcel(consolidatedDprWines, dprMovements, dprSummary, dprWines);
    } catch (err) {
      console.error("Erreur lors de l'export DPR:", err);
    }
  };

  // Synchronized Multi-Filter Excel Export (Consolidated 1 line per ref + Detail per site)
  const handleExportFilteredExcel = () => {
    try {
      let prefix = 'Extraction_Comptable_Premnord';
      if (domainFilter === 'prieure_roch') {
        prefix = 'Extraction_Prieure_Roch';
      } else if (domainFilter !== 'all') {
        prefix = `Extraction_${domainFilter.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (regionFilter !== 'all') {
        const regName = regionFilter.startsWith('sub:') ? regionFilter.slice(4).replace(':::', '_') : regionFilter.replace(/^reg:/, '');
        prefix = `Extraction_${regName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (isAnyFilterActive) {
        prefix = 'Extraction_Selection_Filtree';
      }

      if (stockStatusFilter === 'exclude_zero_end') prefix += '_Sans_Stock0_Fin';
      else if (stockStatusFilter === 'exclude_zero_start') prefix += '_Sans_Stock0_Debut';
      else if (stockStatusFilter === 'only_zero_end') prefix += '_Stock0_Fin';
      else if (stockStatusFilter === 'only_zero_start') prefix += '_Stock0_Debut';
      else if (stockStatusFilter === 'only_zero_both') prefix += '_Stock0_Permanent';

      const customTitle = activeSelectionLabel
        ? `PREMNORD - EXTRACTION COMPTABLE : ${activeSelectionLabel.toUpperCase()}`
        : undefined;

      exportAccountingToExcel(
        consolidatedFilteredStockRows,
        filteredMovementRows,
        summary,
        prefix,
        customTitle,
        filteredStockRows
      );
    } catch (err) {
      console.error("Erreur lors de l'export Excel:", err);
    }
  };

  // Synchronized Multi-Filter CSV Export
  const handleExportFilteredCsv = () => {
    try {
      let prefix = groupingMode === 'consolidated' ? 'Extraction_Stock_Consolide' : 'Extraction_Stock_Detaille';
      if (domainFilter === 'prieure_roch') {
        prefix = 'Extraction_Stock_Prieure_Roch';
      } else if (domainFilter !== 'all') {
        prefix = `Extraction_Stock_${domainFilter.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (isAnyFilterActive) {
        prefix = 'Extraction_Stock_Selection';
      }
      exportStockToCsv(displayStockRows, summary, prefix);
    } catch (err) {
      console.error("Erreur lors de l'export CSV:", err);
    }
  };

  // Handle price update
  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWinePrice) return;
    const val = parseFloat(newPriceInput.replace(',', '.'));
    if (isNaN(val) || val < 0) return;

    setIsSavingPrice(true);
    try {
      await updateWine(editingWinePrice.id, { priceBuy: val, priceBuyHt: val }, 'edit', { propagateReference: true });
      setEditingWinePrice(null);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du prix d'achat:", err);
    } finally {
      setIsSavingPrice(false);
    }
  };

  // Quick month switcher shortcuts
  const selectRecentMonth = (offsetIndex: number) => {
    const currentIdx = availableMonths.findIndex(m => m.isCurrent);
    const targetIdx = currentIdx >= 0 ? currentIdx + offsetIndex : 0;
    if (availableMonths[targetIdx]) {
      setSelectedMonthKey(availableMonths[targetIdx].key);
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fadeIn">
      
      {/* 1. Header & Executive Title */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                Espace Comptable & Clôtures
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                Extraction Cave & Valorisation des Stocks
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-sans">
            Génération certifiée pour l'expert-comptable : <strong className="text-slate-700">Stock début de mois</strong>, <strong className="text-slate-700">Stock fin de mois</strong>, <strong className="text-slate-700">Prix d'achat HT</strong>, calcul de la <strong className="text-slate-700">valeur totale du stock</strong> et journal complet des mouvements.
          </p>
        </div>

        {/* Primary Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
          
          {/* Dedicated 1-Click Prieuré Roch Monthly Export */}
          <button
            onClick={handleExportDPR}
            className="flex-1 sm:flex-initial px-4 py-3 bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 text-amber-200 border border-amber-500/50 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer font-mono select-none"
            title="Télécharger l'arrêté mensuel officiel (.xlsx) spécifique au Domaine Prieuré-Roch pour ce mois"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Export Prieuré-Roch (.xlsx)</span>
          </button>

          <button
            onClick={handleExportFilteredExcel}
            className="flex-1 sm:flex-initial px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer font-mono select-none"
            title={isAnyFilterActive ? `Télécharger le classeur Excel (.xlsx) pour ${activeSelectionLabel || 'la sélection'} (avec ses mouvements)` : "Télécharger le classeur Excel officiel (.xlsx) avec tous les onglets"}
          >
            <Download className="w-4 h-4" />
            <span>{isAnyFilterActive ? 'Télécharger la sélection (.xlsx)' : 'Télécharger Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={handleExportFilteredCsv}
            className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer font-mono select-none"
            title="Exporter l'état de stock en format CSV (séparateur point-virgule pour logiciel comptable)"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer font-mono select-none"
            title="Imprimer l'état comptable ou exporter en PDF"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          {/* Quick Zero Stock Cleaning Tool Launcher */}
          <button
            onClick={() => setIsZeroStockModalOpen(true)}
            className="px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-mono select-none shadow-2xs"
            title="Identifier et choisir si supprimer les références à stock 0"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Gérer stocks 0 ({zeroStockCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Month & Perimeter Selectors Bar (Central Multi-Filter Control Center) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-md border border-slate-800 space-y-4">
        
        {/* Row 1: Period Mode switcher & Date selector */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode switch pills */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodMode === 'month'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Par Mois</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodMode === 'custom'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Dates Personnalisées</span>
              </button>
            </div>

            {/* Sub-view: Month selector */}
            {periodMode === 'month' ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 text-xs sm:text-sm font-bold font-mono rounded-xl px-3 py-2 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} {m.isCurrent ? '(Mois en cours)' : ''}
                    </option>
                  ))}
                </select>

                {/* Quick shortcuts */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => selectRecentMonth(0)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors cursor-pointer border border-slate-700/60"
                  >
                    Mois en cours
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRecentMonth(1)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors cursor-pointer border border-slate-700/60"
                  >
                    Mois M-1
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRecentMonth(2)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors cursor-pointer border border-slate-700/60"
                  >
                    Mois M-2
                  </button>
                </div>
              </div>
            ) : (
              /* Sub-view: Custom Date Range pickers */
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Du</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Au</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                  />
                </div>

                {/* Quick Date Presets */}
                <div className="hidden md:flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => applyDatePreset('30_days')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 cursor-pointer"
                  >
                    30 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('7_days')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 cursor-pointer"
                  >
                    7 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('current_month')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 cursor-pointer"
                  >
                    Ce mois
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('last_month')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 cursor-pointer"
                  >
                    Mois dernier
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('year_to_date')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 cursor-pointer"
                  >
                    YTD
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick preset actions */}
          <div className="flex flex-wrap items-center gap-2">
            {availableDomains.hasDPR && (
              <button
                type="button"
                onClick={() => setDomainFilter(prev => prev === 'prieure_roch' ? 'all' : 'prieure_roch')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer border flex items-center gap-1.5 ${
                  domainFilter === 'prieure_roch'
                    ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-sm'
                    : 'bg-rose-950/80 hover:bg-rose-900 border-rose-700/60 text-amber-200'
                }`}
                title="Filtrer instantanément sur le Domaine Prieuré-Roch"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{domainFilter === 'prieure_roch' ? '✓ Prieuré-Roch Actif' : 'Filtre Prieuré-Roch (DPR)'}</span>
              </button>
            )}

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1"
                title="Effacer tous les filtres actifs et revenir à l'ensemble de la cave"
              >
                <X className="w-3 h-3" />
                <span>Effacer les filtres</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Comprehensive Multi-Criteria Filters Bar */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          
          {/* 1. Site Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Site
            </label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl px-2.5 py-2 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tous les sites ({sites.length})</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
              ))}
            </select>
          </div>

          {/* 2. Région & Sous-Région Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" /> Région
            </label>
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                if (domainFilter !== 'all' && domainFilter !== 'prieure_roch') {
                  setDomainFilter('all');
                }
              }}
              className={`w-full border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none cursor-pointer truncate transition-colors ${
                regionFilter !== 'all'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 focus:border-emerald-500'
              }`}
              title="Filtrer par Région & Sous-Région"
            >
              <option value="all">Toutes régions ({regionHierarchy.reduce((acc, r) => acc + r.totalWines, 0)})</option>
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
          </div>

          {/* 3. Domaine Viticole */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <WineIcon className="w-3 h-3 text-rose-400" /> Domaine
            </label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className={`w-full border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none cursor-pointer truncate transition-colors ${
                domainFilter === 'prieure_roch'
                  ? 'bg-rose-950 border-amber-500 text-amber-200'
                  : domainFilter !== 'all'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                    : 'bg-slate-800 text-slate-200 border-slate-700 focus:border-emerald-500'
              }`}
              title="Filtrer par Domaine viticole"
            >
              <option value="all">
                {regionFilter !== 'all' ? `Domaines région (${availableDomains.list.length})` : `Tous domaines (${availableDomains.list.length})`}
              </option>
              {availableDomains.hasDPR && (
                <optgroup label="Sélection Spéciale">
                  <option value="prieure_roch">⭐ Domaine Prieuré-Roch</option>
                </optgroup>
              )}
              <optgroup label="Domaines viticoles">
                {availableDomains.list.map((dom) => (
                  <option key={dom.name} value={dom.name}>
                    {dom.name} ({dom.count})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 4. Couleur / Catégorie */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Catégorie
            </label>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className={`w-full border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none cursor-pointer transition-colors ${
                colorFilter !== 'all'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 focus:border-emerald-500'
              }`}
            >
              <option value="all">Toutes catégories</option>
              <option value="rouge">Vins Rouges</option>
              <option value="blanc">Vins Blancs</option>
              <option value="rose">Vins Rosés</option>
              <option value="bulle">Champagnes & Bulles</option>
              <option value="orange">Vins Oranges</option>
              <option value="spiritueux">Spiritueux</option>
              <option value="cidre_biere">Bières & Cidres</option>
              <option value="soft">Softs & Sans Alcool</option>
            </select>
          </div>

          {/* 5. Volume en stock */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3 text-amber-500" /> Volume
            </label>
            <select
              value={
                volumeFilterType === 'greater_than' ? `gte_${volumeFilterValue}` : 'all'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setVolumeFilterType('all');
                } else if (val.startsWith('gte_')) {
                  setVolumeFilterType('greater_than');
                  setVolumeFilterValue(val.replace('gte_', ''));
                }
              }}
              className={`w-full border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none cursor-pointer transition-colors ${
                volumeFilterType !== 'all'
                  ? 'bg-amber-950 border-amber-500 text-amber-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 focus:border-emerald-500'
              }`}
            >
              <option value="all">Tous volumes</option>
              <option value="gte_12">Gros volumes (≥ 12 bt)</option>
              <option value="gte_24">Très gros (≥ 24 bt)</option>
              <option value="gte_48">Volumes massifs (≥ 48 bt)</option>
              <option value="gte_60">Exceptionnel (≥ 60 bt)</option>
            </select>
          </div>

          {/* 6. Traitement du stock 0 & Statut */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" /> Traitement stock 0
            </label>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className={`w-full border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none cursor-pointer transition-colors ${
                stockStatusFilter !== 'all'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 focus:border-emerald-500'
              }`}
            >
              <option value="all">Tous (inclure tous les stocks 0)</option>
              <option value="active_period">Actifs sur le mois (Début, Fin ou Mouvements)</option>
              <optgroup label="Nuance par Date (Début / Fin de mois)">
                <option value="exclude_zero_end">Stock Fin &gt; 0 (Exclure stock 0 fin de mois)</option>
                <option value="exclude_zero_start">Stock Début &gt; 0 (Exclure stock 0 début de mois)</option>
                <option value="exclude_zero_both">Stock Début OU Fin &gt; 0 (Exclure sans stock)</option>
              </optgroup>
              <optgroup label="Isolement des ruptures et stocks 0">
                <option value="only_zero_end">Stock 0 Fin uniquement (Épuisés fin de mois)</option>
                <option value="only_zero_start">Stock 0 Début uniquement (Démarrés à zéro)</option>
                <option value="only_zero_both">Stock 0 Début &amp; Fin (Sans aucun stock)</option>
              </optgroup>
              <optgroup label="Autres critères comptables">
                <option value="moved_only">Avec mouvements ce mois (flux réels)</option>
                <option value="missing_price">Prix d'achat HT manquant</option>
              </optgroup>
            </select>
          </div>

        </div>

        {/* Informational date range badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
          <div>
            Période arrêtée : du <span className="text-emerald-400 font-bold">{summary.startDate.toLocaleDateString('fr-FR')}</span> au <span className="text-emerald-400 font-bold">{summary.endDate.toLocaleDateString('fr-FR')}</span> inclus
          </div>
          <div className="flex items-center gap-4">
            <span><strong className="text-white font-mono">{filteredStockRows.length}</strong> référence(s) sélectionnée(s)</span>
            <span>&bull;</span>
            <span className="text-slate-300"><strong className="text-white font-mono">{filteredMovementRows.length}</strong> mouvement(s) associé(s) ce mois-ci</span>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Filter Synthesis & Direct Export Banner */}
      {isAnyFilterActive && (
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-600/40 rounded-3xl p-5 shadow-sm text-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl shadow-sm shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 bg-emerald-900/60 border border-emerald-600/40 px-2 py-0.5 rounded-md">
                  Périmètre Multi-Filtre Actif
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {selectedMonth.label}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white font-sans flex items-center gap-2">
                <span>{activeSelectionLabel}</span>
              </h3>
              <p className="text-xs text-slate-300 font-sans">
                Sélection arrêtée : <strong className="text-white font-mono">{summary.totalBottlesEnd}</strong> bouteilles en stock fin de mois &bull; <strong className="text-emerald-300 font-mono font-bold">{formatCurrencyFr(summary.totalValueEndHt)}</strong> de valorisation &bull; <strong className="text-amber-300 font-mono">{filteredMovementRows.length}</strong> mouvement(s) sur ce mois.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
            <button
              onClick={handleExportFilteredExcel}
              className="flex-1 lg:flex-initial px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer select-none"
              title="Télécharger l'export Excel complet pour ce périmètre filtré avec les mouvements de la période"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span>Télécharger Excel de la sélection (.xlsx)</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs rounded-xl border border-slate-700 transition-all cursor-pointer select-none"
            >
              Effacer les filtres
            </button>
          </div>
        </div>
      )}

      {/* 3. Executive Financial KPI Cards (The Core Valuation requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: VALEUR TOTALE DU STOCK (Fin de mois) */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-5 rounded-3xl border border-emerald-800/40 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Coins className="w-20 h-20 text-emerald-400" />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Valeur Totale du Stock (Fin de Mois)
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                Arrêté Clôture
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-300 tracking-tight pt-1">
              {formatCurrencyFr(summary.totalValueEndHt)}
            </div>
            <p className="text-[11px] text-slate-300 font-sans flex items-center gap-1.5 pt-1">
              <strong className="text-white font-mono">{summary.totalBottlesEnd}</strong> bouteilles en stock à l'inventaire
            </p>
          </div>
        </div>

        {/* Card 2: VALEUR DÉBUT DE MOIS & VARIATION */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Valeur Stock (Début de Mois)
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                summary.totalValueNetChangeHt >= 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {summary.totalValueNetChangeHt >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {summary.totalValueNetChangeHt >= 0 ? '+' : ''}{formatCompactCurrencyFr(summary.totalValueNetChangeHt)}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 tracking-tight pt-1">
              {formatCurrencyFr(summary.totalValueStartHt)}
            </div>
            <p className="text-[11px] text-slate-500 font-sans flex items-center gap-1.5 pt-1">
              Au 1er du mois : <span className="font-mono font-bold text-slate-700">{summary.totalBottlesStart}</span> bt
            </p>
          </div>
        </div>

        {/* Card 3: ACHATS / ENTRÉES DU MOIS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                Achats & Entrées du Mois (+)
              </span>
              <span className="p-1 bg-emerald-50 text-emerald-700 rounded-lg">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-700 tracking-tight pt-1">
              +{formatCurrencyFr(summary.totalValueInHt)}
            </div>
            <p className="text-[11px] text-slate-500 font-sans flex items-center gap-1.5 pt-1">
              <span className="font-mono font-bold text-emerald-800">+{summary.totalBottlesIn}</span> bt reçues / livrées
            </p>
          </div>
        </div>

        {/* Card 4: SORTIES / CONSOMMATIONS DU MOIS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700">
                Sorties & Ventes du Mois (-)
              </span>
              <span className="p-1 bg-rose-50 text-rose-700 rounded-lg">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-rose-700 tracking-tight pt-1">
              -{formatCurrencyFr(summary.totalValueOutHt)}
            </div>
            <p className="text-[11px] text-slate-500 font-sans flex items-center gap-1.5 pt-1">
              <span className="font-mono font-bold text-rose-800">-{summary.totalBottlesOut}</span> bt vendues / sorties
            </p>
          </div>
        </div>

      </div>

      {/* Warning banner if wines in stock have 0€ buy price */}
      {summary.referencesWithMissingPriceCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-950 leading-relaxed font-sans">
              <strong className="font-bold">{summary.referencesWithMissingPriceCount} référence(s) en stock</strong> ont un prix d'achat HT à <strong className="font-mono font-bold text-amber-900">0,00 €</strong>. Pour garantir une valorisation d'inventaire exacte au comptable, veuillez renseigner leur prix d'achat.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setStockStatusFilter('missing_price');
              setActiveSubTab('stock');
            }}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer font-mono"
          >
            Voir ces {summary.referencesWithMissingPriceCount} références
          </button>
        </div>
      )}

      {/* 4. Tab Navigation (Stock / Mouvements / Synthèse) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-5">
        
        {/* Upper row: tab buttons and search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('stock')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap font-mono uppercase ${
                activeSubTab === 'stock'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <WineIcon className="w-4 h-4 text-emerald-600" />
              <span>Valorisation & Stocks ({filteredStockRows.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('movements')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap font-mono uppercase ${
                activeSubTab === 'movements'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span>Onglet Mouvements ({filteredMovementRows.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap font-mono uppercase ${
                activeSubTab === 'summary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Synthèse & Bilan Matières</span>
            </button>
          </div>

          {/* Quick Search & Direct In-Place Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer vin, domaine, cuvée, millésime..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-4 text-slate-900 text-xs outline-none transition-all font-sans"
              />
            </div>

            {/* Direct Export Buttons right next to search input */}
            {(domainFilter === 'prieure_roch' || searchTerm.toLowerCase().includes('roch') || searchTerm.toLowerCase().includes('prieur')) && (
              <button
                type="button"
                onClick={handleExportDPR}
                className="h-10 px-3 bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 text-amber-200 border border-amber-500/50 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                title="Télécharger l'arrêté officiel complet de Prieuré-Roch (.xlsx)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Export Prieuré-Roch (.xlsx)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportFilteredExcel}
              className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
              title="Télécharger la sélection active en Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportFilteredCsv}
              className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold font-mono flex items-center gap-1 border border-slate-200 cursor-pointer whitespace-nowrap"
              title="Exporter en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Secondary filters row (for stock view) */}
        {activeSubTab === 'stock' && (
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Grouping mode switcher (Consolidated per reference vs Detailed per site) */}
              <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center border border-slate-300/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setGroupingMode('consolidated')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupingMode === 'consolidated'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Regrouper les stocks de la même référence de vin sur une seule ligne consolidée (recommandé pour l'arrêté comptable)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>1 ligne / référence</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupingMode('by_site')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupingMode === 'by_site'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Afficher une ligne distincte pour chaque site de stockage physique et casier"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Détaillé par site</span>
                </button>
              </div>

              <span className="text-slate-300 hidden md:inline">|</span>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="h-9 bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold shadow-2xs"
              >
                <option value="all">Toutes les références ({groupingMode === 'consolidated' ? consolidatedFilteredStockRows.length : rawCellarAccounting.stockRows.length})</option>
                <option value="positive_only">Stock &gt; 0 uniquement ({summary.referencesWithStockCount})</option>
                <option value="moved_only">Avec mouvements ce mois-ci</option>
                <option value="missing_price">Prix d'achat manquant ({summary.referencesWithMissingPriceCount})</option>
              </select>

              <select
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="h-9 bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 outline-none cursor-pointer font-semibold shadow-2xs"
              >
                <option value="all">Toutes les catégories</option>
                <option value="rouge">Vins Rouges</option>
                <option value="blanc">Vins Blancs</option>
                <option value="rose">Vins Rosés</option>
                <option value="bulle">Champagnes & Bulles</option>
                <option value="orange">Vins Oranges</option>
                <option value="spiritueux">Spiritueux</option>
                <option value="cidre_biere">Bières & Cidres</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500">
              {groupingMode === 'consolidated' ? (
                <span>
                  Affichage de <strong className="text-slate-900 font-bold">{consolidatedFilteredStockRows.length}</strong> référence{consolidatedFilteredStockRows.length > 1 ? 's' : ''} unique{consolidatedFilteredStockRows.length > 1 ? 's' : ''} <span className="text-slate-400">({filteredStockRows.length} lignes physiques)</span>
                </span>
              ) : (
                <span>
                  Affichage de <strong className="text-slate-900 font-bold">{filteredStockRows.length}</strong> ligne{filteredStockRows.length > 1 ? 's' : ''} de stock détaillée{filteredStockRows.length > 1 ? 's' : ''}
                </span>
              )}
              <button
                type="button"
                onClick={handleExportFilteredExcel}
                className="ml-2 text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 cursor-pointer transition-colors shadow-2xs"
                title="Télécharger l'arrêté Excel (1 ligne par référence consolidée + onglet détail par site)"
              >
                <Download className="w-3 h-3" />
                <span>Exporter Excel ({displayStockRows.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-TAB 1: STOCK & VALORISATION TABLE */}
        {/* ==================================================== */}
        {activeSubTab === 'stock' && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white sticky top-0 z-20 font-mono text-[11px] tracking-wide uppercase select-none">
                  <tr>
                    <th className="py-3 px-3">Domaine & Vin</th>
                    <th className="py-3 px-2 text-center">Année</th>
                    <th className="py-3 px-2 text-center">Couleur</th>
                    <th className="py-3 px-2">{groupingMode === 'consolidated' ? 'Sites & Emplacements' : 'Site & Casier'}</th>
                    <th className="py-3 px-2 text-right bg-slate-800/80">Stock Début</th>
                    <th className="py-3 px-2 text-right text-emerald-400 bg-slate-800/80">Entrées (+)</th>
                    <th className="py-3 px-2 text-right text-rose-400 bg-slate-800/80">Sorties (-)</th>
                    <th className="py-3 px-2 text-right text-emerald-300 font-bold bg-slate-800/80">Stock Fin</th>
                    <th className="py-3 px-3 text-right bg-slate-800">Prix Achat HT</th>
                    <th className="py-3 px-3 text-right">Valeur Début HT</th>
                    <th className="py-3 px-3 text-right text-emerald-400 font-black bg-emerald-950/60 border-l border-emerald-800/40">
                      Valeur Stock Fin HT
                    </th>
                    <th className="py-3 px-3 text-right">Var. Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-sans text-slate-700">
                  {filteredStockRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 font-mono text-xs">
                        Aucune référence ne correspond aux critères de filtre sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    paginatedStockRows.map((row) => (
                      <tr 
                        key={row.wineId} 
                        className={`hover:bg-slate-50 transition-colors ${row.hasMissingBuyPrice ? 'bg-amber-50/40' : ''}`}
                      >
                        {/* Domaine & Vin */}
                        <td className="py-2.5 px-3">
                          <div 
                            className="cursor-pointer hover:underline"
                            onClick={() => onSelectWine && onSelectWine(row.wineId)}
                          >
                            <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                              {row.domain}
                            </span>
                            <span className="text-slate-600 block text-[11px] truncate max-w-[220px]">
                              {row.name} {row.cuvee ? `— ${row.cuvee}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Vintage */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                          {row.vintage}
                        </td>

                        {/* Color */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                            {row.color}
                          </span>
                        </td>

                        {/* Site & Bin */}
                        <td className="py-2.5 px-2 max-w-[240px]">
                          {row.isConsolidated && (row.siteCount || 0) > 1 ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {row.siteCount} sites
                                </span>
                                {row.bin && (
                                  <span className="text-[10px] font-mono text-slate-400 truncate">
                                    Casiers : {row.bin}
                                  </span>
                                )}
                              </div>
                              <span 
                                className="text-[10px] text-slate-500 block truncate mt-0.5" 
                                title={row.sitesSummary}
                              >
                                {row.sitesSummary}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-slate-800 block text-[11px] truncate">
                                {row.siteName.split(' - ')[0]}
                              </span>
                              {row.bin && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  Casier : {row.bin}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Stock Début */}
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600 bg-slate-50/50">
                          {row.startStock} bt
                        </td>

                        {/* Entrées (+) */}
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-700 bg-slate-50/50">
                          {row.inQuantity > 0 ? `+${row.inQuantity}` : '-'}
                        </td>

                        {/* Sorties (-) */}
                        <td className="py-2.5 px-2 text-right font-mono text-rose-700 bg-slate-50/50">
                          {row.outQuantity > 0 ? `-${row.outQuantity}` : '-'}
                        </td>

                        {/* Stock Fin */}
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 bg-emerald-50/30">
                          <span className={row.endStock === 0 ? 'text-slate-400 font-normal' : ''}>
                            {row.endStock} bt
                          </span>
                        </td>

                        {/* Prix d'achat HT */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 bg-slate-50/70">
                          {row.buyPriceHt > 0 ? (
                            <span 
                              className="cursor-pointer hover:text-emerald-700 hover:underline"
                              onClick={() => {
                                setEditingWinePrice({ id: row.wineId, name: `${row.domain} - ${row.name}`, currentPrice: row.buyPriceHt });
                                setNewPriceInput(row.buyPriceHt.toString());
                              }}
                              title="Cliquer pour modifier le prix d'achat"
                            >
                              {formatCurrencyFr(row.buyPriceHt)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWinePrice({ id: row.wineId, name: `${row.domain} - ${row.name}`, currentPrice: 0 });
                                setNewPriceInput('');
                              }}
                              className="text-[10px] text-amber-700 font-bold bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer font-mono"
                              title="Prix manquant ! Cliquez pour renseigner"
                            >
                              0,00 € ?
                            </button>
                          )}
                        </td>

                        {/* Valeur Début HT */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {formatCurrencyFr(row.startValueHt)}
                        </td>

                        {/* Valeur Stock Fin HT (Prix achat * bt) */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40 border-l border-emerald-100">
                          {formatCurrencyFr(row.endValueHt)}
                        </td>

                        {/* Variation Valeur */}
                        <td className={`py-2.5 px-3 text-right font-mono text-xs ${
                          row.netValueChangeHt > 0 
                            ? 'text-emerald-600' 
                            : row.netValueChangeHt < 0 
                              ? 'text-rose-600' 
                              : 'text-slate-400'
                        }`}>
                          {row.netValueChangeHt > 0 ? '+' : ''}
                          {formatCurrencyFr(row.netValueChangeHt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table Footer Totals */}
                <tfoot className="bg-slate-900 text-white font-mono text-xs font-bold sticky bottom-0 z-20 border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 uppercase tracking-wider">
                      TOTAL ({displayStockRows.length} {groupingMode === 'consolidated' ? 'réf.' : 'lignes'})
                    </td>
                    <td className="py-3 px-2 text-right">
                      {displayStockRows.reduce((s, r) => s + r.startStock, 0)} bt
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-400">
                      +{displayStockRows.reduce((s, r) => s + r.inQuantity, 0)}
                    </td>
                    <td className="py-3 px-2 text-right text-rose-400">
                      -{displayStockRows.reduce((s, r) => s + r.outQuantity, 0)}
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-300 font-black">
                      {displayStockRows.reduce((s, r) => s + r.endStock, 0)} bt
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      —
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatCurrencyFr(displayStockRows.reduce((s, r) => s + r.startValueHt, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-300 font-black bg-emerald-950 border-l border-emerald-800">
                      {formatCurrencyFr(displayStockRows.reduce((s, r) => s + r.endValueHt, 0))}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatCurrencyFr(displayStockRows.reduce((s, r) => s + r.netValueChangeHt, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Controls for Stock Table */}
            {displayStockRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-600 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span>
                    Affichage de <strong className="text-slate-900">{Math.min((stockPage - 1) * stockPageSize + 1, displayStockRows.length)}</strong> à <strong className="text-slate-900">{Math.min(stockPage * stockPageSize, displayStockRows.length)}</strong> sur <strong className="text-slate-900">{displayStockRows.length}</strong> {groupingMode === 'consolidated' ? 'références' : 'lignes de stock'}
                  </span>
                  <span className="text-slate-400 hidden lg:inline">
                    • L'export Excel télécharge 100% des {displayStockRows.length} {groupingMode === 'consolidated' ? 'références' : 'lignes'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-slate-400 text-[11px]">Par page :</span>
                    <select
                      value={stockPageSize}
                      onChange={(e) => {
                        setStockPageSize(Number(e.target.value));
                        setStockPage(1);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={Math.max(1, displayStockRows.length)}>Tous ({displayStockRows.length})</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={stockPage <= 1}
                    onClick={() => setStockPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-700 cursor-pointer"
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-slate-800 px-1">
                    {stockPage} / {totalStockPages}
                  </span>

                  <button
                    type="button"
                    disabled={stockPage >= totalStockPages}
                    onClick={() => setStockPage(p => Math.min(totalStockPages, p + 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-700 cursor-pointer"
                    title="Page suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-TAB 2: MOUVEMENTS DU MOIS TABLE */}
        {/* ==================================================== */}
        {activeSubTab === 'movements' && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white sticky top-0 z-20 font-mono text-[11px] tracking-wide uppercase select-none">
                  <tr>
                    <th className="py-3 px-3">Date & Heure</th>
                    <th className="py-3 px-3">Référence Vin</th>
                    <th className="py-3 px-2 text-center">Type</th>
                    <th className="py-3 px-2 text-right">Quantité</th>
                    <th className="py-3 px-3">Motif du Flux</th>
                    <th className="py-3 px-3">Origine / Destination</th>
                    <th className="py-3 px-3 text-right">Prix Achat HT</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Valeur Mouvement</th>
                    <th className="py-3 px-3">Opérateur</th>
                    <th className="py-3 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-sans text-slate-700">
                  {filteredMovementRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-mono text-xs">
                        Aucun mouvement enregistré pour cette période comptable ({summary.periodLabel}).
                      </td>
                    </tr>
                  ) : (
                    paginatedMovementRows.map((m) => {
                      const isPositive = m.type === 'in' || (m.type === 'correction' && m.quantity > 0);
                      const isTransfer = m.type === 'transfer';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          {/* Date */}
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {m.dateStr}
                          </td>

                          {/* Wine */}
                          <td className="py-2.5 px-3">
                            <span 
                              className="font-bold text-slate-900 block hover:underline cursor-pointer"
                              onClick={() => onSelectWine && onSelectWine(m.wineId)}
                            >
                              {m.wineName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {m.domain} {m.vintage ? `(${m.vintage})` : ''}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              isTransfer
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isPositive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {m.typeLabel}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-sm">
                            <span className={
                              isTransfer
                                ? 'text-blue-700'
                                : isPositive
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                            }>
                              {isTransfer ? 'TF ' : isPositive ? '+' : '-'}{Math.abs(m.quantity)} bt
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-800">
                              {m.reasonLabel}
                            </span>
                          </td>

                          {/* Source / Dest */}
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {m.fromSiteName && (
                              <div>De : <span className="font-semibold">{m.fromSiteName}</span></div>
                            )}
                            {m.toSiteName && (
                              <div>Vers : <span className="font-semibold">{m.toSiteName}</span></div>
                            )}
                            {!m.fromSiteName && !m.toSiteName && <span className="text-slate-400">—</span>}
                          </td>

                          {/* Prix achat unitaire */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {formatCurrencyFr(m.buyPriceHt)}
                          </td>

                          {/* Valeur totale du flux */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrencyFr(m.totalValueHt)}
                          </td>

                          {/* Opérateur */}
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {m.userName}
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate text-[11px]">
                            {m.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls for Movements Table */}
            {filteredMovementRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-600 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span>
                    Affichage de <strong className="text-slate-900">{Math.min((movementsPage - 1) * movementsPageSize + 1, filteredMovementRows.length)}</strong> à <strong className="text-slate-900">{Math.min(movementsPage * movementsPageSize, filteredMovementRows.length)}</strong> sur <strong className="text-slate-900">{filteredMovementRows.length}</strong> mouvements
                  </span>
                  <span className="text-slate-400 hidden lg:inline">
                    • L'export Excel inclut 100% de ces mouvements dans l'onglet dédié
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-slate-400 text-[11px]">Par page :</span>
                    <select
                      value={movementsPageSize}
                      onChange={(e) => {
                        setMovementsPageSize(Number(e.target.value));
                        setMovementsPage(1);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={filteredMovementRows.length}>Tous ({filteredMovementRows.length})</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={movementsPage <= 1}
                    onClick={() => setMovementsPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-700 cursor-pointer"
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-slate-800 px-1">
                    {movementsPage} / {totalMovementPages}
                  </span>

                  <button
                    type="button"
                    disabled={movementsPage >= totalMovementPages}
                    onClick={() => setMovementsPage(p => Math.min(totalMovementPages, p + 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-700 cursor-pointer"
                    title="Page suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-TAB 3: SYNTHÈSE & BILAN MATIÈRES */}
        {/* ==================================================== */}
        {activeSubTab === 'summary' && (
          <div className="space-y-6">
            
            {/* Table 1: Réconciliation des matières */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider">
                  1. Tableau de Réconciliation des Stocks (Liasse Comptable)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-900 text-white font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Poste de Bilan</th>
                      <th className="py-2.5 px-4 text-right">Quantité (Bouteilles)</th>
                      <th className="py-2.5 px-4 text-right">Valeur au Coût d'Achat (€ HT)</th>
                      <th className="py-2.5 px-4">Description pour le Cabinet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">Stock Initial (Début de mois)</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{summary.totalBottlesStart} bt</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{formatCurrencyFr(summary.totalValueStartHt)}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">Arrêté au {summary.startDate.toLocaleDateString('fr-FR')} à 00:00</td>
                    </tr>
                    <tr className="bg-emerald-50/30">
                      <td className="py-3 px-4 font-bold text-emerald-800">(+) Achats / Entrées de la période</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">+{summary.totalBottlesIn} bt</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">+{formatCurrencyFr(summary.totalValueInHt)}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">Factures fournisseurs et réassorts valorisés au coût d'achat</td>
                    </tr>
                    <tr className="bg-rose-50/30">
                      <td className="py-3 px-4 font-bold text-rose-800">(-) Consommations / Sorties de la période</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">-{summary.totalBottlesOut} bt</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">-{formatCurrencyFr(summary.totalValueOutHt)}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">Sorties de cave (service restaurant, casse, pertes)</td>
                    </tr>
                    <tr className="bg-emerald-100/50 font-bold border-t-2 border-emerald-600">
                      <td className="py-3.5 px-4 text-slate-900 text-sm">(=) Stock Final Réel (Fin de mois)</td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm text-slate-900">{summary.totalBottlesEnd} bt</td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm text-emerald-800 font-black">{formatCurrencyFr(summary.totalValueEndHt)}</td>
                      <td className="py-3.5 px-4 text-emerald-900 font-mono text-[11px]">Valeur officielle de clôture de stock pour le comptable</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-700">Variation Nette du Stock</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${summary.totalBottlesNetChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {summary.totalBottlesNetChange >= 0 ? '+' : ''}{summary.totalBottlesNetChange} bt
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${summary.totalValueNetChangeHt >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {summary.totalValueNetChangeHt >= 0 ? '+' : ''}{formatCurrencyFr(summary.totalValueNetChangeHt)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {summary.totalValueNetChangeHt >= 0 ? 'Sur-stockage / Investissement net' : 'Déstockage net sur la période'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2 & 3: Breakdown by Site & by Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* By Site */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  <h4 className="text-xs font-bold text-slate-900 font-mono uppercase">
                    2. Répartition de la Valeur par Site
                  </h4>
                </div>

                <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-mono text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Site</th>
                      <th className="py-2 px-2 text-right">Bouteilles</th>
                      <th className="py-2 px-3 text-right">Valeur Stock HT</th>
                      <th className="py-2 px-2 text-right">Part (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.breakdownBySite.map(s => (
                      <tr key={s.siteId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{s.siteName}</td>
                        <td className="py-2 px-2 text-right font-mono">{s.bottles} bt</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{formatCurrencyFr(s.valueHt)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-500">{s.sharePercent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* By Category */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <WineIcon className="w-4 h-4 text-slate-600" />
                  <h4 className="text-xs font-bold text-slate-900 font-mono uppercase">
                    3. Répartition de la Valeur par Catégorie
                  </h4>
                </div>

                <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-mono text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Catégorie</th>
                      <th className="py-2 px-2 text-right">Bouteilles</th>
                      <th className="py-2 px-3 text-right">Valeur Stock HT</th>
                      <th className="py-2 px-2 text-right">Part (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.breakdownByColor.map(c => (
                      <tr key={c.color} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{c.colorLabel}</td>
                        <td className="py-2 px-2 text-right font-mono">{c.bottles} bt</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{formatCurrencyFr(c.valueHt)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-500">{c.sharePercent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* 5. Modal: Quick Buy Price Update */}
      {editingWinePrice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Mise à jour Prix d'Achat
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {editingWinePrice.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ce prix d'achat HT servira au calcul de la valeur du stock pour le comptable et sera propagé à toutes les bouteilles de cette référence.
              </p>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 mb-1">
                  Nouveau Prix d'Achat Unitaire HT (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    required
                    placeholder="Ex: 24.50"
                    value={newPriceInput}
                    onChange={(e) => setNewPriceInput(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 pr-8 text-sm font-mono font-bold outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">€</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWinePrice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingPrice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
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
