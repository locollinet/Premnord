import { 
  Wine, 
  Movement, 
  Site, 
  WineColor, 
  isDPRWine, 
  getCanonicalDomain,
  getWineReferenceKey,
  normalizeWineString,
  extractWineFormat
} from '../types';

export interface MonthOption {
  year: number;
  month: number; // 1 - 12
  key: string; // "2026-09"
  label: string; // "Septembre 2026"
  shortLabel: string; // "Sep 2026"
  startMs: number;
  endMs: number;
  isCurrent: boolean;
}

export interface WineStockAccountingRow {
  wineId: string;
  referenceKey: string;
  domain: string;
  name: string;
  cuvee?: string;
  appellation?: string;
  vintage: string;
  color: WineColor;
  format: string;
  siteId: string;
  siteName: string;
  bin?: string;
  
  // Multi-site reference consolidation metadata
  siteCount?: number;
  sitesSummary?: string;
  siteDetails?: Array<{
    siteId: string;
    siteName: string;
    bin?: string;
    startStock: number;
    inQuantity: number;
    outQuantity: number;
    endStock: number;
  }>;
  wineIds?: string[];
  isConsolidated?: boolean;
  
  // Quantities
  startStock: number; // Stock début de mois (bt)
  inQuantity: number; // Entrées du mois (bt)
  outQuantity: number; // Sorties du mois (bt)
  endStock: number; // Stock fin de mois (bt)
  netQuantityChange: number; // endStock - startStock
  
  // Valuation
  buyPriceHt: number; // Prix achat unitaire HT (€)
  sellPriceTtc?: number; // Prix vente unitaire TTC (€)
  startValueHt: number; // Valeur achat stock début (€ HT)
  endValueHt: number; // Valeur achat stock fin (€ HT) = buyPrice * endStock
  inValueHt: number; // Valeur entrées (€ HT)
  outValueHt: number; // Valeur sorties (€ HT)
  netValueChangeHt: number; // endValueHt - startValueHt
  
  hasMissingBuyPrice: boolean; // Flag if stock > 0 but buy price is 0
  wine: Wine;
}

export interface MovementAccountingRow {
  id: string;
  date: Date;
  dateStr: string;
  wineId: string;
  wineName: string;
  domain: string;
  vintage: string;
  color?: WineColor;
  type: 'in' | 'out' | 'transfer' | 'correction';
  typeLabel: string;
  quantity: number;
  reason: string;
  reasonLabel: string;
  fromSiteId?: string;
  fromSiteName?: string;
  toSiteId?: string;
  toSiteName?: string;
  buyPriceHt: number;
  totalValueHt: number;
  userName: string;
  notes?: string;
}

export interface AccountingPeriodSummary {
  periodLabel: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  siteFilterName: string;
  domainFilterName?: string;
  
  // Total Quantities
  totalBottlesStart: number;
  totalBottlesIn: number;
  totalBottlesOut: number;
  totalBottlesEnd: number;
  totalBottlesNetChange: number;
  
  // Total Valuations
  totalValueStartHt: number;
  totalValueInHt: number;
  totalValueOutHt: number;
  totalValueEndHt: number; // La valeur totale du stock demandée par le comptable !
  totalValueNetChangeHt: number;
  
  // References count
  totalReferencesCount: number;
  referencesWithStockCount: number;
  referencesWithMissingPriceCount: number;
  
  // Breakdowns
  breakdownBySite: Array<{
    siteId: string;
    siteName: string;
    bottles: number;
    valueHt: number;
    sharePercent: number;
  }>;
  
  breakdownByColor: Array<{
    color: WineColor;
    colorLabel: string;
    bottles: number;
    valueHt: number;
    sharePercent: number;
  }>;
}

