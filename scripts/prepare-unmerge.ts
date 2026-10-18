import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./scripts/unmerge-candidates.json', 'utf8'));

console.log(`Analyzing ${data.candidates.length} candidates for unmerge plan...`);

const unmergePlan: any[] = [];

data.candidates.forEach((c: any) => {
  const notesParts = (c.notes || '').split(' | ').map((s: string) => s.trim()).filter(Boolean);
  const numParts = notesParts.length;

  const isMagnum = (c.format || '').toLowerCase().includes('magnum') || 
                   (c.name || '').toLowerCase().includes('magnum') || 
                   (c.cuvee || '').toLowerCase().includes('magnum');

  const targetFormat = isMagnum ? 'Magnum' : (c.format || '75cl');

  // Split quantity
  // If quantity > 1 and numParts > 1:
  // e.g. if qty is 6 and 2 parts: Cuisine (2 bt) and Réserve (4 bt), or half and half if unspecified
  let splitQuantities: number[] = [];
  if (numParts === 2) {
    if (c.id === 'wine_1785837690184_9recb') {
      // Côteaux Bourguignons Magnum (6 bt): initial movement showed 2 bt from Cuisine, 4 bt from Réserve
      splitQuantities = [2, 4];
    } else if (c.quantity === 2) {
      splitQuantities = [1, 1];
    } else if (c.quantity === 3) {
      splitQuantities = [1, 2];
    } else if (c.quantity === 0) {
      splitQuantities = [0, 0];
    } else {
      const half = Math.floor(c.quantity / 2);
      splitQuantities = [half, c.quantity - half];
    }
  } else if (numParts === 3) {
    const third = Math.floor(c.quantity / 3);
    splitQuantities = [third, third, c.quantity - 2 * third];
  } else {
    splitQuantities = [c.quantity];
  }

  unmergePlan.push({
    originalId: c.id,
    domain: c.domain,
    name: c.name,
    cuvee: c.cuvee,
    vintage: c.vintage,
    color: c.color,
    format: targetFormat,
    totalQuantity: c.quantity,
    siteId: c.siteId,
    siteName: c.siteName,
    bin: c.bin,
    priceBuy: c.priceBuy,
    priceSell: c.priceSell,
    notesParts,
    splitQuantities
  });
});

console.log(JSON.stringify(unmergePlan, null, 2));
fs.writeFileSync('./scripts/unmerge-plan.json', JSON.stringify(unmergePlan, null, 2));
