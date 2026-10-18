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
  const dprWines = winesSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() as any }))
    .filter(dw => {
      const dwDomain = (dw.domain || '').toLowerCase();
      return dwDomain.includes('prieure') || dwDomain.includes('roch') || dwDomain.includes('dpr') || dwDomain === '2019' || dwDomain === '2020' || dwDomain === '2016';
    });

  console.log(`Found ${dprWines.length} potential DPR wines in DB.`);
  const allKeys = new Set<string>();
  dprWines.forEach(w => {
    Object.keys(w).forEach(k => allKeys.add(k));
  });

  console.log('All unique keys in these documents:');
  console.log(Array.from(allKeys));

  // Let's print some wines that contain "(Mag)" or have different formats
  console.log('\n--- SAMPLE MAGNUMS ---');
  dprWines.filter(w => (w.name || '').includes('Mag') || (w.size || '').includes('Mag') || (w.format || '').includes('Mag')).slice(0, 5).forEach(w => {
    console.log(`ID: ${w.id} | Name: "${w.name}" | Size: ${w.size} | Format: ${w.format} | Qty: ${w.quantity} | Site: ${w.siteId}`);
  });

  process.exit(0);
}

main().catch(console.error);
