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

interface ExcelRow {
  type: 'Blanc' | 'Rouge' | 'Rosé';
  format: 'Bt' | 'Mag';
  name: string;
  vintage: string;
  estanco: number;
  cuisine: number;
  resto: number;
  total: number;
}

const excelWines: ExcelRow[] = [
  // Coteaux Bourguignons
  { type: 'Blanc', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2021', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2022', estanco: 24, cuisine: 0, resto: 0, total: 24 },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2020', estanco: 12, cuisine: 9, resto: 3, total: 24 },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2019', estanco: 24, cuisine: 4, resto: 0, total: 28 },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2018', estanco: 6, cuisine: 2, resto: 1, total: 9 },

  // Chambertin Clos de Bèze
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2013', estanco: 0, cuisine: 2, resto: 0, total: 2 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2006', estanco: 0, cuisine: 1, resto: 0, total: 1 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2002', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2001', estanco: 8, cuisine: 1, resto: 6, total: 15 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2007', estanco: 5, cuisine: 0, resto: 6, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2015', estanco: 0, cuisine: 5, resto: 2, total: 7 },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '1998', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Mag', name: 'Chambertin Clos de Bèze', vintage: '1998', estanco: 1, cuisine: 1, resto: 0, total: 2 },

  // Clos de Vougeot
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2009', estanco: 2, cuisine: 0, resto: 6, total: 8 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2016', estanco: 11, cuisine: 1, resto: 6, total: 18 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2012', estanco: 3, cuisine: 2, resto: 6, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2013', estanco: 2, cuisine: 1, resto: 0, total: 3 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2001', estanco: 2, cuisine: 2, resto: 0, total: 4 },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Mag', name: 'Clos de Vougeot', vintage: '1994', estanco: 2, cuisine: 1, resto: 0, total: 3 },
  { type: 'Rouge', format: 'Mag', name: 'Clos de Vougeot', vintage: '2001', estanco: 3, cuisine: 1, resto: 0, total: 4 },

  // Gamay
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons - Gamay', vintage: '2019', estanco: 20, cuisine: 11, resto: 3, total: 34 },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons - Gamay', vintage: '2020', estanco: 87, cuisine: 12, resto: 2, total: 101 },
  { type: 'Rouge', format: 'Mag', name: 'Côteaux Bourguignons - Gamay', vintage: '2019', estanco: 16, cuisine: 0, resto: 1, total: 17 },

  // Gevrey-Chambertin
  { type: 'Rouge', format: 'Bt', name: 'Gevrey-Chambertin Vieilles Vignes', vintage: '2020', estanco: 24, cuisine: 2, resto: 3, total: 29 },
  { type: 'Rouge', format: 'Bt', name: 'Gevrey-Chambertin 1er Cru Clos des Varoilles Vieilles Vignes', vintage: '2021', estanco: 12, cuisine: 2, resto: 1, total: 15 },

  // Ladoix le Cloud
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2013', estanco: 8, cuisine: 1, resto: 1, total: 10 },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2019', estanco: 0, cuisine: 0, resto: 2, total: 2 },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2020', estanco: 12, cuisine: 0, resto: 2, total: 14 },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2020', estanco: 0, cuisine: 2, resto: 1, total: 3 },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2021', estanco: 0, cuisine: 7, resto: 0, total: 7 },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2021', estanco: 4, cuisine: 0, resto: 1, total: 5 },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2022', estanco: 15, cuisine: 0, resto: 0, total: 15 },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2022', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2023', estanco: 0, cuisine: 0, resto: 0, total: 0 },

  // Vin de France
  { type: 'Rouge', format: 'Bt', name: 'Vin de France', vintage: '2022', estanco: 60, cuisine: 0, resto: 2, total: 62 },

  // Ladoix le Cloud (Rouge)
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2021', estanco: 36, cuisine: 0, resto: 0, total: 36 },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2021', estanco: 23, cuisine: 1, resto: 0, total: 24 },
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2019', estanco: 0, cuisine: 2, resto: 4, total: 6 },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2019', estanco: 10, cuisine: 0, resto: 1, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2020', estanco: 12, cuisine: 1, resto: 1, total: 14 },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2020', estanco: 58, cuisine: 8, resto: 2, total: 68 },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud - 12B3', vintage: '2020', estanco: 3, cuisine: 2, resto: 0, total: 5 },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2017', estanco: 10, cuisine: 1, resto: 1, total: 12 },

  // Nuits-Saint-Georges
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2019', estanco: 24, cuisine: 5, resto: 3, total: 32 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2019', estanco: 4, cuisine: 0, resto: 2, total: 6 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2018', estanco: 0, cuisine: 9, resto: 2, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2014', estanco: 0, cuisine: 0, resto: 0, total: 0 },

  // Nuits-Saint-Georges 1er Cru Clos des Argillières
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2012', estanco: 6, cuisine: 4, resto: 6, total: 16 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2011', estanco: 6, cuisine: 5, resto: 6, total: 17 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2017', estanco: 6, cuisine: 2, resto: 6, total: 14 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2014', estanco: 0, cuisine: 8, resto: 3, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2021', estanco: 18, cuisine: 0, resto: 0, total: 18 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2012', estanco: 5, cuisine: 1, resto: 0, total: 6 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2010', estanco: 3, cuisine: 0, resto: 0, total: 3 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2016', estanco: 0, cuisine: 1, resto: 0, total: 1 },

  // Clos des Corvées
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2017', estanco: 0, cuisine: 6, resto: 5, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2013', estanco: 15, cuisine: 2, resto: 6, total: 23 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2009', estanco: 8, cuisine: 0, resto: 6, total: 14 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2007', estanco: 15, cuisine: 2, resto: 4, total: 21 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2003', estanco: 6, cuisine: 2, resto: 4, total: 12 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2012', estanco: 5, cuisine: 1, resto: 0, total: 6 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole Vieilles Vignes', vintage: '2021', estanco: 30, cuisine: 5, resto: 0, total: 35 },

  // Vieilles Vignes
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2005', estanco: 6, cuisine: 1, resto: 6, total: 13 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2014', estanco: 24, cuisine: 2, resto: 4, total: 30 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2018', estanco: 0, cuisine: 6, resto: 6, total: 12 },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2009', estanco: 0, cuisine: 0, resto: 2, total: 2 },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2015', estanco: 10, cuisine: 2, resto: 0, total: 12 },

  // Pinoterie
  { type: 'Rouge', format: 'Bt', name: 'Bourgogne Pinoterie Pure', vintage: '2017', estanco: 12, cuisine: 1, resto: 3, total: 16 },
  { type: 'Rouge', format: 'Bt', name: 'Bourgogne Pinoterie', vintage: '2017', estanco: 9, cuisine: 0, resto: 2, total: 11 },
  { type: 'Rouge', format: 'Mag', name: 'Bourgogne Pinoterie', vintage: '2022', estanco: 0, cuisine: 0, resto: 0, total: 0 },

  // Rosé
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2017', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2013', estanco: 0, cuisine: 0, resto: 2, total: 2 },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2023', estanco: 0, cuisine: 9, resto: 3, total: 12 },
  { type: 'Rosé', format: 'Mag', name: 'Bourgogne Rosé', vintage: '2017', estanco: 13, cuisine: 4, resto: 1, total: 18 },

  // Savigny Dessus les Gollardes
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2020', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2021', estanco: 47, cuisine: 5, resto: 4, total: 56 },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2023', estanco: 24, cuisine: 3, resto: 1, total: 28 },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2018', estanco: 0, cuisine: 2, resto: 6, total: 8 },
  { type: 'Rouge', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2020', estanco: 12, cuisine: 3, resto: 6, total: 21 },
  { type: 'Rouge', format: 'Mag', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2018', estanco: 15, cuisine: 0, resto: 1, total: 16 },

  // Clos Goillote
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2014', estanco: 9, cuisine: 0, resto: 6, total: 15 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2009', estanco: 0, cuisine: 5, resto: 6, total: 11 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2017', estanco: 0, cuisine: 9, resto: 6, total: 15 },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2014', estanco: 3, cuisine: 0, resto: 1, total: 4 },

  // Macérations
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2015', estanco: 36, cuisine: 8, resto: 3, total: 47 },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2019', estanco: 108, cuisine: 8, resto: 4, total: 120 },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2020', estanco: 0, cuisine: 0, resto: 3, total: 3 },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2014', estanco: 48, cuisine: 7, resto: 3, total: 58 },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France', vintage: '2023', estanco: 36, cuisine: 10, resto: 1, total: 47 },
  { type: 'Blanc', format: 'Mag', name: 'Vin de France', vintage: '2023', estanco: 12, cuisine: 0, resto: 0, total: 12 },
  { type: 'Blanc', format: 'Mag', name: 'Vin de France - Macération', vintage: '2017', estanco: 15, cuisine: 1, resto: 1, total: 17 },

  // Hautes Maizières
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '1994', estanco: 0, cuisine: 3, resto: 4, total: 7 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2006', estanco: 6, cuisine: 2, resto: 6, total: 14 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2017', estanco: 0, cuisine: 0, resto: 3, total: 3 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2021', estanco: 18, cuisine: 0, resto: 0, total: 18 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2012', estanco: 12, cuisine: 1, resto: 6, total: 19 },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Hautes Maizières', vintage: '2014', estanco: 3, cuisine: 1, resto: 0, total: 4 },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Hautes Maizières', vintage: '2016', estanco: 0, cuisine: 0, resto: 1, total: 1 },

  // Les Clous
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2009', estanco: 18, cuisine: 1, resto: 6, total: 25 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2012', estanco: 18, cuisine: 2, resto: 6, total: 26 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2016', estanco: 12, cuisine: 2, resto: 6, total: 20 },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Les Clous', vintage: '2012', estanco: 6, cuisine: 5, resto: 0, total: 11 },

  // Les Suchots
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2007', estanco: 0, cuisine: 1, resto: 0, total: 1 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2014', estanco: 0, cuisine: 2, resto: 1, total: 3 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2009', estanco: 0, cuisine: 3, resto: 4, total: 7 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2016', estanco: 0, cuisine: 0, resto: 2, total: 2 },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2006', estanco: 0, cuisine: 0, resto: 0, total: 0 },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2014', estanco: 2, cuisine: 1, resto: 0, total: 3 },

  // Vougeot 1er Cru
  { type: 'Rouge', format: 'Mag', name: 'Vougeot 1er Cru', vintage: '2011', estanco: 9, cuisine: 1, resto: 0, total: 10 }
];

