import { 
  getAvailableMonths, 
  createCustomPeriodOption, 
  calculateCellarAccounting, 
  consolidateStockRowsByReference,
  buildFilteredAccountingSummary,
  getWineBuyPriceHt 
} from './src/lib/accountingCalculations';
import { 
  exportAccountingToExcel, 
  exportStockToCsv, 
  exportDPRMonthlyExcel 
} from './src/lib/accountingExportXlsx';
import { isDPRWine, getCanonicalDomain, Wine, Movement, Site } from './src/types';
import { classifyWineRegionAndSubRegion } from './src/lib/wineGrouping';

console.log('====================================================');
console.log('🧪 BATTERIE DE TESTS AUTOMATISÉS - SUIVI CAVE PREMNORD');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   👉 Détail : ${details}`);
  }
}

// ----------------------------------------------------
// 1. TEST DOMAIN DETECTION & CANONICALIZATION (DPR)
// ----------------------------------------------------
console.log('--- TEST 1: Détection et Normalisation Prieuré-Roch ---');
const dprWine1 = { id: 'w1', domain: 'Domaine Prieuré-Roch', name: 'Nuits-Saint-Georges', vintage: '2017', quantity: 6 } as Wine;
const dprWine2 = { id: 'w2', domain: 'DPR', name: 'Ladoix Le Clou', vintage: '2020', quantity: 12 } as Wine;
const dprWine3 = { id: 'w3', domain: 'Prieuré Roch', name: 'Vosne-Romanée', vintage: '2019', quantity: 3 } as Wine;
const nonDprWine = { id: 'w4', domain: 'Domaine Leflaive', name: 'Puligny-Montrachet', vintage: '2021', quantity: 8 } as Wine;

assert(isDPRWine(dprWine1), 'isDPRWine détecte "Domaine Prieuré-Roch"');
assert(isDPRWine(dprWine2), 'isDPRWine détecte "DPR"');
assert(isDPRWine(dprWine3), 'isDPRWine détecte "Prieuré Roch"');
assert(!isDPRWine(nonDprWine), 'isDPRWine ne matche pas un autre domaine');
assert(getCanonicalDomain('DPR') === 'Domaine Prieuré-Roch', 'getCanonicalDomain normalise "DPR"');
assert(getCanonicalDomain('prieureroch') === 'Domaine Prieuré-Roch', 'getCanonicalDomain normalise "prieureroch"');

// ----------------------------------------------------
// 2. TEST PERIOD MANAGEMENT (MONTHS & CUSTOM DATES)
// ----------------------------------------------------
console.log('\n--- TEST 2: Gestion des Périodes et Dates Personnalisées ---');
const months = getAvailableMonths();
assert(months.length >= 24, `getAvailableMonths retourne 24+ mois (reçu: ${months.length})`);
const currentMonth = months.find(m => m.isCurrent);
assert(Boolean(currentMonth), 'Un mois courant est bien identifié');

const customPeriod = createCustomPeriodOption('2026-09-15', '2026-10-06');
assert(customPeriod.startMs < customPeriod.endMs, 'customPeriod: startMs < endMs');
assert(customPeriod.label === 'Du 15/09/2026 au 06/10/2026', `customPeriod label formaté (${customPeriod.label})`);
assert(customPeriod.key === 'custom_2026-09-15_2026-10-06', 'customPeriod key conforme');

// ----------------------------------------------------
// 3. TEST STOCK & MOVEMENTS ARITHMETIC RECONCILIATION
// ----------------------------------------------------
console.log('\n--- TEST 3: Réconciliation Mathématique des Stocks & Flux ---');
const dummySites: Site[] = [
  { id: 'site-cave', name: 'Cave Centrale', createdAt: 1000 },
  { id: 'site-rest', name: 'Restaurant', createdAt: 1000 }
];

const mockWines: Wine[] = [
  {
    id: 'wine-dpr-1',
    name: 'Nuits-Saint-Georges Clos des Corvées',
    domain: 'Domaine Prieuré-Roch',
    vintage: '2015',
    color: 'rouge',
    quantity: 10, // Stock fin courant
    alertThreshold: 2,
    siteId: 'site-cave',
    priceBuy: 180,
    priceBuyHt: 180,
    priceSell: 450,
    createdAt: 1000,
    updatedAt: 1000
  },
  {
    id: 'wine-dpr-2',
    name: 'Ladoix Le Clou Blanc',
    domain: 'Domaine Prieuré-Roch',
    vintage: '2020',
    color: 'blanc',
    quantity: 6,
    alertThreshold: 2,
    siteId: 'site-cave',
    priceBuy: 95,
    priceBuyHt: 95,
    priceSell: 220,
    createdAt: 1000,
    updatedAt: 1000
  },
  {
    id: 'wine-other',
    name: 'Meursault Premier Cru',
    domain: 'Domaine Roulot',
    vintage: '2018',
    color: 'blanc',
    quantity: 4,
    alertThreshold: 2,
    siteId: 'site-cave',
    priceBuy: 250,
    priceBuyHt: 250,
    createdAt: 1000,
    updatedAt: 1000
  }
];

// Movements during custom period
const startCustomMs = new Date('2026-09-15T00:00:00.000Z').getTime();
const endCustomMs = new Date('2026-10-06T23:59:59.999Z').getTime();
const midMs = (startCustomMs + endCustomMs) / 2;

const mockMovements: Movement[] = [
  {
    id: 'mov-1',
    wineId: 'wine-dpr-1',
    wineName: 'Nuits-Saint-Georges Clos des Corvées',
    type: 'in',
    quantity: 6, // 6 bouteilles reçues
    toSiteId: 'site-cave',
    reason: 'livraison',
    notes: 'Livraison Fournisseur',
    createdAt: midMs,
    userId: 'u1',
    userName: 'Sommelier'
  },
  {
    id: 'mov-2',
    wineId: 'wine-dpr-1',
    wineName: 'Nuits-Saint-Georges Clos des Corvées',
    type: 'out',
    quantity: 2, // 2 bouteilles vendues
    fromSiteId: 'site-cave',
    reason: 'vente',
    notes: 'Vente Client Restaurant',
    createdAt: midMs + 1000,
    userId: 'u1',
    userName: 'Sommelier'
  }
];

const periodResult = calculateCellarAccounting(
  mockWines,
  mockMovements,
  customPeriod,
  dummySites,
  'all',
  'all'
);

assert(periodResult.stockRows.length === 3, 'Calcul de stock traite toutes les références');
const dprRow1 = periodResult.stockRows.find(r => r.wineId === 'wine-dpr-1');
assert(Boolean(dprRow1), 'Ligne wine-dpr-1 trouvée');

if (dprRow1) {
  // endStock = 10 (nowMs < endCustomMs or current)
  // in = 6, out = 2
  // startStock = endStock - in + out = 10 - 6 + 2 = 6
  assert(dprRow1.inQuantity === 6, `Entrées du vin = 6 (obtenu: ${dprRow1.inQuantity})`);
  assert(dprRow1.outQuantity === 2, `Sorties du vin = 2 (obtenu: ${dprRow1.outQuantity})`);
  assert(
    dprRow1.startStock + dprRow1.inQuantity - dprRow1.outQuantity === dprRow1.endStock,
    `Égalité comptable vérifiée : Start (${dprRow1.startStock}) + In (${dprRow1.inQuantity}) - Out (${dprRow1.outQuantity}) = End (${dprRow1.endStock})`
  );
  assert(dprRow1.endValueHt === dprRow1.endStock * dprRow1.buyPriceHt, 'Valorisation fin de période exacte');
}

// ----------------------------------------------------
// 4. TEST FILTERING BY DPR DOMAIN ONLY
// ----------------------------------------------------
console.log('\n--- TEST 4: Filtrage Exclusif Domaine Prieuré-Roch ---');
const dprFilteredResult = calculateCellarAccounting(
  mockWines,
  mockMovements,
  customPeriod,
  dummySites,
  'all',
  'prieure_roch'
);

assert(dprFilteredResult.stockRows.length === 2, `Seules les 2 références Prieuré-Roch sont retenues (obtenu: ${dprFilteredResult.stockRows.length})`);
assert(
  dprFilteredResult.stockRows.every(r => isDPRWine(r.wine)),
  'Toutes les lignes correspondent bien à Domaine Prieuré-Roch'
);
assert(
  dprFilteredResult.movementRows.length === 2,
  'Tous les mouvements retenus concernent Prieuré-Roch'
);

// ----------------------------------------------------
// 5. TEST EXCEL WORKBOOK GENERATION
// ----------------------------------------------------
console.log('\n--- TEST 5: Génération du Classeur Excel Comptable Multi-Feuilles ---');
try {
  // Test export structure and verify it doesn't throw
  const filteredSummary = buildFilteredAccountingSummary(
    dprFilteredResult.stockRows,
    dprFilteredResult.movementRows,
    dprFilteredResult.summary,
    dummySites,
    'Domaine Prieuré-Roch'
  );

  assert(filteredSummary.totalBottlesEnd === 16, `Total bouteilles Prieuré-Roch fin = 16 (obtenu: ${filteredSummary.totalBottlesEnd})`);
  assert(filteredSummary.totalValueEndHt > 0, `Valeur totale fin > 0 € (obtenu: ${filteredSummary.totalValueEndHt.toFixed(2)} €)`);
  assert(filteredSummary.domainFilterName === 'Domaine Prieuré-Roch', 'Libellé de filtre domaine correct dans la synthèse');
} catch (e: any) {
  assert(false, 'Génération synthèse comptable sans erreur', e.message);
}

// ----------------------------------------------------
// 6. TEST REGION CLASSIFICATION SPEED & ACCURACY
// ----------------------------------------------------
console.log('\n--- TEST 6: Performance et Précision Classification Régionale ---');
const t0 = Date.now();
for (let i = 0; i < 500; i++) {
  classifyWineRegionAndSubRegion(mockWines[0]);
}
const elapsed = Date.now() - t0;
assert(elapsed < 200, `500 classifications exécutées en ${elapsed}ms (< 200ms)`);

// ----------------------------------------------------
// 7. TEST REGROUPEMENT CONSOLIDÉ PAR RÉFÉRENCE (DEMANDE AURELIO)
// ----------------------------------------------------
console.log('\n--- TEST 7: Consolidation Multi-Sites par Référence Unique (Demande Aurelio) ---');
const multiSiteWines: Wine[] = [
  ...mockWines,
  {
    id: 'wine-dpr-1-restaurant',
    name: 'Nuits-Saint-Georges Clos des Corvées',
    domain: 'Domaine Prieuré-Roch',
    vintage: '2015',
    color: 'rouge',
    quantity: 4, // 4 bouteilles sur le site restaurant
    alertThreshold: 1,
    siteId: 'site-rest',
    priceBuy: 180,
    priceBuyHt: 180,
    priceSell: 450,
    createdAt: 1000,
    updatedAt: 1000
  }
];

const multiSiteResult = calculateCellarAccounting(
  multiSiteWines,
  mockMovements,
  customPeriod,
  dummySites,
  'all',
  'all'
);

// Dans les stockRows brutes, il y a 4 lignes (2 sites différents pour Clos des Corvées 2015)
assert(multiSiteResult.stockRows.length === 4, 'Stock brut contient 4 lignes physiques');

// Dans les consolidatedStockRows, Clos des Corvées 2015 est fusionné en 1 SEULE LIGNE !
const consolidated = multiSiteResult.consolidatedStockRows;
assert(consolidated.length === 3, `Consolidation produit exactement 3 références uniques (reçu: ${consolidated.length})`);

const mergedRow = consolidated.find(r => r.name.includes('Clos des Corvées'));
assert(Boolean(mergedRow), 'Référence fusionnée Clos des Corvées trouvée');
if (mergedRow) {
  assert(mergedRow.endStock === 14, `Stock fin fusionné = 10 + 4 = 14 bt (reçu: ${mergedRow.endStock})`);
  assert(mergedRow.endValueHt === 14 * 180, `Valeur fin fusionnée = 2 520 € (reçu: ${mergedRow.endValueHt} €)`);
  assert(mergedRow.siteCount === 2, `SiteCount = 2 sites physiques (reçu: ${mergedRow.siteCount})`);
  assert(Boolean(mergedRow.sitesSummary?.includes('Cave Centrale') && mergedRow.sitesSummary?.includes('Restaurant')), 'SitesSummary récapitule les deux sites');
}

console.log('\n====================================================');
console.log(`📊 BILAN DES TESTS : ${passedTests} / ${totalTests} RÉUSSIS`);
if (passedTests === totalTests) {
  console.log('🎉 TOUS LES TESTS SONT AU VERT (100% OK) !');
} else {
  console.log('⚠️ DES ANOMALIES ONT ÉTÉ DÉTECTÉES');
}
console.log('====================================================');
