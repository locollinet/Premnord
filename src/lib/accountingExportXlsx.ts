import * as XLSX from 'xlsx';
import { 
  WineStockAccountingRow, 
  MovementAccountingRow, 
  AccountingPeriodSummary 
} from './accountingCalculations';
import { Wine, Site } from '../types';

export function exportAccountingToExcel(
  stockRows: WineStockAccountingRow[],
  movementRows: MovementAccountingRow[],
  summary: AccountingPeriodSummary,
  filenamePrefix?: string,
  customTitle?: string,
  detailedStockRows?: WineStockAccountingRow[]
) {
  const workbook = XLSX.utils.book_new();

  // If a domain filter was applied, personalize the title & filename
  const isDomainFiltered = Boolean(summary.domainFilterName);
  const defaultPrefix = isDomainFiltered
    ? `Extraction_${summary.domainFilterName!.replace(/[^a-zA-Z0-9]/g, '_')}`
    : 'Extraction_Comptable_Premnord';
  const prefix = filenamePrefix || defaultPrefix;

  // ==========================================
  // SHEET 1: STOCK CONSOLIDÉ PAR RÉFÉRENCE (OU PAR SITE)
  // ==========================================
  const stockSheetAoa: any[][] = [];

  // Title & Metadata header
  const titleText = customTitle || (isDomainFiltered 
    ? `PREMNORD - ÉTAT DE STOCK & VALORISATION : ${summary.domainFilterName!.toUpperCase()}`
    : 'PREMNORD - ÉTAT DE STOCK & VALORISATION COMPTABLE DE LA CAVE');

  stockSheetAoa.push([titleText]);
  stockSheetAoa.push([`Période comptable : ${summary.periodLabel} (du ${summary.startDate.toLocaleDateString('fr-FR')} au ${summary.endDate.toLocaleDateString('fr-FR')})`]);
  if (isDomainFiltered) {
    stockSheetAoa.push([`Domaine ciblé : ${summary.domainFilterName}`]);
  }
  stockSheetAoa.push([`Périmètre sites : ${summary.siteFilterName}`]);
  stockSheetAoa.push([`Date de génération : ${summary.generatedAt.toLocaleString('fr-FR')}`]);
  stockSheetAoa.push([
    `VALEUR TOTALE DU STOCK (Fin de mois) : ${summary.totalValueEndHt.toFixed(2)} € HT`,
    '',
    `STOCK TOTAL : ${summary.totalBottlesEnd} bouteilles`,
    '',
    `VALEUR DÉBUT : ${summary.totalValueStartHt.toFixed(2)} € HT`
  ]);
  stockSheetAoa.push([]); // Empty row separator

  // Table Headers
  const stockHeaders = [
    'ID Réf',
    'Domaine',
    'Nom / Appellation',
    'Cuvée',
    'Millésime',
    'Couleur / Catégorie',
    'Format',
    'Sites & Emplacements',
    'Emplacement (Casiers)',
    'Stock Début Mois (bt)',
    'Entrées Mois (+)',
    'Sorties Mois (-)',
    'Stock Fin Mois (bt)',
    'Prix Achat Unit. HT (€)',
    'Valeur Achat Début (€ HT)',
    'Valeur Achat Fin (€ HT)',
    'Variation Valeur (€ HT)',
    'Prix Vente Unit. TTC (€)'
  ];
  stockSheetAoa.push(stockHeaders);

  // Table Data Rows
  stockRows.forEach(r => {
    stockSheetAoa.push([
      r.wineId.substring(0, 8),
      r.domain,
      r.name,
      r.cuvee || '',
      r.vintage,
      r.color.toUpperCase(),
      r.format,
      r.sitesSummary || r.siteName,
      r.bin || '',
      r.startStock,
      r.inQuantity,
      r.outQuantity,
      r.endStock,
      Number(r.buyPriceHt.toFixed(2)),
      Number(r.startValueHt.toFixed(2)),
      Number(r.endValueHt.toFixed(2)),
      Number(r.netValueChangeHt.toFixed(2)),
      r.sellPriceTtc !== undefined ? Number(r.sellPriceTtc.toFixed(2)) : ''
    ]);
  });

  // Table TOTAL Row
  stockSheetAoa.push([]);
  stockSheetAoa.push([
    'TOTAL GÉNÉRAL',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    summary.totalBottlesStart,
    summary.totalBottlesIn,
    summary.totalBottlesOut,
    summary.totalBottlesEnd,
    '',
    Number(summary.totalValueStartHt.toFixed(2)),
    Number(summary.totalValueEndHt.toFixed(2)), // Valeur totale du stock
    Number(summary.totalValueNetChangeHt.toFixed(2)),
    ''
  ]);

  const stockWorksheet = XLSX.utils.aoa_to_sheet(stockSheetAoa);

  // Set explicit column widths
  stockWorksheet['!cols'] = [
    { wch: 12 }, // ID Réf
    { wch: 28 }, // Domaine
    { wch: 34 }, // Nom
    { wch: 20 }, // Cuvée
    { wch: 10 }, // Millésime
    { wch: 18 }, // Couleur
    { wch: 14 }, // Format
    { wch: 38 }, // Sites & Emplacements
    { wch: 18 }, // Emplacement
    { wch: 20 }, // Stock Début
    { wch: 16 }, // Entrées
    { wch: 16 }, // Sorties
    { wch: 20 }, // Stock Fin
    { wch: 22 }, // Prix Achat HT
    { wch: 24 }, // Valeur Début HT
    { wch: 24 }, // Valeur Fin HT (Prix achat * bt)
    { wch: 22 }, // Variation Valeur HT
    { wch: 22 }  // Prix Vente TTC
  ];

  XLSX.utils.book_append_sheet(workbook, stockWorksheet, 'Stock_par_Reference');

  // ==========================================
  // SHEET 2 (OPTIONNEL) : DÉTAIL PAR SITE PHYSIQUE
  // ==========================================
  if (detailedStockRows && detailedStockRows.length > 0) {
    const detailSheetAoa: any[][] = [];
    detailSheetAoa.push(['PREMNORD - DÉTAIL DU STOCK PAR SITE PHYSIQUE ET CASIER']);
    detailSheetAoa.push([`Période comptable : ${summary.periodLabel}`]);
    detailSheetAoa.push([]);

    const detailHeaders = [
      'ID Réf',
      'Domaine',
      'Nom / Appellation',
      'Cuvée',
      'Millésime',
      'Couleur',
      'Format',
      'Site de Stockage',
      'Emplacement (Casier)',
      'Stock Début (bt)',
      'Entrées (+)',
      'Sorties (-)',
      'Stock Fin (bt)',
      'Prix Achat Unit. HT (€)',
      'Valeur Stock Fin (€ HT)'
    ];
    detailSheetAoa.push(detailHeaders);

    detailedStockRows.forEach(r => {
      detailSheetAoa.push([
        r.wineId.substring(0, 8),
        r.domain,
        r.name,
        r.cuvee || '',
        r.vintage,
        r.color.toUpperCase(),
        r.format,
        r.siteName,
        r.bin || '',
        r.startStock,
        r.inQuantity,
        r.outQuantity,
        r.endStock,
        Number(r.buyPriceHt.toFixed(2)),
        Number(r.endValueHt.toFixed(2))
      ]);
    });

    const detailWorksheet = XLSX.utils.aoa_to_sheet(detailSheetAoa);
    detailWorksheet['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 34 }, { wch: 20 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Detail_par_Site');
  }

  // ==========================================
  // SHEET 2: MOUVEMENTS
  // ==========================================
  const movementsSheetAoa: any[][] = [];

  movementsSheetAoa.push(['PREMNORD - REGISTRE DES MOUVEMENTS DE STOCK']);
  movementsSheetAoa.push([`Période : ${summary.periodLabel}`]);
  movementsSheetAoa.push([`Nombre de mouvements enregistrés : ${movementRows.length}`]);
  movementsSheetAoa.push([]);

  const movementHeaders = [
    'Date & Heure',
    'Référence Vin',
    'Domaine',
    'Millésime',
    'Type Mouvement',
    'Quantité (bt)',
    'Motif du Mouvement',
    'Site Source',
    'Site Destination',
    'Prix Achat Unit. HT (€)',
    'Valeur Mouvement (€ HT)',
    'Opérateur',
    'Justificatif / Notes'
  ];
  movementsSheetAoa.push(movementHeaders);

  let totalInQty = 0;
  let totalOutQty = 0;
  let totalInValue = 0;
  let totalOutValue = 0;

  movementRows.forEach(m => {
    if (m.type === 'in') {
      totalInQty += m.quantity;
      totalInValue += m.totalValueHt;
    } else if (m.type === 'out') {
      totalOutQty += m.quantity;
      totalOutValue += m.totalValueHt;
    }

    movementsSheetAoa.push([
      m.dateStr,
      m.wineName,
      m.domain,
      m.vintage,
      m.typeLabel,
      m.quantity,
      m.reasonLabel,
      m.fromSiteName || '',
      m.toSiteName || '',
      Number(m.buyPriceHt.toFixed(2)),
      Number(m.totalValueHt.toFixed(2)),
      m.userName,
      m.notes || ''
    ]);
  });

  // Movement totals row
  movementsSheetAoa.push([]);
  movementsSheetAoa.push([
    'TOTAL ENTRÉES DU MOIS',
    '',
    '',
    '',
    'Entrées',
    totalInQty,
    '',
    '',
    '',
    '',
    Number(totalInValue.toFixed(2)),
    '',
    ''
  ]);
  movementsSheetAoa.push([
    'TOTAL SORTIES DU MOIS',
    '',
    '',
    '',
    'Sorties',
    totalOutQty,
    '',
    '',
    '',
    '',
    Number(totalOutValue.toFixed(2)),
    '',
    ''
  ]);

  const movementsWorksheet = XLSX.utils.aoa_to_sheet(movementsSheetAoa);

  movementsWorksheet['!cols'] = [
    { wch: 18 }, // Date
    { wch: 32 }, // Réf Vin
    { wch: 26 }, // Domaine
    { wch: 10 }, // Millésime
    { wch: 16 }, // Type
    { wch: 14 }, // Quantité
    { wch: 24 }, // Motif
    { wch: 20 }, // Site Source
    { wch: 20 }, // Site Dest
    { wch: 22 }, // Prix Achat HT
    { wch: 22 }, // Valeur Mouvement
    { wch: 20 }, // Opérateur
    { wch: 36 }  // Notes
  ];

  XLSX.utils.book_append_sheet(workbook, movementsWorksheet, 'Mouvements');

  // ==========================================
  // SHEET 3: SYNTHÈSE COMPTABLE
  // ==========================================
  const summarySheetAoa: any[][] = [];

  summarySheetAoa.push(['PREMNORD - SYNTHÈSE COMPTABLE ET BILAN DES MATIÈRES']);
  summarySheetAoa.push([`Période comptable : ${summary.periodLabel}`]);
  summarySheetAoa.push([`Date de l'arrêté de stock : ${summary.generatedAt.toLocaleString('fr-FR')}`]);
  summarySheetAoa.push([]);

  // Section 1: Tableau de réconciliation des stocks
  summarySheetAoa.push(['1. ÉVOLUTION DU STOCK MATIÈRES (BILAN COMPTABLE)']);
  summarySheetAoa.push(['Poste Comptable', 'Quantité (Bouteilles)', 'Valeur Totale (€ HT)', 'Remarques']);
  summarySheetAoa.push([
    'Stock Initial (Début de mois)',
    summary.totalBottlesStart,
    Number(summary.totalValueStartHt.toFixed(2)),
    'Arrêté au 01 du mois 00:00'
  ]);
  summarySheetAoa.push([
    '(+) Achats / Entrées de la période',
    summary.totalBottlesIn,
    Number(summary.totalValueInHt.toFixed(2)),
    'Livraisons fournisseurs & réassorts valorisés au coût d\'achat'
  ]);
  summarySheetAoa.push([
    '(-) Consommations / Sorties de la période',
    summary.totalBottlesOut,
    Number(summary.totalValueOutHt.toFixed(2)),
    'Ventes restaurant, pertes et casses au coût d\'achat'
  ]);
  summarySheetAoa.push([
    '(=) Stock Final Réel (Fin de mois)',
    summary.totalBottlesEnd,
    Number(summary.totalValueEndHt.toFixed(2)),
    'Valeur d\'inventaire certifiée pour la clôture comptable'
  ]);
  summarySheetAoa.push([
    'Variation Nette de la Période',
    summary.totalBottlesNetChange,
    Number(summary.totalValueNetChangeHt.toFixed(2)),
    summary.totalValueNetChangeHt >= 0 ? 'Variation positive (croissance stock)' : 'Déstockage net'
  ]);

  summarySheetAoa.push([]);
  summarySheetAoa.push([]);

  // Section 2: Répartition par site
  summarySheetAoa.push(['2. RÉPARTITION DE LA VALEUR PAR SITE DE STOCKAGE']);
  summarySheetAoa.push(['Site de Stockage', 'Nombre de Bouteilles', 'Valeur Stock (€ HT)', 'Part du Stock (%)']);
  summary.breakdownBySite.forEach(s => {
    summarySheetAoa.push([
      s.siteName,
      s.bottles,
      Number(s.valueHt.toFixed(2)),
      Number(s.sharePercent.toFixed(1)) + '%'
    ]);
  });
  summarySheetAoa.push([
    'TOTAL SITES',
    summary.totalBottlesEnd,
    Number(summary.totalValueEndHt.toFixed(2)),
    '100.0%'
  ]);

  summarySheetAoa.push([]);
  summarySheetAoa.push([]);

  // Section 3: Répartition par catégorie
  summarySheetAoa.push(['3. RÉPARTITION DE LA VALEUR PAR FAMILLE DE VIN']);
  summarySheetAoa.push(['Famille / Catégorie', 'Nombre de Bouteilles', 'Valeur Stock (€ HT)', 'Part du Stock (%)']);
  summary.breakdownByColor.forEach(c => {
    summarySheetAoa.push([
      c.colorLabel,
      c.bottles,
      Number(c.valueHt.toFixed(2)),
      Number(c.sharePercent.toFixed(1)) + '%'
    ]);
  });
  summarySheetAoa.push([
    'TOTAL FAMILLES',
    summary.totalBottlesEnd,
    Number(summary.totalValueEndHt.toFixed(2)),
    '100.0%'
  ]);

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summarySheetAoa);

  summaryWorksheet['!cols'] = [
    { wch: 38 },
    { wch: 24 },
    { wch: 24 },
    { wch: 48 }
  ];

  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Synthese_Comptable');

  // Generate clean filename
  const cleanLabel = summary.periodLabel.replace(/[\s\/:*?"<>|]+/g, '_');
  const filename = `${prefix}_${cleanLabel}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export stock rows to CSV (French format with semicolon delimiter ';')
 */
export function exportStockToCsv(
  stockRows: WineStockAccountingRow[],
  summary: AccountingPeriodSummary,
  filenamePrefix: string = 'Extraction_Stock_Premnord'
) {
  const headers = [
    'Domaine',
    'Nom_Vin',
    'Cuvee',
    'Millesime',
    'Couleur',
    'Format',
    'Site',
    'Emplacement',
    'Stock_Debut_Mois',
    'Entrees_Mois',
    'Sorties_Mois',
    'Stock_Fin_Mois',
    'Prix_Achat_HT',
    'Valeur_Achat_Debut_HT',
    'Valeur_Achat_Fin_HT',
    'Variation_Valeur_HT',
    'Prix_Vente_TTC'
  ];

  const lines: string[] = [];
  lines.push(headers.join(';'));

  stockRows.forEach(r => {
    const row = [
      `"${(r.domain || '').replace(/"/g, '""')}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.cuvee || '').replace(/"/g, '""')}"`,
      `"${(r.vintage || '').replace(/"/g, '""')}"`,
      `"${r.color}"`,
      `"${r.format}"`,
      `"${(r.siteName || '').replace(/"/g, '""')}"`,
      `"${(r.bin || '').replace(/"/g, '""')}"`,
      r.startStock.toString(),
      r.inQuantity.toString(),
      r.outQuantity.toString(),
      r.endStock.toString(),
      r.buyPriceHt.toFixed(2).replace('.', ','),
      r.startValueHt.toFixed(2).replace('.', ','),
      r.endValueHt.toFixed(2).replace('.', ','),
      r.netValueChangeHt.toFixed(2).replace('.', ','),
      r.sellPriceTtc !== undefined ? r.sellPriceTtc.toFixed(2).replace('.', ',') : ''
    ];
    lines.push(row.join(';'));
  });

  // Total row
  const totalRow = [
    '"TOTAL GENERAL"',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    summary.totalBottlesStart.toString(),
    summary.totalBottlesIn.toString(),
    summary.totalBottlesOut.toString(),
    summary.totalBottlesEnd.toString(),
    '""',
    summary.totalValueStartHt.toFixed(2).replace('.', ','),
    summary.totalValueEndHt.toFixed(2).replace('.', ','),
    summary.totalValueNetChangeHt.toFixed(2).replace('.', ','),
    '""'
  ];
  lines.push(totalRow.join(';'));

  const csvContent = '\uFEFF' + lines.join('\r\n'); // Add UTF-8 BOM for Excel compatibility
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanLabel = summary.periodLabel.replace(/[\s\/:*?"<>|]+/g, '_');
  link.setAttribute('download', `${filenamePrefix}_${cleanLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Dedicated 1-click exporter for Domaine Prieuré-Roch monthly accounting
 */
export function exportDPRMonthlyExcel(
  stockRows: WineStockAccountingRow[],
  movementRows: MovementAccountingRow[],
  summary: AccountingPeriodSummary,
  detailedStockRows?: WineStockAccountingRow[]
) {
  exportAccountingToExcel(
    stockRows,
    movementRows,
    summary,
    'Extraction_Prieure_Roch',
    'PREMNORD - ÉTAT DE STOCK & VALORISATION MENSUELLE : DOMAINE PRIEURÉ-ROCH',
    detailedStockRows
  );
}

/**
 * Export live inventory / stock list to Excel (.xlsx) from WineList
 */
export function exportLiveStockToExcel(
  wines: Wine[],
  sites: Site[],
  titlePrefix: string = 'Inventaire_Stock_Premnord',
  filterLabel?: string
) {
  const workbook = XLSX.utils.book_new();
  const sitesMap = new Map<string, string>();
  sites.forEach(s => sitesMap.set(s.id, s.name));

  const sheetAoa: any[][] = [];
  sheetAoa.push([`PREMNORD - ÉTAT D'INVENTAIRE DU STOCK EN TEMPS RÉEL`]);
  if (filterLabel) {
    sheetAoa.push([`Périmètre sélectionné : ${filterLabel}`]);
  }
  sheetAoa.push([`Date d'extraction : ${new Date().toLocaleString('fr-FR')}`]);
  
  let totalBottles = 0;
  let totalValueBuyHt = 0;
  let totalValueSellTtc = 0;

  wines.forEach(w => {
    const qty = w.quantity || 0;
    const buyPrice = w.priceBuy || w.priceBuyHt || 0;
    const sellPrice = w.priceSell || 0;
    totalBottles += qty;
    totalValueBuyHt += qty * buyPrice;
    totalValueSellTtc += qty * sellPrice;
  });

  sheetAoa.push([
    `TOTAL BOUTEILLES : ${totalBottles} bt`,
    '',
    `VALEUR ACHAT TOTALE : ${totalValueBuyHt.toFixed(2)} € HT`,
    '',
    `VALEUR CARTE TOTALE : ${totalValueSellTtc.toFixed(2)} € TTC`
  ]);
  sheetAoa.push([]); // empty line

  const headers = [
    'ID Réf',
    'Domaine',
    'Nom / Appellation',
    'Cuvée',
    'Millésime',
    'Format',
    'Couleur',
    'Site de Stockage',
    'Emplacement (Casier)',
    'Stock en Bouteilles',
    'Seuil Alerte',
    'Prix Achat Unit. HT (€)',
    'Valeur Stock Achat HT (€)',
    'Prix Vente Unit. TTC (€)',
    'Valeur Stock Vente TTC (€)'
  ];
  sheetAoa.push(headers);

  wines.forEach(w => {
    const buyPrice = w.priceBuy || w.priceBuyHt || 0;
    const sellPrice = w.priceSell || 0;
    const lineBuyVal = (w.quantity || 0) * buyPrice;
    const lineSellVal = (w.quantity || 0) * sellPrice;
    const siteName = sitesMap.get(w.siteId) || 'Site Principal';

    sheetAoa.push([
      w.id.substring(0, 8),
      w.domain || '',
      w.name || '',
      w.cuvee || '',
      w.vintage || 'S.A.',
      w.format || 'Bouteille (75cl)',
      (w.color || '').toUpperCase(),
      siteName,
      w.bin || '',
      w.quantity || 0,
      w.alertThreshold || 0,
      Number(buyPrice.toFixed(2)),
      Number(lineBuyVal.toFixed(2)),
      Number(sellPrice.toFixed(2)),
      Number(lineSellVal.toFixed(2))
    ]);
  });

  // Total footer
  sheetAoa.push([]);
  sheetAoa.push([
    'TOTAL GÉNÉRAL',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalBottles,
    '',
    '',
    Number(totalValueBuyHt.toFixed(2)),
    '',
    Number(totalValueSellTtc.toFixed(2))
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 32 },
    { wch: 18 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(workbook, ws, 'Inventaire_Stock');
  const now = new Date();
  const dateStr = `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}`;
  XLSX.writeFile(workbook, `${titlePrefix}_${dateStr}.xlsx`);
}
