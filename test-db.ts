import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

async function main() {
  console.log("Initializing Firebase Admin with custom database ID...");
  const app = initializeApp({
    projectId: "gen-lang-client-0669240266"
  });

  const dbId = "ai-studio-suiviapppremnord-d559461f-746f-43a5-9a81-02a0e8c2cb78";
  const db = getFirestore(app, dbId);

  console.log("Fetching wines collection...");
  const snapshot = await db.collection('wines').get();
  console.log(`Total wine documents in DB: ${snapshot.size}`);

  const dprWines: any[] = [];
  let dprTotalQty = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const domain = data.domain || '';
    const name = data.name || '';
    
    const isDPR = domain.toLowerCase().includes('roch') || 
                  name.toLowerCase().includes('roch') || 
                  domain.toLowerCase() === 'dpr';
                  
    if (isDPR) {
      dprWines.push({ id: doc.id, ...data });
      dprTotalQty += (data.quantity || 0);
    }
  });

  console.log(`\nFound ${dprWines.length} wines matching Prieuré-Roch.`);
  console.log(`Sum of quantities: ${dprTotalQty}`);
  
  // Sort by name and vintage
  dprWines.sort((a, b) => {
    const compName = (a.name || '').localeCompare(b.name || '');
    if (compName !== 0) return compName;
    return (a.vintage || '').localeCompare(b.vintage || '');
  });

  const output = dprWines.map(w => 
    `[${w.id}] - ${w.domain} - ${w.name} - ${w.vintage} - Qty: ${w.quantity} - Site: ${w.siteId} (Buy Price: ${w.priceBuy || w.priceBuyHt || 0} €)`
  ).join('\n');
  
  fs.writeFileSync('dpr_audit.txt', output);
  console.log("Detailed audit saved to dpr_audit.txt");
}

main().catch(err => {
  console.error("Error running script:", err);
});
