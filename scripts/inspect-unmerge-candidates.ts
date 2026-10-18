import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

async function inspectCandidates() {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

  const winesSnap = await getDocs(collection(db, 'wines'));
  const movementsSnap = await getDocs(collection(db, 'movements'));
  const sitesSnap = await getDocs(collection(db, 'sites'));

  const sitesMap = new Map<string, string>();
  sitesSnap.forEach(d => sitesMap.set(d.id, d.data().name || d.id));

  const allWines: any[] = [];
  winesSnap.forEach(d => allWines.push({ id: d.id, ...d.data() }));

  const allMovements: any[] = [];
  movementsSnap.forEach(d => allMovements.push({ id: d.id, ...d.data() }));

  // Find DPR wines
  const dprWines = allWines.filter(w => {
    const d = (w.domain || '').toLowerCase();
    const n = (w.name || '').toLowerCase();
    return d.includes('prieuré') || d.includes('prieure') || d.includes('roch') || d.includes('dpr') ||
           n.includes('prieuré') || n.includes('prieure');
  });

  // Find Magnum wines
  const magnumWines = allWines.filter(w => {
    const f = (w.format || '').toLowerCase();
    const n = (w.name || '').toLowerCase();
    const c = (w.cuvee || '').toLowerCase();
    return f.includes('magnum') || f.includes('150') || n.includes('magnum') || c.includes('magnum');
  });

  // Merged DPR wines (with ' | ')
  const mergedDPR = dprWines.filter(w => w.notes && typeof w.notes === 'string' && w.notes.includes(' | '));

  // Merged Magnum wines (with ' | ')
  const mergedMagnum = magnumWines.filter(w => w.notes && typeof w.notes === 'string' && w.notes.includes(' | '));

  console.log(`Total DPR wines: ${dprWines.length}`);
  console.log(`Merged DPR wines (with ' | ' in notes): ${mergedDPR.length}`);
  console.log(`Total Magnum wines: ${magnumWines.length}`);
  console.log(`Merged Magnum wines (with ' | ' in notes): ${mergedMagnum.length}`);

  // Look for movements related to these merged DPR & Magnum wines
  const mergedTargetWines = Array.from(new Set([...mergedDPR, ...mergedMagnum]));

  const candidateReports = mergedTargetWines.map(w => {
    const relatedMovements = allMovements.filter(m => 
      m.wineId === w.id || 
      (m.wineName && m.wineName.toLowerCase() === (w.name || '').toLowerCase())
    );

    return {
      id: w.id,
      domain: w.domain,
      name: w.name,
      cuvee: w.cuvee,
      vintage: w.vintage,
      color: w.color,
      format: w.format,
      quantity: w.quantity,
      siteId: w.siteId,
      siteName: sitesMap.get(w.siteId) || w.siteId,
      bin: w.bin,
      priceBuy: w.priceBuy,
      priceSell: w.priceSell,
      notes: w.notes,
      notesList: (w.notes || '').split(' | '),
      updatedAt: w.updatedAt ? new Date(w.updatedAt).toISOString() : null,
      movementsCount: relatedMovements.length,
      movements: relatedMovements.map(m => ({
        id: m.id,
        type: m.type,
        qty: m.quantity,
        date: m.createdAt ? new Date(m.createdAt).toISOString() : m.timestamp,
        reason: m.reason,
        notes: m.notes
      }))
    };
  });

  fs.writeFileSync('./scripts/unmerge-candidates.json', JSON.stringify({
    totalDPR: dprWines.length,
    mergedDPRCount: mergedDPR.length,
    totalMagnum: magnumWines.length,
    mergedMagnumCount: mergedMagnum.length,
    candidates: candidateReports
  }, null, 2));

  console.log(`Saved ${candidateReports.length} candidates to scripts/unmerge-candidates.json`);
  process.exit(0);
}

inspectCandidates();