// Generate the list of selectable accounting months (e.g. past 24 months + current + future)
export function getAvailableMonths(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const shortMonthNames = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
  ];

  // From 24 months ago to +2 months ahead
  const startOffset = -24;
  const endOffset = 1;

  for (let offset = endOffset; offset >= startOffset; offset--) {
    const d = new Date(currentYear, currentMonth - 1 + offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;

    const startMs = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
    const endMs = new Date(y, m, 0, 23, 59, 59, 999).getTime();
    const isCurrent = y === currentYear && m === currentMonth;

    months.push({
      year: y,
      month: m,
      key: `${y}-${m.toString().padStart(2, '0')}`,
      label: `${monthNames[m - 1]} ${y}`,
      shortLabel: `${shortMonthNames[m - 1]} ${y}`,
      startMs,
      endMs,
      isCurrent
    });
  }

  return months;
}

/**
 * Creates a custom accounting period option for arbitrary start and end dates
 */
export function createCustomPeriodOption(startDateStr: string, endDateStr: string): MonthOption {
  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const start = new Date(startYear, (startMonth || 1) - 1, startDay || 1, 0, 0, 0, 0);
  const end = new Date(endYear, (endMonth || 1) - 1, endDay || 1, 23, 59, 59, 999);

  const formatFrDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const label = `Du ${formatFrDate(start)} au ${formatFrDate(end)}`;
  const shortLabel = `${formatFrDate(start).slice(0, 5)} - ${formatFrDate(end)}`;

  return {
    year: end.getFullYear(),
    month: end.getMonth() + 1,
    key: `custom_${startDateStr}_${endDateStr}`,
    label,
    shortLabel,
    startMs: start.getTime(),
    endMs: end.getTime(),
    isCurrent: false
  };
}

// Helper to extract unit buy price HT reliably
export function getWineBuyPriceHt(wine: Wine): number {
  if (typeof wine.priceBuy === 'number' && wine.priceBuy > 0) {
    return wine.priceBuy;
  }
  if (typeof wine.priceBuyHt === 'number' && wine.priceBuyHt > 0) {
    return wine.priceBuyHt;
  }
  return 0;
}

// Compute the delta in stock applied by a movement for a given wine (O(1) fast path)
function getMovementDeltaForWine(m: Movement, wine: Wine): number {
  const qty = Math.abs(m.quantity || 0);

  // Fast path: movement is explicitly tied to this wineId
  if (m.wineId === wine.id) {
    if (m.type === 'in') return qty;
    if (m.type === 'out') return -qty;
    if (m.type === 'transfer') {
      if (m.fromSiteId === wine.siteId) return -qty;
      if (m.toSiteId === wine.siteId) return qty;
      return 0;
    }
    if (m.type === 'correction') return m.quantity || 0;
    return 0;
  }

  // Fallback for legacy movements
  if (m.type === 'in' && m.toSiteId === wine.siteId && m.wineName && wine.name && m.wineName.toLowerCase() === wine.name.toLowerCase()) {
    return qty;
  }
  if (m.type === 'out' && m.fromSiteId === wine.siteId && m.wineName && wine.name && m.wineName.toLowerCase() === wine.name.toLowerCase()) {
    return -qty;
  }

  return 0;
}

/**
 * Consolidates stock accounting rows by unique wine reference across multiple storage sites.
 * Merges stock début, entrées, sorties, stock fin, valorisation HT, while computing clear sites & bins breakdown.
 */
