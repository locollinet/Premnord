import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
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
  binEstanco: string;
  binCuisine: string;
  binResto: string;
}

const excelWines: ExcelRow[] = [
  // Coteaux Bourguignons
  { type: 'Blanc', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2021', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2022', estanco: 24, cuisine: 0, resto: 0, total: 24, binEstanco: '13A2', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2020', estanco: 12, cuisine: 9, resto: 3, total: 24, binEstanco: '13B2', binCuisine: '4C5', binResto: '2R1' },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2019', estanco: 24, cuisine: 4, resto: 0, total: 28, binEstanco: '13B3', binCuisine: '4H5', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons', vintage: '2018', estanco: 6, cuisine: 2, resto: 1, total: 9, binEstanco: '13C2', binCuisine: '4A5', binResto: '2Q1' },

  // Chambertin Clos de Bèze
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2013', estanco: 0, cuisine: 2, resto: 0, total: 2, binEstanco: '', binCuisine: '4F5', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2006', estanco: 0, cuisine: 1, resto: 0, total: 1, binEstanco: '', binCuisine: '4E4', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2002', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2001', estanco: 8, cuisine: 1, resto: 6, total: 15, binEstanco: '11C1', binCuisine: '4E4', binResto: '2O2' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2007', estanco: 5, cuisine: 0, resto: 6, total: 11, binEstanco: '12B1', binCuisine: '', binResto: '2O1' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '2015', estanco: 0, cuisine: 5, resto: 2, total: 7, binEstanco: '', binCuisine: '4E4', binResto: '2O2' },
  { type: 'Rouge', format: 'Bt', name: 'Chambertin Clos de Bèze', vintage: '1998', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Chambertin Clos de Bèze', vintage: '1998', estanco: 1, cuisine: 1, resto: 0, total: 2, binEstanco: '10B3', binCuisine: '4E2', binResto: '' },

  // Clos de Vougeot
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2009', estanco: 2, cuisine: 0, resto: 6, total: 8, binEstanco: '11B1', binCuisine: '', binResto: '2O2' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2016', estanco: 11, cuisine: 1, resto: 6, total: 18, binEstanco: '11B2', binCuisine: '4E4', binResto: '2O3' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2012', estanco: 3, cuisine: 2, resto: 6, total: 11, binEstanco: '11C2', binCuisine: '4E4', binResto: '2O1' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2013', estanco: 2, cuisine: 1, resto: 0, total: 3, binEstanco: '11A2', binCuisine: '4E4', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2001', estanco: 2, cuisine: 2, resto: 0, total: 4, binEstanco: '11A3', binCuisine: '4E4', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Clos de Vougeot', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Clos de Vougeot', vintage: '1994', estanco: 2, cuisine: 1, resto: 0, total: 3, binEstanco: '10A1', binCuisine: '4E2', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Clos de Vougeot', vintage: '2001', estanco: 3, cuisine: 1, resto: 0, total: 4, binEstanco: '10C2', binCuisine: '4E2', binResto: '' },

  // Gamay
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons - Gamay', vintage: '2019', estanco: 20, cuisine: 11, resto: 3, total: 34, binEstanco: '13C3', binCuisine: '4F5', binResto: '2Q1' },
  { type: 'Rouge', format: 'Bt', name: 'Côteaux Bourguignons - Gamay', vintage: '2020', estanco: 87, cuisine: 12, resto: 2, total: 101, binEstanco: '13A4/13B4', binCuisine: 'Sol', binResto: '2P1' },
  { type: 'Rouge', format: 'Mag', name: 'Côteaux Bourguignons - Gamay', vintage: '2019', estanco: 16, cuisine: 0, resto: 1, total: 17, binEstanco: '10B2/14A1', binCuisine: '', binResto: 'mur' },

  // Gevrey-Chambertin
  { type: 'Rouge', format: 'Bt', name: 'Gevrey-Chambertin Vieilles Vignes', vintage: '2020', estanco: 24, cuisine: 2, resto: 3, total: 29, binEstanco: '11C4', binCuisine: '4E2', binResto: '2M8' },
  { type: 'Rouge', format: 'Bt', name: 'Gevrey-Chambertin 1er Cru Clos des Varoilles Vieilles Vignes', vintage: '2021', estanco: 12, cuisine: 2, resto: 1, total: 15, binEstanco: '14B2', binCuisine: '4E5', binResto: '2Q4' },

  // Ladoix le Cloud
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2013', estanco: 8, cuisine: 1, resto: 1, total: 10, binEstanco: '10C1', binCuisine: '4E1', binResto: '1M8' },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2019', estanco: 0, cuisine: 0, resto: 2, total: 2, binEstanco: '', binCuisine: '4H5', binResto: '1J3' },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2020', estanco: 12, cuisine: 0, resto: 2, total: 14, binEstanco: '13B2/13C3', binCuisine: '4C5', binResto: '1O3' },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2020', estanco: 0, cuisine: 2, resto: 1, total: 3, binEstanco: '', binCuisine: '4C2', binResto: '1K8' },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2021', estanco: 0, cuisine: 7, resto: 0, total: 7, binEstanco: '', binCuisine: '4C2', binResto: '' },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2021', estanco: 4, cuisine: 0, resto: 1, total: 5, binEstanco: '14B3', binCuisine: '4E1', binResto: '1K8' },
  { type: 'Blanc', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2022', estanco: 15, cuisine: 0, resto: 0, total: 15, binEstanco: '14C3', binCuisine: '4E1', binResto: '1J8' },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2022', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Blanc', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2023', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },

  // Vin de France
  { type: 'Rouge', format: 'Bt', name: 'Vin de France', vintage: '2022', estanco: 60, cuisine: 0, resto: 2, total: 62, binEstanco: '13A1/13B3', binCuisine: '4C3', binResto: '2R1' },

  // Ladoix le Cloud (Rouge)
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2021', estanco: 36, cuisine: 0, resto: 0, total: 36, binEstanco: '12A1', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2021', estanco: 23, cuisine: 1, resto: 0, total: 24, binEstanco: '12C1', binCuisine: '4E1', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2019', estanco: 0, cuisine: 2, resto: 4, total: 6, binEstanco: '13C2', binCuisine: '4H5', binResto: '2Q1' },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2019', estanco: 10, cuisine: 0, resto: 1, total: 11, binEstanco: '12B3', binCuisine: '4A3', binResto: '2Q8' },
  { type: 'Rouge', format: 'Bt', name: 'Ladoix le Cloud', vintage: '2020', estanco: 12, cuisine: 1, resto: 1, total: 14, binEstanco: '10B3', binCuisine: '4E5', binResto: 'mur' },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2020', estanco: 58, cuisine: 8, resto: 2, total: 68, binEstanco: '13B1/14A1', binCuisine: '4D4', binResto: '2P1' },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud - 12B3', vintage: '2020', estanco: 3, cuisine: 2, resto: 0, total: 5, binEstanco: '12B3', binCuisine: '4E1', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Ladoix le Cloud', vintage: '2017', estanco: 10, cuisine: 1, resto: 1, total: 12, binEstanco: '12A3', binCuisine: '4A3', binResto: '2O8' },

  // Nuits-Saint-Georges
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2019', estanco: 24, cuisine: 5, resto: 3, total: 32, binEstanco: '13C1', binCuisine: '4H4+4E2', binResto: '2P4' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2019', estanco: 4, cuisine: 0, resto: 2, total: 6, binEstanco: '12B2', binCuisine: '', binResto: '2Q8' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2018', estanco: 0, cuisine: 9, resto: 2, total: 11, binEstanco: '11A2', binCuisine: 'SOL', binResto: '2F7' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru', vintage: '2014', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },

  // Nuits-Saint-Georges 1er Cru Clos des Argillières
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2012', estanco: 6, cuisine: 4, resto: 6, total: 16, binEstanco: '11B3', binCuisine: '4B3', binResto: '2D4' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2011', estanco: 6, cuisine: 5, resto: 6, total: 17, binEstanco: '11C3', binCuisine: '4C2', binResto: '2D5' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2017', estanco: 6, cuisine: 2, resto: 6, total: 14, binEstanco: '11B3', binCuisine: '4C4', binResto: '2D7' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2014', estanco: 0, cuisine: 8, resto: 3, total: 11, binEstanco: '', binCuisine: '4C1', binResto: '2D6' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2021', estanco: 18, cuisine: 0, resto: 0, total: 18, binEstanco: '14B2', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2012', estanco: 5, cuisine: 1, resto: 0, total: 6, binEstanco: '10A3', binCuisine: '4E1', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières', vintage: '2010', estanco: 3, cuisine: 0, resto: 0, total: 3, binEstanco: '14A3', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Argillières - Pure', vintage: '2016', estanco: 0, cuisine: 1, resto: 0, total: 1, binEstanco: '14A2', binCuisine: '4E1', binResto: '' },

  // Clos des Corvées
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2017', estanco: 0, cuisine: 6, resto: 5, total: 11, binEstanco: '11B4', binCuisine: '4C5', binResto: '2E6' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2013', estanco: 15, cuisine: 2, resto: 6, total: 23, binEstanco: '11B2', binCuisine: '4F3', binResto: '2E5' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2009', estanco: 8, cuisine: 0, resto: 6, total: 14, binEstanco: '11C2', binCuisine: '4C5', binResto: '2E4' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2007', estanco: 15, cuisine: 2, resto: 4, total: 21, binEstanco: '11B3', binCuisine: '4C5', binResto: '2E3' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2003', estanco: 6, cuisine: 2, resto: 4, total: 12, binEstanco: '11A1', binCuisine: '4E3', binResto: '2E2' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole', vintage: '2012', estanco: 5, cuisine: 1, resto: 0, total: 6, binEstanco: '10B3/14A2', binCuisine: '4E2', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Clos des Corvées - Monopole Vieilles Vignes', vintage: '2021', estanco: 30, cuisine: 5, resto: 0, total: 35, binEstanco: '14A2', binCuisine: '4E5', binResto: '' },

  // Vieilles Vignes
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2005', estanco: 6, cuisine: 1, resto: 6, total: 13, binEstanco: '11A2', binCuisine: '4C4', binResto: '2F3' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2014', estanco: 24, cuisine: 2, resto: 4, total: 30, binEstanco: '11A3', binCuisine: '4F5', binResto: '2F5' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2018', estanco: 0, cuisine: 6, resto: 6, total: 12, binEstanco: '11A4', binCuisine: '4A5', binResto: '2F6' },
  { type: 'Rouge', format: 'Bt', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2009', estanco: 0, cuisine: 0, resto: 2, total: 2, binEstanco: '11A2', binCuisine: '4C5', binResto: '2F4' },
  { type: 'Rouge', format: 'Mag', name: 'Nuits-Saint-Georges 1er Cru Vieilles Vignes', vintage: '2015', estanco: 10, cuisine: 2, resto: 0, total: 12, binEstanco: '10A3', binCuisine: '4E2', binResto: '' },

  // Pinoterie
  { type: 'Rouge', format: 'Bt', name: 'Bourgogne Pinoterie Pure', vintage: '2017', estanco: 12, cuisine: 1, resto: 3, total: 16, binEstanco: '12C3', binCuisine: '4E5', binResto: '2R1' },
  { type: 'Rouge', format: 'Bt', name: 'Bourgogne Pinoterie', vintage: '2017', estanco: 9, cuisine: 0, resto: 2, total: 11, binEstanco: '12C3', binCuisine: '', binResto: '2N8' },
  { type: 'Rouge', format: 'Mag', name: 'Bourgogne Pinoterie', vintage: '2022', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '14A3', binCuisine: '', binResto: '' },

  // Rosé
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2017', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '13C1', binCuisine: '', binResto: '' },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2018', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '12A1/12B1', binCuisine: '', binResto: '' },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2013', estanco: 0, cuisine: 0, resto: 2, total: 2, binEstanco: '12C2', binCuisine: '4C3', binResto: '1E6' },
  { type: 'Rosé', format: 'Bt', name: 'Bourgogne Rosé', vintage: '2023', estanco: 0, cuisine: 9, resto: 3, total: 12, binEstanco: '13A3', binCuisine: '4A5', binResto: '' },
  { type: 'Rosé', format: 'Mag', name: 'Bourgogne Rosé', vintage: '2017', estanco: 13, cuisine: 4, resto: 1, total: 18, binEstanco: '10A2', binCuisine: '4F5', binResto: '1P8' },

  // Savigny Dessus les Gollardes
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2020', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '12B2', binCuisine: '', binResto: '' },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2021', estanco: 47, cuisine: 5, resto: 4, total: 56, binEstanco: '12B3/11B1', binCuisine: '4B5', binResto: '1N4' },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2023', estanco: 24, cuisine: 3, resto: 1, total: 28, binEstanco: '14C1', binCuisine: '4H5', binResto: 'Sol' },
  { type: 'Blanc', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2018', estanco: 0, cuisine: 2, resto: 6, total: 8, binEstanco: '', binCuisine: '4D2', binResto: '2L1' },
  { type: 'Rouge', format: 'Bt', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2020', estanco: 12, cuisine: 3, resto: 6, total: 21, binEstanco: '12A3', binCuisine: '4F1', binResto: '2K1' },
  { type: 'Rouge', format: 'Mag', name: 'Savigny-lès-Beaune Dessus les Gollardes', vintage: '2018', estanco: 15, cuisine: 0, resto: 1, total: 16, binEstanco: '10C2', binCuisine: '4E2', binResto: 'mur' },

  // Clos Goillote
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2014', estanco: 9, cuisine: 0, resto: 6, total: 15, binEstanco: '10B4', binCuisine: '', binResto: '2N4' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2009', estanco: 0, cuisine: 5, resto: 6, total: 11, binEstanco: '', binCuisine: '4C5', binResto: '2N3' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2017', estanco: 0, cuisine: 9, resto: 6, total: 15, binEstanco: '', binCuisine: '4B4', binResto: '2N5' },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Clos Goillote - Monopole', vintage: '2014', estanco: 3, cuisine: 0, resto: 1, total: 4, binEstanco: '10A1/10B1', binCuisine: '', binResto: '2M8' },

  // Macérations
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2015', estanco: 36, cuisine: 8, resto: 3, total: 47, binEstanco: '13C4', binCuisine: '4F3', binResto: '1N2' },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2019', estanco: 108, cuisine: 8, resto: 4, total: 120, binEstanco: '12M4/12B4', binCuisine: '4D1', binResto: '1O2' },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2020', estanco: 0, cuisine: 0, resto: 3, total: 3, binEstanco: '12C3', binCuisine: '4C1', binResto: '1N3' },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France - Macération', vintage: '2014', estanco: 48, cuisine: 7, resto: 3, total: 58, binEstanco: '12C4', binCuisine: '4D2', binResto: '1M2' },
  { type: 'Blanc', format: 'Bt', name: 'Vin de France', vintage: '2023', estanco: 36, cuisine: 10, resto: 1, total: 47, binEstanco: '14B1/12C2', binCuisine: 'SOL', binResto: 'sol' },
  { type: 'Blanc', format: 'Mag', name: 'Vin de France', vintage: '2023', estanco: 12, cuisine: 0, resto: 0, total: 12, binEstanco: '12B2', binCuisine: '', binResto: '' },
  { type: 'Blanc', format: 'Mag', name: 'Vin de France - Macération', vintage: '2017', estanco: 15, cuisine: 1, resto: 1, total: 17, binEstanco: '10C3', binCuisine: '4E2', binResto: '1M8' },

  // Hautes Maizières
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '1994', estanco: 0, cuisine: 3, resto: 4, total: 7, binEstanco: '', binCuisine: '4B4', binResto: '2N6' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2006', estanco: 6, cuisine: 2, resto: 6, total: 14, binEstanco: '12C2', binCuisine: '4E4', binResto: '2O7' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2017', estanco: 0, cuisine: 0, resto: 3, total: 3, binEstanco: '', binCuisine: '4E4', binResto: '2M7' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2021', estanco: 18, cuisine: 0, resto: 0, total: 18, binEstanco: '14B2', binCuisine: '', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Hautes Maizières', vintage: '2012', estanco: 12, cuisine: 1, resto: 6, total: 19, binEstanco: '11C2', binCuisine: '4A5', binResto: '2N7' },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Hautes Maizières', vintage: '2014', estanco: 3, cuisine: 1, resto: 0, total: 4, binEstanco: '10A1/14A1', binCuisine: '4E2', binResto: '' },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Hautes Maizières', vintage: '2016', estanco: 0, cuisine: 0, resto: 1, total: 1, binEstanco: '', binCuisine: '4E2', binResto: 'mur' },

  // Les Clous
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2009', estanco: 18, cuisine: 1, resto: 6, total: 25, binEstanco: '11B2', binCuisine: '4D4', binResto: '2O1' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2012', estanco: 18, cuisine: 2, resto: 6, total: 26, binEstanco: '11C1', binCuisine: '4B5', binResto: '2N1' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée Les Clous', vintage: '2016', estanco: 12, cuisine: 2, resto: 6, total: 20, binEstanco: '12A2', binCuisine: '4B5', binResto: '2M1' },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée Les Clous', vintage: '2012', estanco: 6, cuisine: 5, resto: 0, total: 11, binEstanco: '10B1', binCuisine: '4E5', binResto: '' },

  // Les Suchots
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2007', estanco: 0, cuisine: 1, resto: 0, total: 1, binEstanco: '', binCuisine: '4B3', binResto: '' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2014', estanco: 0, cuisine: 2, resto: 1, total: 3, binEstanco: '', binCuisine: '4A5', binResto: '2E6' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2015', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '13A1', binCuisine: '', binResto: '2E7' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2009', estanco: 0, cuisine: 3, resto: 4, total: 7, binEstanco: '12A2', binCuisine: '4A5', binResto: '2N2' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2016', estanco: 0, cuisine: 0, resto: 2, total: 2, binEstanco: '', binCuisine: '4E4', binResto: '2M2' },
  { type: 'Rouge', format: 'Bt', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2006', estanco: 0, cuisine: 0, resto: 0, total: 0, binEstanco: '', binCuisine: '', binResto: '2O2/1P0' },
  { type: 'Rouge', format: 'Mag', name: 'Vosne-Romanée 1er Cru Les Suchots', vintage: '2014', estanco: 2, cuisine: 1, resto: 0, total: 3, binEstanco: '10A1', binCuisine: '4E1', binResto: '2N8' },

  // Vougeot 1er Cru
  { type: 'Rouge', format: 'Mag', name: 'Vougeot 1er Cru', vintage: '2011', estanco: 9, cuisine: 1, resto: 0, total: 10, binEstanco: '10A1/14A1', binCuisine: '4E1', binResto: '' }
];