async function main() {
  const winesCol = collection(db, 'wines');
  const winesSnap = await getDocs(winesCol);
  const dbWines = winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  console.log(`Excel total bottles sum: ${excelWines.reduce((sum, w) => sum + w.total, 0)}`);

  // Let's do matching
  let matchedCount = 0;
  let missingCount = 0;
  let mismatchedCount = 0;

  excelWines.forEach(ew => {
    // Find matching wines in DB
    const matchingInDb = dbWines.filter(dw => {
      const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const dwNameClean = cleanStr(dw.name || '');
      const ewNameClean = cleanStr(ew.name);
      
      const dwVintage = dw.vintage || '';
      const ewVintage = ew.vintage;

      // Detect Magnum from name field
      const isDwMagnum = (dw.name || '').toLowerCase().includes('mag');
      const isEwMagnum = ew.format === 'Mag';

      if (isDwMagnum !== isEwMagnum) return false;

      // Check vintage
      if (dwVintage !== ewVintage) return false;

      // Check color
      const dwColor = (dw.color || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const ewColor = ew.type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (dwColor && ewColor && dwColor !== ewColor) {
        if (!(dwColor === 'bulle' && ewColor === 'blanc')) {
          return false;
        }
      }

      // Check if domain matches DPR (or is shifted)
      const dwDomain = (dw.domain || '').toLowerCase();
      const isDpr = dwDomain.includes('prieure') || dwDomain.includes('roch') || dwDomain.includes('dpr') || dwDomain === '2019' || dwDomain === '2020' || dwDomain === '2016';

      if (!isDpr) return false;

      // Strict matching for Coteaux Bourguignons
      if (ew.name === 'Côteaux Bourguignons') {
        if (dwNameClean.includes('gamay')) return false;
        return dwNameClean === 'coteauxbourguignons' || dwNameClean === 'coteauxbourguignon';
      }

      if (ew.name === 'Côteaux Bourguignons - Gamay') {
        return dwNameClean.includes('coteauxbourguignons') && dwNameClean.includes('gamay');
      }

      if (ew.name === 'Nuits-Saint-Georges 1er Cru') {
        return dwNameClean === 'nuitssaintgeorges1ercru' || dwNameClean === 'nuitssaintgeorges1ercrumag';
      }

      if (ew.name === 'Bourgogne Pinoterie') {
        return dwNameClean === 'bourgognepinoterie' || dwNameClean === 'bourgognepinoteriemag';
      }

      if (ew.name === 'Bourgogne Pinoterie Pure') {
        return dwNameClean === 'bourgognepinoteriepure';
      }

      if (ew.name === 'Ladoix le Cloud') {
        if (dwNameClean.includes('12b3')) return false;
        return dwNameClean === 'ladoixlecloud' || dwNameClean === 'ladoixlecloudmag';
      }

      if (ew.name === 'Ladoix le Cloud - 12B3') {
        return dwNameClean.includes('ladoixlecloud') && dwNameClean.includes('12b3');
      }

      // Let's do some specific name matching
      // If names match cleanly
      if (dwNameClean === ewNameClean) {
        return true;
      }

      if (dwNameClean.includes(ewNameClean)) {
        if (ew.name === 'Nuits-Saint-Georges 1er Cru' && dwNameClean !== 'nuitssaintgeorges1ercru' && dwNameClean !== 'nuitssaintgeorges1ercrumag') return false;
        if (ew.name === 'Ladoix le Cloud' && dwNameClean !== 'ladoixlecloud' && dwNameClean !== 'ladoixlecloudmag') return false;
        if (ew.name === 'Bourgogne Pinoterie' && dwNameClean !== 'bourgognepinoterie' && dwNameClean !== 'bourgognepinoteriemag') return false;
        return true;
      }

      // Special cases for names that might have suffixes or different spelling
      if (ew.name === 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole') {
        return dwNameClean.includes('corvees') && !dwNameClean.includes('vignes');
      }
      if (ew.name === 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole Vieilles Vignes') {
        return dwNameClean.includes('corvees') && dwNameClean.includes('vignes');
      }
      if (ew.name === 'Gevrey-Chambertin 1er Cru Clos des Varoilles Vieilles Vignes') {
        return dwNameClean.includes('varoilles');
      }
      if (ew.name === 'Savigny-lès-Beaune Dessus les Gollardes') {
        return dwNameClean.includes('gollardes') || dwNameClean.includes('savigny');
      }
      if (ew.name === 'Vosne-Romanée Clos Goillote - Monopole') {
        return dwNameClean.includes('goillote');
      }
      if (ew.name === 'Vosne-Romanée Hautes Maizières') {
        return dwNameClean.includes('maizieres');
      }
      if (ew.name === 'Vosne-Romanée Les Clous') {
        return dwNameClean.includes('clous');
      }
      if (ew.name === 'Vosne-Romanée 1er Cru Les Suchots') {
        return dwNameClean.includes('suchots');
      }
      if (ew.name === 'Vin de France - Macération') {
        return dwNameClean.includes('maceration');
      }
      if (ew.name === 'Vin de France' && ew.type === 'Blanc') {
        return dwNameClean === 'vindefrance' || (dwNameClean.includes('vindefrance') && !dwNameClean.includes('gamay') && !dwNameClean.includes('maceration'));
      }

      return false;
    });

    if (matchingInDb.length === 0) {
      console.log(`❌ MISSING IN DB: ${ew.name} | ${ew.vintage} | ${ew.format} | Expected: ${ew.total}`);
      missingCount++;
    } else {
      // Sum DB quantities by site categories
      let dbEstanco = 0; // site-3
      let dbCuisine = 0; // site-6
      let dbResto = 0;   // site-1 or site-2

      matchingInDb.forEach(dw => {
        if (dw.siteId === 'site-3') dbEstanco += dw.quantity || 0;
        else if (dw.siteId === 'site-6') dbCuisine += dw.quantity || 0;
        else if (dw.siteId === 'site-1' || dw.siteId === 'site-2') dbResto += dw.quantity || 0;
      });

      const totalDb = dbEstanco + dbCuisine + dbResto;

      if (totalDb !== ew.total || dbEstanco !== ew.estanco || dbCuisine !== ew.cuisine || dbResto !== ew.resto) {
        console.log(`⚠️ MISMATCH: ${ew.name} | ${ew.vintage} | ${ew.format}`);
        console.log(`   Excel: Estanco=${ew.estanco}, Cuisine=${ew.cuisine}, Resto=${ew.resto}, Total=${ew.total}`);
        console.log(`   DB:    Estanco=${dbEstanco}, Cuisine=${dbCuisine}, Resto=${dbResto}, Total=${totalDb}`);
        mismatchedCount++;
      } else {
        matchedCount++;
      }
    }
  });

  console.log(`\nSummary: Matched=${matchedCount}, Missing=${missingCount}, Mismatched=${mismatchedCount}`);
  process.exit(0);
}

main().catch(console.error);
