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
  console.log('Fetching all wines from Firestore...');
  const winesCol = collection(db, 'wines');
  const winesSnap = await getDocs(winesCol);
  const wines = winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  console.log(`Total wines in DB: ${wines.length}`);

  const dprWines = wines.filter(w => {
    const d = (w.domain || '').toLowerCase();
    return d.includes('prieure') || d.includes('roch') || d.includes('dpr');
  });

  console.log(`Total DPR wines in DB: ${dprWines.length}`);
  
  let totalQty = 0;
  dprWines.forEach(w => {
    totalQty += w.quantity || 0;
  });
  console.log(`Sum of DPR quantities: ${totalQty}`);

  // Let's list each unique combination of Name, Vintage, and Format in the DB for DPR
  console.log('\n--- DPR WINES IN DB ---');
  dprWines.sort((a, b) => {
    const nameCompare = (a.name || '').localeCompare(b.name || '');
    if (nameCompare !== 0) return nameCompare;
    return (a.vintage || '').localeCompare(b.vintage || '');
  }).forEach(w => {
    console.log(`ID: ${w.id} | ${w.domain} | ${w.name} | ${w.vintage} | ${w.size || w.format || 'Bt'} | Qty: ${w.quantity} | Site: ${w.siteId}`);
  });

  process.exit(0);
}

main().catch(console.error);