async function main() {
  const winesCol = collection(db, 'wines');
  const winesSnap = await getDocs(winesCol);
  const dbWines = winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  // Read the saved existing prices file
  const prices = JSON.parse(fs.readFileSync('dpr_existing_prices.json', 'utf8'));

  console.log('Starting migration...');

  // 1. Identify all Prieuré-Roch wines to delete
  const dprWinesToDelete = dbWines.filter(dw => {
    const dwDomain = (dw.domain || '').toLowerCase();
    return dwDomain.includes('prieure') || dwDomain.includes('roch') || dwDomain.includes('dpr') || dwDomain === '2019' || dwDomain === '2020' || dwDomain === '2016';
  });

  console.log(`Found ${dprWinesToDelete.length} existing Prieuré-Roch wine entries to delete.`);

  // Delete them in batches of 500
  let batch = writeBatch(db);
  let batchCount = 0;
  for (const w of dprWinesToDelete) {
    batch.delete(doc(db, 'wines', w.id));
    batchCount++;
    if (batchCount === 400) {
      await batch.commit();
      console.log('Committed delete batch of 400.');
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed remaining ${batchCount} deletes.`);
  }

  // Helper function to find price from dpr_existing_prices.json or fallback
  const getPrices = (name: string, vintage: string, format: 'Bt' | 'Mag') => {
    const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    
    // Check various combinations of keys
    const formatKey = format.toLowerCase();
    const cleanName = cleanStr(name);

    const keysToTry = [
      `${cleanName}_${vintage}_${formatKey}`,
      `${cleanName}mag_${vintage}_${formatKey}`,
      `${cleanName}pure_${vintage}_${formatKey}`,
      `${cleanName}monopole_${vintage}_${formatKey}`,
      `${cleanName}monopolevieillesvignes_${vintage}_${formatKey}`
    ];

    for (const key of keysToTry) {
      if (prices[key]) {
        return prices[key];
      }
    }

    // Smart fallback values for the new 2021 wines
    if (cleanName.includes('argillieres') && vintage === '2021') {
      return { priceBuyHt: 171, priceSell: 480 };
    }
    if (cleanName.includes('maizieres') && vintage === '2021') {
      return { priceBuyHt: 187, priceSell: 525 };
    }
    if (cleanName.includes('pinoterie') && vintage === '2017') {
      return { priceBuyHt: 72, priceSell: 210 };
    }

    // Default general fallback
    return { priceBuyHt: 45, priceSell: 126 };
  };

  // 2. Insert new cleaned wines matching Excel row by row
  batch = writeBatch(db);
  batchCount = 0;
  let totalBottlesInserted = 0;

  for (const ew of excelWines) {
    const p = getPrices(ew.name, ew.vintage, ew.format);

    // Format the clean display name
    let displayName = ew.name;
    if (ew.format === 'Mag' && !displayName.includes('(Mag)')) {
      displayName = `${displayName} (Mag)`;
    }

    // Determine the sites that have stock (or if total is 0, add 1 entry with qty 0 in site-3)
    const sitesBreakdown: { siteId: string; quantity: number; bin: string; notes: string }[] = [];

    if (ew.total === 0) {
      sitesBreakdown.push({
        siteId: 'site-3',
        quantity: 0,
        bin: ew.binEstanco || '',
        notes: 'Importation de stock (Vide)'
      });
    } else {
      if (ew.estanco > 0) {
        sitesBreakdown.push({
          siteId: 'site-3',
          quantity: ew.estanco,
          bin: ew.binEstanco,
          notes: 'Importation de stock - Réserve Estanco'
        });
      }
      if (ew.cuisine > 0) {
        sitesBreakdown.push({
          siteId: 'site-6',
          quantity: ew.cuisine,
          bin: ew.binCuisine,
          notes: 'Importation de stock - Cuisine'
        });
      }
      if (ew.resto > 0) {
        // Red wines go to site-2 (Rouges), whites/rosés go to site-1 (Blancs)
        const targetSite = ew.type === 'Rouge' ? 'site-2' : 'site-1';
        sitesBreakdown.push({
          siteId: targetSite,
          quantity: ew.resto,
          bin: ew.binResto,
          notes: ew.type === 'Rouge' ? 'Importation de stock - Restaurant (Rouges)' : 'Importation de stock - Restaurant (Blancs)'
        });
      }
    }

    // Create the document for each site
    for (const site of sitesBreakdown) {
      const docId = `wine_dpr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const wineDocRef = doc(db, 'wines', docId);

      const newWine = {
        id: docId,
        domain: 'Domaine Prieuré-Roch',
        name: displayName,
        vintage: ew.vintage,
        color: ew.type.toLowerCase(),
        quantity: site.quantity,
        siteId: site.siteId,
        bin: site.bin || '',
        priceBuyHt: p.priceBuyHt,
        priceBuy: p.priceBuyHt,
        priceSell: p.priceSell,
        region: 'Bourgogne',
        appellation: ew.name,
        cuvee: '',
        alertThreshold: ew.format === 'Mag' ? 1 : 2,
        notes: site.notes,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      batch.set(wineDocRef, newWine);
      totalBottlesInserted += site.quantity;
      batchCount++;

      if (batchCount === 400) {
        await batch.commit();
        console.log('Committed write batch of 400.');
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed remaining ${batchCount} writes.`);
  }

  console.log(`Migration complete! Successfully inserted ${totalBottlesInserted} bottles.`);
  process.exit(0);
}

main().catch(console.error);
