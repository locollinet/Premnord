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

  console.log('--- ALL WINES CONTAINING "COTEAUX" OR "GAMAY" OR "BOURGUIGNONS" ---');
  wines.filter(w => {
    const name = (w.name || '').toLowerCase();
    const domain = (w.domain || '').toLowerCase();
    return name.includes('coteaux') || name.includes('gamay') || name.includes('bourguignons') || domain.includes('coteaux') || domain.includes('gamay');
  }).forEach(w => {
    console.log(`ID: ${w.id} | Domain: ${w.domain} | Name: ${w.name} | Vintage: ${w.vintage} | Qty: ${w.quantity} | Site: ${w.siteId}`);
  });

  process.exit(0);
}

main().catch(console.error);
