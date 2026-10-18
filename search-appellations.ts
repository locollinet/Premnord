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

  const dprAppellations = [
    'suchots', 'goillote', 'maizières', 'clous', 'vougeot', 'chambertin', 
    'ladoix', 'argillières', 'corvées', 'pinoterie'
  ];

  console.log('--- WINES WITH DPR-LIKE APPELLATIONS AND THEIR DOMAINS ---');
  wines.forEach(w => {
    const name = (w.name || '').toLowerCase();
    const domain = (w.domain || '').toLowerCase();
    
    // Check if name has one of the unique DPR terms
    const hasDprTerm = dprAppellations.some(term => name.includes(term));
    // If it has a DPR term but its domain is NOT already recognized as Prieuré-Roch
    const isAlreadyRecognized = domain.includes('prieure') || domain.includes('roch') || domain.includes('dpr') || domain === '2019' || domain === '2020' || domain === '2016';
    
    if (hasDprTerm && !isAlreadyRecognized) {
      console.log(`ID: ${w.id} | Domain: "${w.domain}" | Name: "${w.name}" | Vintage: "${w.vintage}" | Qty: ${w.quantity} | Site: ${w.siteId}`);
    }
  });

  process.exit(0);
}

main().catch(console.error);