export function consolidateStockRowsByReference(rows: WineStockAccountingRow[]): WineStockAccountingRow[] {
  const groups = new Map<string, WineStockAccountingRow[]>();

  rows.forEach(row => {
    // Canonical reference key across all sites
    const key = getWineReferenceKey(row.wine) || `${normalizeWineString(getCanonicalDomain(row.domain))}__${normalizeWineString(row.name)}__${(row.vintage || '').toLowerCase()}__${row.color}__${extractWineFormat(row.wine)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  const consolidated: WineStockAccountingRow[] = [];

  groups.forEach((group, refKey) => {
    if (group.length === 1) {
      const single = group[0];
      consolidated.push({
        ...single,
        siteCount: 1,
        sitesSummary: `${single.siteName.split(' - ')[0]}${single.bin ? ` (${single.bin})` : ''}`,
        wineIds: [single.wineId],
        isConsolidated: false,
        siteDetails: [{
          siteId: single.siteId,
          siteName: single.siteName,
          bin: single.bin,
          startStock: single.startStock,
          inQuantity: single.inQuantity,
          outQuantity: single.outQuantity,
          endStock: single.endStock
        }]
      });
      return;
    }

    // Multiple sites for the same reference
    const primary = group[0];
    const totalStartStock = group.reduce((sum, r) => sum + r.startStock, 0);
    const totalInQuantity = group.reduce((sum, r) => sum + r.inQuantity, 0);
    const totalOutQuantity = group.reduce((sum, r) => sum + r.outQuantity, 0);
    const totalEndStock = group.reduce((sum, r) => sum + r.endStock, 0);
    const totalStartValueHt = group.reduce((sum, r) => sum + r.startValueHt, 0);
    const totalEndValueHt = group.reduce((sum, r) => sum + r.endValueHt, 0);
    const totalInValueHt = group.reduce((sum, r) => sum + r.inValueHt, 0);
    const totalOutValueHt = group.reduce((sum, r) => sum + r.outValueHt, 0);

    const netQuantityChange = totalEndStock - totalStartStock;
    const netValueChangeHt = totalEndValueHt - totalStartValueHt;

    // Unit buy price HT calculation
    let unitBuyPriceHt = 0;
    if (totalEndStock > 0 && totalEndValueHt > 0) {
      unitBuyPriceHt = totalEndValueHt / totalEndStock;
    } else {
      const rowWithPrice = group.find(r => r.buyPriceHt > 0);
      unitBuyPriceHt = rowWithPrice ? rowWithPrice.buyPriceHt : primary.buyPriceHt;
    }

    // Summary of sites and bins
    const distinctSites = new Map<string, { name: string; endQty: number; bins: Set<string> }>();
    group.forEach(r => {
      const shortName = r.siteName.split(' - ')[0];
      if (!distinctSites.has(r.siteId)) {
        distinctSites.set(r.siteId, { name: shortName, endQty: 0, bins: new Set() });
      }
      const entry = distinctSites.get(r.siteId)!;
      entry.endQty += r.endStock;
      if (r.bin) entry.bins.add(r.bin);
    });

    const activeSiteParts: string[] = [];
    distinctSites.forEach(s => {
      const binsStr = s.bins.size > 0 ? ` [${Array.from(s.bins).join(', ')}]` : '';
      activeSiteParts.push(`${s.name}: ${s.endQty} bt${binsStr}`);
    });

    const sitesSummary = activeSiteParts.length > 0
      ? activeSiteParts.join(' • ')
      : `${group.length} sites`;

    const distinctBins = Array.from(new Set(group.map(r => r.bin).filter(Boolean)));
    const binStr = distinctBins.length > 0 ? distinctBins.join(', ') : undefined;

    consolidated.push({
      wineId: primary.wineId,
      referenceKey: refKey,
      domain: primary.domain,
      name: primary.name,
      cuvee: primary.cuvee || group.find(r => r.cuvee)?.cuvee,
      appellation: primary.appellation || group.find(r => r.appellation)?.appellation,
      vintage: primary.vintage,
      color: primary.color,
      format: primary.format,
      siteId: 'multi',
      siteName: `Multi-sites (${group.length})`,
      siteCount: group.length,
      sitesSummary,
      bin: binStr,
      startStock: totalStartStock,
      inQuantity: totalInQuantity,
      outQuantity: totalOutQuantity,
      endStock: totalEndStock,
      netQuantityChange,
      buyPriceHt: Number(unitBuyPriceHt.toFixed(2)),
      sellPriceTtc: primary.sellPriceTtc || group.find(r => r.sellPriceTtc)?.sellPriceTtc,
      startValueHt: Number(totalStartValueHt.toFixed(2)),
      endValueHt: Number(totalEndValueHt.toFixed(2)),
      inValueHt: Number(totalInValueHt.toFixed(2)),
      outValueHt: Number(totalOutValueHt.toFixed(2)),
      netValueChangeHt: Number(netValueChangeHt.toFixed(2)),
      hasMissingBuyPrice: totalEndStock > 0 && unitBuyPriceHt === 0,
      wine: primary.wine,
      wineIds: group.map(r => r.wineId),
      isConsolidated: true,
      siteDetails: group.map(g => ({
        siteId: g.siteId,
        siteName: g.siteName,
        bin: g.bin,
        startStock: g.startStock,
        inQuantity: g.inQuantity,
        outQuantity: g.outQuantity,
        endStock: g.endStock
      }))
    });
  });

  consolidated.sort((a, b) => {
    const dComp = a.domain.localeCompare(b.domain, 'fr');
    if (dComp !== 0) return dComp;
    const nComp = a.name.localeCompare(b.name, 'fr');
    if (nComp !== 0) return nComp;
    return a.vintage.localeCompare(b.vintage, 'fr');
  });

  return consolidated;
}

/**
 * Calculates stock at beginning of month, movements during the month, and stock at end of month
 * for every wine in the cellar.
 */
export function calculateCellarAccounting(
  wines: Wine[],
  movements: Movement[],
  selectedMonth: MonthOption,
  sites: Site[],
  siteFilter: string = 'all',
  domainFilter: string = 'all'
): {
  stockRows: WineStockAccountingRow[];
  consolidatedStockRows: WineStockAccountingRow[];
  movementRows: MovementAccountingRow[];
  summary: AccountingPeriodSummary;
} {
  const { startMs, endMs, year, month, label } = selectedMonth;
  const nowMs = Date.now();
  const isPastMonth = endMs < nowMs;

  const sitesMap = new Map<string, string>();
  sites.forEach(s => sitesMap.set(s.id, s.name));

  // 1. Filter wines by site and domain if requested
  let targetWines = siteFilter === 'all' 
    ? wines 
    : wines.filter(w => w.siteId === siteFilter);

  if (domainFilter === 'prieure_roch') {
    targetWines = targetWines.filter(w => isDPRWine(w));
  } else if (domainFilter !== 'all') {
    const targetDomain = domainFilter.trim().toLowerCase();
    targetWines = targetWines.filter(w => {
      const d = (w.domain || '').trim().toLowerCase();
      const canon = getCanonicalDomain(w.domain).toLowerCase();
      return d === targetDomain || canon === targetDomain;
    });
  }

  // Group movements related to wines
  const movementsByWineId = new Map<string, Movement[]>();
  movements.forEach(m => {
    if (!movementsByWineId.has(m.wineId)) {
      movementsByWineId.set(m.wineId, []);
    }
    movementsByWineId.get(m.wineId)!.push(m);
  });

  // Calculate stock rows
  const stockRows: WineStockAccountingRow[] = targetWines.map(wine => {
    const buyPriceHt = getWineBuyPriceHt(wine);
    const wineMovements = movementsByWineId.get(wine.id) || [];

    // Movements that occurred AFTER the end of the selected month
    let deltaAfterMonthEnd = 0;
    if (isPastMonth) {
      wineMovements.forEach(m => {
        if (m.createdAt > endMs) {
          deltaAfterMonthEnd += getMovementDeltaForWine(m, wine);
        }
      });
    }

    // Stock at the end of the selected month
    // If past month, rewind from current stock by undoing post-month movements
    let endStock = isPastMonth 
      ? wine.quantity - deltaAfterMonthEnd 
      : wine.quantity;
    if (endStock < 0) endStock = 0;

    // Movements that occurred DURING the month [startMs, endMs]
    let inQuantity = 0;
    let outQuantity = 0;

    wineMovements.forEach(m => {
      if (m.createdAt >= startMs && m.createdAt <= endMs) {
        const delta = getMovementDeltaForWine(m, wine);
        if (delta > 0) {
          inQuantity += delta;
        } else if (delta < 0) {
          outQuantity += Math.abs(delta);
        }
      }
    });

    // Stock at the beginning of the month:
    // startStock + inQuantity - outQuantity = endStock
    // => startStock = endStock - inQuantity + outQuantity
    let startStock = endStock - inQuantity + outQuantity;
    if (startStock < 0) startStock = 0;

    const startValueHt = startStock * buyPriceHt;
    const endValueHt = endStock * buyPriceHt;
    const inValueHt = inQuantity * buyPriceHt;
    const outValueHt = outQuantity * buyPriceHt;
    const netQuantityChange = endStock - startStock;
    const netValueChangeHt = endValueHt - startValueHt;

    const siteName = sitesMap.get(wine.siteId) || 'Site Inconnu';
    const hasMissingBuyPrice = endStock > 0 && buyPriceHt === 0;

    return {
      wineId: wine.id,
      referenceKey: `${wine.domain}__${wine.name}__${wine.vintage}__${wine.color}__${wine.siteId}`,
      domain: wine.domain || 'Domaine Inconnu',
      name: wine.name || 'Sans Nom',
      cuvee: wine.cuvee,
      appellation: wine.appellation,
      vintage: wine.vintage || 'S.A.',
      color: wine.color || 'autre',
      format: wine.format || 'Bouteille 75cl',
      siteId: wine.siteId,
      siteName,
      bin: wine.bin,
      startStock,
      inQuantity,
      outQuantity,
      endStock,
      netQuantityChange,
      buyPriceHt,
      sellPriceTtc: wine.priceSell,
      startValueHt,
      endValueHt,
      inValueHt,
      outValueHt,
      netValueChangeHt,
      hasMissingBuyPrice,
      wine
    };
  });

  // Sort stock rows by Domain, Appellation, Vintage
  stockRows.sort((a, b) => {
    const dComp = a.domain.localeCompare(b.domain, 'fr');
    if (dComp !== 0) return dComp;
    const nComp = a.name.localeCompare(b.name, 'fr');
    if (nComp !== 0) return nComp;
    return a.vintage.localeCompare(b.vintage, 'fr');
  });

  // 2. Filter movements that occurred during the selected month
  const winesMap = new Map<string, Wine>();
  wines.forEach(w => winesMap.set(w.id, w));

  const monthMovements = movements.filter(m => {
    if (m.createdAt < startMs || m.createdAt > endMs) return false;
    if (siteFilter !== 'all' && m.fromSiteId !== siteFilter && m.toSiteId !== siteFilter) {
      return false;
    }

    if (domainFilter !== 'all') {
      const w = winesMap.get(m.wineId);
      if (domainFilter === 'prieure_roch') {
        if (w) return isDPRWine(w);
        const text = `${m.wineName || ''} ${m.notes || ''}`.toLowerCase();
        return text.includes('prieure') || text.includes('roch') || text.includes('dpr');
      } else {
        const targetDomain = domainFilter.trim().toLowerCase();
        if (w) {
          const d = (w.domain || '').trim().toLowerCase();
          const canon = getCanonicalDomain(w.domain).toLowerCase();
          return d === targetDomain || canon === targetDomain;
        }
        return (m.wineName || '').toLowerCase().includes(targetDomain);
      }
    }

    return true;
  });

  const REASON_LABELS: Record<string, string> = {
    livraison: 'Livraison fournisseur',
    vente: 'Vente en salle / service',
    casse: 'Casse / Bouteille perdue',
    correction: 'Correction inventaire',
    transfert: 'Transfert de cave',
    autre: 'Autre mouvement'
  };

  const TYPE_LABELS: Record<string, string> = {
    in: 'Entrée (+)',
    out: 'Sortie (-)',
    transfer: 'Transfert',
    correction: 'Correction'
  };

  const movementRows: MovementAccountingRow[] = monthMovements.map(m => {
    const wine = winesMap.get(m.wineId);
    const buyPriceHt = wine ? getWineBuyPriceHt(wine) : 0;
    const totalValueHt = Math.abs(m.quantity) * buyPriceHt;
    const date = new Date(m.createdAt);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      id: m.id,
      date,
      dateStr,
      wineId: m.wineId,
      wineName: m.wineName || wine?.name || 'Vin',
      domain: wine?.domain || 'Domaine',
      vintage: wine?.vintage || '',
      color: wine?.color,
      type: m.type,
      typeLabel: TYPE_LABELS[m.type] || m.type,
      quantity: m.quantity,
      reason: m.reason,
      reasonLabel: REASON_LABELS[m.reason] || m.reason,
      fromSiteId: m.fromSiteId,
      fromSiteName: m.fromSiteId ? (sitesMap.get(m.fromSiteId) || m.fromSiteId) : undefined,
      toSiteId: m.toSiteId,
      toSiteName: m.toSiteId ? (sitesMap.get(m.toSiteId) || m.toSiteId) : undefined,
      buyPriceHt,
      totalValueHt,
      userName: m.userName || 'Utilisateur',
      notes: m.notes
    };
  });

  // Sort movements chronologically (most recent first)
  movementRows.sort((a, b) => b.date.getTime() - a.date.getTime());

  // 3. Compute general summary metrics
  const totalBottlesStart = stockRows.reduce((sum, r) => sum + r.startStock, 0);
  const totalBottlesIn = stockRows.reduce((sum, r) => sum + r.inQuantity, 0);
  const totalBottlesOut = stockRows.reduce((sum, r) => sum + r.outQuantity, 0);
  const totalBottlesEnd = stockRows.reduce((sum, r) => sum + r.endStock, 0);
  const totalBottlesNetChange = totalBottlesEnd - totalBottlesStart;

  const totalValueStartHt = stockRows.reduce((sum, r) => sum + r.startValueHt, 0);
  const totalValueInHt = stockRows.reduce((sum, r) => sum + r.inValueHt, 0);
  const totalValueOutHt = stockRows.reduce((sum, r) => sum + r.outValueHt, 0);
  const totalValueEndHt = stockRows.reduce((sum, r) => sum + r.endValueHt, 0);
  const totalValueNetChangeHt = totalValueEndHt - totalValueStartHt;

  const totalReferencesCount = stockRows.length;
  const referencesWithStockCount = stockRows.filter(r => r.endStock > 0).length;
  const referencesWithMissingPriceCount = stockRows.filter(r => r.hasMissingBuyPrice).length;

  // Breakdown by Site
  const siteTotals = new Map<string, { bottles: number; valueHt: number }>();
  sites.forEach(s => siteTotals.set(s.id, { bottles: 0, valueHt: 0 }));
  stockRows.forEach(r => {
    const curr = siteTotals.get(r.siteId) || { bottles: 0, valueHt: 0 };
    curr.bottles += r.endStock;
    curr.valueHt += r.endValueHt;
    siteTotals.set(r.siteId, curr);
  });

  const breakdownBySite = sites.map(s => {
    const st = siteTotals.get(s.id) || { bottles: 0, valueHt: 0 };
    const sharePercent = totalValueEndHt > 0 ? (st.valueHt / totalValueEndHt) * 100 : 0;
    return {
      siteId: s.id,
      siteName: s.name,
      bottles: st.bottles,
      valueHt: st.valueHt,
      sharePercent
    };
  });

  // Breakdown by Color
  const COLOR_NAMES: Record<WineColor, string> = {
    rouge: 'Vins Rouges',
    blanc: 'Vins Blancs',
    rose: 'Vins Rosés',
    bulle: 'Champagnes & Bulles',
    orange: 'Vins Oranges',
    spiritueux: 'Spiritueux',
    cidre_biere: 'Bières & Cidres',
    soft: 'Softs & Sans Alcool',
    autre: 'Autres'
  };

  const colorTotals = new Map<WineColor, { bottles: number; valueHt: number }>();
  (Object.keys(COLOR_NAMES) as WineColor[]).forEach(c => colorTotals.set(c, { bottles: 0, valueHt: 0 }));

  stockRows.forEach(r => {
    const curr = colorTotals.get(r.color) || { bottles: 0, valueHt: 0 };
    curr.bottles += r.endStock;
    curr.valueHt += r.endValueHt;
    colorTotals.set(r.color, curr);
  });

  const breakdownByColor = (Object.keys(COLOR_NAMES) as WineColor[])
    .map(c => {
      const ct = colorTotals.get(c) || { bottles: 0, valueHt: 0 };
      const sharePercent = totalValueEndHt > 0 ? (ct.valueHt / totalValueEndHt) * 100 : 0;
      return {
        color: c,
        colorLabel: COLOR_NAMES[c],
        bottles: ct.bottles,
        valueHt: ct.valueHt,
        sharePercent
      };
    })
    .filter(b => b.bottles > 0 || b.valueHt > 0);

  const siteFilterName = siteFilter === 'all' ? 'Tous les sites (Consolidé)' : (sitesMap.get(siteFilter) || siteFilter);
  const domainFilterName = domainFilter === 'prieure_roch' 
    ? 'Domaine Prieuré-Roch' 
    : (domainFilter !== 'all' ? domainFilter : undefined);

  const consolidatedStockRows = consolidateStockRowsByReference(stockRows);

  return {
    stockRows,
    consolidatedStockRows,
    movementRows,
    summary: {
      periodLabel: label,
      year,
      month,
      startDate: new Date(startMs),
      endDate: new Date(endMs),
      generatedAt: new Date(),
      siteFilterName,
      domainFilterName,
      totalBottlesStart,
      totalBottlesIn,
      totalBottlesOut,
      totalBottlesEnd,
      totalBottlesNetChange,
      totalValueStartHt,
      totalValueInHt,
      totalValueOutHt,
      totalValueEndHt,
      totalValueNetChangeHt,
      totalReferencesCount,
      referencesWithStockCount,
      referencesWithMissingPriceCount,
      breakdownBySite,
      breakdownByColor
    }
  };
}

/**
 * Recomputes accounting summary metrics for an arbitrary subset of filtered stock rows and movement rows.
 * This guarantees that when multiple filters are active, the summary sheets, totals, and KPIs
 * strictly match the filtered perimeter.
 */
export function buildFilteredAccountingSummary(
  stockRows: WineStockAccountingRow[],
  movementRows: MovementAccountingRow[],
  baseSummary: AccountingPeriodSummary,
  sites: Site[],
  customPerimeterLabel?: string
): AccountingPeriodSummary {
  const sitesMap = new Map<string, string>();
  sites.forEach(s => sitesMap.set(s.id, s.name));

  const totalBottlesStart = stockRows.reduce((sum, r) => sum + r.startStock, 0);
  const totalBottlesIn = stockRows.reduce((sum, r) => sum + r.inQuantity, 0);
  const totalBottlesOut = stockRows.reduce((sum, r) => sum + r.outQuantity, 0);
  const totalBottlesEnd = stockRows.reduce((sum, r) => sum + r.endStock, 0);
  const totalBottlesNetChange = totalBottlesEnd - totalBottlesStart;

  const totalValueStartHt = stockRows.reduce((sum, r) => sum + r.startValueHt, 0);
  const totalValueInHt = stockRows.reduce((sum, r) => sum + r.inValueHt, 0);
  const totalValueOutHt = stockRows.reduce((sum, r) => sum + r.outValueHt, 0);
  const totalValueEndHt = stockRows.reduce((sum, r) => sum + r.endValueHt, 0);
  const totalValueNetChangeHt = totalValueEndHt - totalValueStartHt;

  const totalReferencesCount = stockRows.length;
  const referencesWithStockCount = stockRows.filter(r => r.endStock > 0).length;
  const referencesWithMissingPriceCount = stockRows.filter(r => r.hasMissingBuyPrice).length;

  // Breakdown by Site
  const siteTotals = new Map<string, { bottles: number; valueHt: number }>();
  sites.forEach(s => siteTotals.set(s.id, { bottles: 0, valueHt: 0 }));
  stockRows.forEach(r => {
    const curr = siteTotals.get(r.siteId) || { bottles: 0, valueHt: 0 };
    curr.bottles += r.endStock;
    curr.valueHt += r.endValueHt;
    siteTotals.set(r.siteId, curr);
  });

  const breakdownBySite = sites.map(s => {
    const st = siteTotals.get(s.id) || { bottles: 0, valueHt: 0 };
    const sharePercent = totalValueEndHt > 0 ? (st.valueHt / totalValueEndHt) * 100 : 0;
    return {
      siteId: s.id,
      siteName: s.name,
      bottles: st.bottles,
      valueHt: st.valueHt,
      sharePercent
    };
  }).filter(b => b.bottles > 0 || b.valueHt > 0);

  // Breakdown by Color
  const COLOR_NAMES: Record<WineColor, string> = {
    rouge: 'Vins Rouges',
    blanc: 'Vins Blancs',
    rose: 'Vins Rosés',
    bulle: 'Champagnes & Bulles',
    orange: 'Vins Oranges',
    spiritueux: 'Spiritueux',
    cidre_biere: 'Bières & Cidres',
    soft: 'Softs & Sans Alcool',
    autre: 'Autres'
  };

  const colorTotals = new Map<WineColor, { bottles: number; valueHt: number }>();
  (Object.keys(COLOR_NAMES) as WineColor[]).forEach(c => colorTotals.set(c, { bottles: 0, valueHt: 0 }));

  stockRows.forEach(r => {
    const curr = colorTotals.get(r.color) || { bottles: 0, valueHt: 0 };
    curr.bottles += r.endStock;
    curr.valueHt += r.endValueHt;
    colorTotals.set(r.color, curr);
  });

  const breakdownByColor = (Object.keys(COLOR_NAMES) as WineColor[])
    .map(c => {
      const ct = colorTotals.get(c) || { bottles: 0, valueHt: 0 };
      const sharePercent = totalValueEndHt > 0 ? (ct.valueHt / totalValueEndHt) * 100 : 0;
      return {
        color: c,
        colorLabel: COLOR_NAMES[c],
        bottles: ct.bottles,
        valueHt: ct.valueHt,
        sharePercent
      };
    })
    .filter(b => b.bottles > 0 || b.valueHt > 0);

  return {
    ...baseSummary,
    generatedAt: new Date(),
    siteFilterName: customPerimeterLabel || baseSummary.siteFilterName,
    domainFilterName: customPerimeterLabel || baseSummary.domainFilterName,
    totalBottlesStart,
    totalBottlesIn,
    totalBottlesOut,
    totalBottlesEnd,
    totalBottlesNetChange,
    totalValueStartHt,
    totalValueInHt,
    totalValueOutHt,
    totalValueEndHt,
    totalValueNetChangeHt,
    totalReferencesCount,
    referencesWithStockCount,
    referencesWithMissingPriceCount,
    breakdownBySite,
    breakdownByColor
  };
}

/**
 * Format currency to French locale (e.g. "1 250,50 €" or "1,2 M€")
 */
export function formatCurrencyFr(amount: number): string {
  if (isNaN(amount)) return '0,00 €';
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

/**
 * Format large numbers in compact french format (e.g. 1,2 M€)
 */
export function formatCompactCurrencyFr(amount: number): string {
  if (isNaN(amount)) return '0 €';
  if (Math.abs(amount) >= 1_000_000) {
    return (amount / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' M€';
  }
  if (Math.abs(amount) >= 1_000) {
    return (amount / 1_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' k€';
  }
  return formatCurrencyFr(amount);
}
