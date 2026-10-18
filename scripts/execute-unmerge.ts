import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync('./scripts/unmerge-plan.json', 'utf8'));

async function runUnmerge() {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

  console.log(`Starting unmerge execution for ${plan.length} wines...`);

  let unmergedCount = 0;
  let newDocsCount = 0;

  for (const item of plan) {
    const isMagnum = item.format === 'Magnum' || 
                     (item.name || '').toLowerCase().includes('magnum') || 
                     (item.cuvee || '').toLowerCase().includes('magnum');

    const targetFormat = isMagnum ? 'Magnum' : (item.format || '75cl');

    if (item.notesParts && item.notesParts.length >= 2) {
      console.log(`\nUnmerging ${item.originalId} (${item.domain} - ${item.name} ${item.vintage})`);
      console.log(`  Current Qty: ${item.totalQuantity} -> Split: ${item.splitQuantities.join(' + ')}`);
      console.log(`  Format: ${targetFormat}`);

      // 1. Update Master Document (Part 1)
      const masterRef = doc(db, 'wines', item.originalId);
      const masterUpdates: any = {
        quantity: item.splitQuantities[0],
        format: targetFormat,
        notes: item.notesParts[0],
        updatedAt: Date.now()
      };
      await updateDoc(masterRef, masterUpdates);
      console.log(`  Updated master doc ${item.originalId} (Qty: ${item.splitQuantities[0]})`);

      // 2. Create Second Document (Part 2)
      const newId = `wine_unmerged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const secondDoc: any = {
        id: newId,
        domain: item.domain,
        name: item.name,
        cuvee: item.cuvee || '',
        vintage: item.vintage || '',
        color: item.color || 'rouge',
        format: targetFormat,
        quantity: item.splitQuantities[1],
        siteId: item.siteId,
        bin: item.bin || '',
        priceBuy: item.priceBuy || 0,
        priceSell: item.priceSell || 0,
        notes: item.notesParts[1],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const secondRef = doc(db, 'wines', newId);
      await setDoc(secondRef, secondDoc);
      console.log(`  Created second doc ${newId} (Qty: ${item.splitQuantities[1]})`);

      // 3. Log movement for audit trail
      const movRef = collection(db, 'movements');
      await addDoc(movRef, {
        wineId: item.originalId,
        wineName: `${item.domain} - ${item.name} ${item.vintage}`.trim(),
        type: 'correction',
        quantity: item.splitQuantities[0],
        reason: 'correction',
        notes: `Défusion manuelle : rétablissement de la fiche d'origine 1/2 (${item.notesParts[0]}).`,
        userId: 'admin_unmerge',
        userName: 'Audit APM',
        createdAt: Date.now()
      });

      await addDoc(movRef, {
        wineId: newId,
        wineName: `${item.domain} - ${item.name} ${item.vintage}`.trim(),
        type: 'correction',
        quantity: item.splitQuantities[1],
        reason: 'correction',
        notes: `Défusion manuelle : rétablissement de la fiche d'origine 2/2 (${item.notesParts[1]}).`,
        userId: 'admin_unmerge',
        userName: 'Audit APM',
        createdAt: Date.now()
      });

      unmergedCount++;
      newDocsCount++;
    } else {
      // Just ensure format is Magnum if it's a Magnum wine
      if (isMagnum) {
        const masterRef = doc(db, 'wines', item.originalId);
        await updateDoc(masterRef, {
          format: 'Magnum',
          updatedAt: Date.now()
        });
        console.log(`  Fixed format to Magnum for ${item.originalId}`);
      }
    }
  }

  console.log(`\nFinished unmerging: ${unmergedCount} wines unmerged, ${newDocsCount} new separated wine fiches created.`);
  process.exit(0);
}

runUnmerge();
