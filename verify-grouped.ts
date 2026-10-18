import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

async function main() {
  const winesCol = collection(db, 'wines');
  const winesSnap = await getDocs(winesCol);
  const wines = winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  const dprWines = wines.filter(w => {
    const d = (w.domain || '').toLowerCase();
    return d.includes('prieure') || d.includes('roch') || d.includes('dpr');
  });

  dprWines.sort((a, b) => {
    const nameCompare = (a.name || '').localeCompare(b.name || '');
    if (nameCompare !== 0) return nameCompare;
    const vintageCompare = (a.vintage || '').localeCompare(b.vintage || '');
    if (vintageCompare !== 0) return vintageCompare;
    return (a.siteId || '').localeCompare(b.siteId || '');
  });

  let output = `Total DPR wines in DB: ${dprWines.length}\n`;
  let totalQty = 0;
  
  // Group by name + vintage + format/size to see totals across sites
  const grouped: { [key: string]: { name: string, vintage: string, format: string, qty: number, sites: { [siteId: string]: number } } } = {};
  
  dprWines.forEach(w => {
    const format = w.size || w.format || 'Bt';
    const key = `${w.name} - ${w.vintage} - ${format}`.toLowerCase();
    if (!grouped[key]) {
      grouped[key] = {
        name: w.name,
        vintage: w.vintage,
        format,
        qty: 0,
        sites: {}
      };
    }
    grouped[key].qty += w.quantity || 0;
    grouped[key].sites[w.siteId] = (grouped[key].sites[w.siteId] || 0) + (w.quantity || 0);
    totalQty += w.quantity || 0;
  });

  output += `Total quantity: ${totalQty}\n\n`;
  output += `--- GROUPED BY WINE + VINTAGE + FORMAT ---\n`;
  
  Object.values(grouped).sort((a, b) => {
    const nameComp = a.name.localeCompare(b.name);
    if (nameComp !== 0) return nameComp;
    return a.vintage.localeCompare(b.vintage);
  }).forEach(g => {
    output += `${g.name} | ${g.vintage} | ${g.format} | Total Qty: ${g.qty} | Sites breakdown: ${JSON.stringify(g.sites)}\n`;
  });

  fs.writeFileSync('./dpr_db_grouped.txt', output);
  console.log('Grouped file written to ./dpr_db_grouped.txt');
  process.exit(0);
}

main().catch(console.error);
