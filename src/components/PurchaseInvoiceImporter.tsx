import React, { useState, useRef, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, Site, getCanonicalDomain, normalizeWineString, isSameWineReference } from '../types';
import { calculateSellingPrice } from '../lib/pricing';
import { findBestWineMatchInCatalog, findSmartWineMatchWithTypo, WineTypoSuggestion, normalizeVintage } from '../lib/wineMatching';
import { matchesWineSearch, getWineSearchRelevanceScore } from '../lib/stringUtils';
import * as XLSX from 'xlsx';
import { 
  Truck, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Check, 
  X, 
  Layers, 
  Calendar, 
  Hash, 
  Plus, 
  Building2,
  DollarSign,
  Unlink,
  HelpCircle,
  ArrowRight,
  Trash2
} from 'lucide-react';

export interface PurchaseLineItem {
  id: string;
  rawLabel: string;
  domain: string;
  wineName: string;
  vintage: string;
  color: WineColor;
  format?: string;
  quantity: number;
  priceBuyHt: number;
  shippingCostPerUnit?: number;
  
  // Matched wine in existing database if any
  selectedWineId: string | null;
  isNewReference: boolean;
  targetSiteId: string;
  isIncluded: boolean;
  status: 'matched' | 'new_ref' | 'suggested';
  suggestedMatch?: WineTypoSuggestion | null;
}

/**
 * Resilient deterministic parser for Excel (.xlsx, .xls, .csv) invoice sheets
 */
export function parseExcelInvoiceLocally(
  rows: any[][],
  wines: Wine[],
  defaultSite: string,
  supplierFallback: string
): { items: PurchaseLineItem[]; shippingTotal: number; supplierName?: string; invoiceNumber?: string; invoiceDate?: string } {
  let detectedSupplier = supplierFallback || '';
  let detectedInvoiceNumber = '';
  let detectedInvoiceDate = '';
  let shippingTotal = 0;
  const items: PurchaseLineItem[] = [];

  // 1. Scan metadata in first 20 rows
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map(c => String(c || '')).join(' ');
    
    // Look for invoice number
    const invMatch = rowStr.match(/(?:facture|invoice|ref|n°|numéro)\s*[:#]?\s*([A-Za-z0-9\-_/]+)/i);
    if (invMatch && !detectedInvoiceNumber) {
      detectedInvoiceNumber = invMatch[1].trim();
    }
    // Look for date YYYY-MM-DD or DD/MM/YYYY
    const dateMatch = rowStr.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
    if (dateMatch && !detectedInvoiceDate) {
      const d = dateMatch[1];
      if (d.includes('/')) {
        const parts = d.split('/');
        if (parts[2].length === 4) {
          detectedInvoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else {
        detectedInvoiceDate = d;
      }
    }
    // Look for supplier/domain
    const supMatch = rowStr.match(/(?:fournisseur|domaine|émetteur|vigneron|maison)\s*[:]\s*([^,\n]+)/i);
    if (supMatch && !detectedSupplier) {
      detectedSupplier = supMatch[1].trim();
    }
  }

  // 2. Find header row
  let headerRowIdx = -1;
  let colDesc = -1;
  let colDomain = -1;
  let colWine = -1;
  let colVintage = -1;
  let colQty = -1;
  let colPrice = -1;
  let colTotal = -1;

  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const normCols = row.map(c => String(c || '').toLowerCase().trim());
    
    let hasName = false;
    let hasQtyOrPrice = false;

    normCols.forEach((col, idx) => {
      if (col.includes('désignation') || col.includes('designation') || col.includes('libellé') || col.includes('libelle') || col.includes('article') || col.includes('produit') || col.includes('description')) {
        colDesc = idx;
        hasName = true;
      }
      if (col === 'vin' || col === 'nom' || col === 'cuvée' || col === 'cuvee' || col === 'appellation') {
        colWine = idx;
        hasName = true;
      }
      if (col === 'domaine' || col === 'producteur' || col === 'fournisseur') {
        colDomain = idx;
      }
      if (col.includes('millésime') || col.includes('millesime') || col.includes('année') || col.includes('annee') || col === 'vintage') {
        colVintage = idx;
      }
      if (col.includes('qté') || col.includes('qte') || col.includes('quantité') || col.includes('quantite') || col.includes('nombre') || col === 'colis' || col === 'bt' || col === 'blles') {
        colQty = idx;
        hasQtyOrPrice = true;
      }
      if (col.includes('prix') || col.includes('p.u') || col.includes('pu ht') || col.includes('unitaire') || col === 'ht' || col === 'tarif') {
        if (!col.includes('total')) {
          colPrice = idx;
          hasQtyOrPrice = true;
        }
      }
      if (col.includes('total ht') || col.includes('montant ht')) {
        colTotal = idx;
      }
    });

    if (hasName && hasQtyOrPrice) {
      headerRowIdx = r;
      break;
    }
  }

  // Fallback header guessing if standard keywords were not found
  if (headerRowIdx === -1) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length < 2) continue;
      const numCount = row.filter(c => typeof c === 'number' || (!isNaN(parseFloat(c)) && isFinite(c))).length;
      if (numCount >= 1 && (typeof row[0] === 'string' || typeof row[1] === 'string')) {
        headerRowIdx = Math.max(0, r - 1);
        colDesc = 0;
        colQty = 1;
        colPrice = row.length > 2 ? 2 : 1;
        break;
      }
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check for shipping row
    const rowText = row.map(c => String(c || '')).join(' ').toLowerCase();
    const isShipping = /(frais\s+de\s+(transport|port|livraison)|participation\s+aux\s+frais|forfait\s+port|transport|port\s+pay[eé])/i.test(rowText);
    
    if (isShipping) {
      const nums = row.map(c => parseFloat(String(c).replace(',', '.'))).filter(n => !isNaN(n) && n > 0);
      if (nums.length > 0) {
        shippingTotal += nums[nums.length - 1];
      }
      continue;
    }

    let rawDesc = '';
    if (colDesc >= 0 && row[colDesc] !== undefined) {
      rawDesc = String(row[colDesc] || '').trim();
    } else if (colWine >= 0 && row[colWine] !== undefined) {
      rawDesc = `${row[colDomain] ? `${row[colDomain]} ` : ''}${row[colWine]}`.trim();
    } else {
      rawDesc = String(row[0] || '').trim();
    }

    if (!rawDesc || rawDesc.length < 2) continue;
    if (/(total\s+ht|total\s+ttc|tva|sous-total|net\s+[aà]\s+payer|acompte)/i.test(rawDesc)) continue;

    // Extract quantity
    let qty = 1;
    if (colQty >= 0 && row[colQty] !== undefined) {
      const parsedQty = parseInt(String(row[colQty]).replace(/\s+/g, ''));
      if (!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty;
    } else {
      const mQty = rawDesc.match(/\b(\d+)\s*(?:bt|blles?|cols?|bouteilles?|colis)\b/i);
      if (mQty) qty = parseInt(mQty[1]);
    }

    // Extract price
    let price = 0;
    if (colPrice >= 0 && row[colPrice] !== undefined) {
      const parsedPrice = parseFloat(String(row[colPrice]).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedPrice) && parsedPrice >= 0) price = parsedPrice;
    } else if (colTotal >= 0 && row[colTotal] !== undefined && qty > 0) {
      const parsedTotal = parseFloat(String(row[colTotal]).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedTotal) && parsedTotal > 0) price = Math.round((parsedTotal / qty) * 100) / 100;
    }

    // Extract vintage (4 digits e.g. 2021)
    let vintage = '';
    if (colVintage >= 0 && row[colVintage] !== undefined) {
      const rawV = String(row[colVintage]).trim();
      const vMatch = rawV.match(/\b(19\d\d|20\d\d)\b/);
      if (vMatch) vintage = vMatch[1];
      else if (rawV.toLowerCase().includes('s.a') || rawV.toLowerCase().includes('nv')) vintage = 'S.A.';
    }
    if (!vintage) {
      const vMatch = rawDesc.match(/\b(19\d\d|20\d\d)\b/);
      if (vMatch) vintage = vMatch[1];
    }

    // Extract domain & wineName
    let domain = detectedSupplier || '';
    if (colDomain >= 0 && row[colDomain] !== undefined && String(row[colDomain]).trim()) {
      domain = String(row[colDomain]).trim();
    }
    let wineName = rawDesc;
    if (domain && wineName.toLowerCase().startsWith(domain.toLowerCase())) {
      wineName = wineName.substring(domain.length).trim().replace(/^[-–—:]\s*/, '');
    }

    const outcome = findSmartWineMatchWithTypo({
      domain: domain || supplierFallback,
      name: wineName,
      vintage,
      color: 'rouge',
      rawLabel: rawDesc,
      targetSiteId: defaultSite
    }, wines);

    let matchedWine: Wine | null = null;
    let suggestedMatch: WineTypoSuggestion | null = null;
    let status: 'matched' | 'new_ref' | 'suggested' = 'new_ref';

    if (outcome.status === 'matched' && outcome.matchedWine) {
      const vMatch = normalizeVintage(vintage);
      const wVMatch = normalizeVintage(outcome.matchedWine.vintage);
      if (vMatch && wVMatch && vMatch === wVMatch) {
        matchedWine = outcome.matchedWine;
        status = 'matched';
      } else if (!vMatch && wVMatch) {
        suggestedMatch = {
          wine: outcome.matchedWine,
          score: 80,
          reason: `Même cuvée en cave (${outcome.matchedWine.vintage || 'S.A.'}) — veuillez vérifier le millésime reçu`,
          domainSimilarity: 100,
          nameSimilarity: 100
        };
        status = 'suggested';
      } else if (vMatch && !wVMatch) {
        suggestedMatch = {
          wine: outcome.matchedWine,
          score: 75,
          reason: `Cuvée existante sans millésime (vous recevez le millésime ${vintage})`,
          domainSimilarity: 100,
          nameSimilarity: 100
        };
        status = 'suggested';
      } else {
        matchedWine = outcome.matchedWine;
        status = 'matched';
      }
    } else if (outcome.status === 'suggested' && outcome.suggestedMatch) {
      suggestedMatch = outcome.suggestedMatch;
      status = 'suggested';
    }

    items.push({
      id: `purch_item_loc_${Date.now()}_${r}`,
      rawLabel: rawDesc,
      domain: domain || supplierFallback || (matchedWine?.domain || 'Domaine'),
      wineName: wineName || (matchedWine?.name || 'Vin'),
      vintage: vintage || '',
      color: (matchedWine?.color || 'rouge') as WineColor,
      format: matchedWine?.format || 'Bouteille (75cl)',
      quantity: qty,
      priceBuyHt: price,
      shippingCostPerUnit: 0,
      selectedWineId: matchedWine ? matchedWine.id : null,
      isNewReference: !matchedWine,
      targetSiteId: matchedWine ? matchedWine.siteId : defaultSite,
      isIncluded: true,
      status,
      suggestedMatch
    });
  }

  return {
    items,
    shippingTotal: Math.round(shippingTotal * 100) / 100,
    supplierName: detectedSupplier,
    invoiceNumber: detectedInvoiceNumber,
    invoiceDate: detectedInvoiceDate
  };
}

/**
 * Resilient deterministic parser for raw copy-pasted invoice text
 */
export function parseTextInvoiceLocally(
  text: string,
  wines: Wine[],
  defaultSite: string,
  supplierFallback: string
): { items: PurchaseLineItem[]; shippingTotal: number; supplierName?: string; invoiceNumber?: string; invoiceDate?: string } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let detectedSupplier = supplierFallback || '';
  let detectedInvoiceNumber = '';
  let detectedInvoiceDate = '';
  let shippingTotal = 0;
  const items: PurchaseLineItem[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check for invoice header
    const invMatch = line.match(/(?:facture|invoice|ref|n°|numéro)\s*[:#]?\s*([A-Za-z0-9\-_/]+)/i);
    if (invMatch && !detectedInvoiceNumber) detectedInvoiceNumber = invMatch[1].trim();

    const dateMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
    if (dateMatch && !detectedInvoiceDate) {
      const d = dateMatch[1];
      if (d.includes('/')) {
        const parts = d.split('/');
        if (parts[2].length === 4) detectedInvoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        detectedInvoiceDate = d;
      }
    }

    // Check for shipping
    if (/(frais\s+de\s+(transport|port|livraison)|transport|port\s+pay[eé]|participation\s+port)/i.test(line)) {
      const priceM = line.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur)/i);
      if (priceM) {
        shippingTotal += parseFloat(priceM[1].replace(',', '.'));
      }
      continue;
    }

    if (/(total\s+ht|total\s+ttc|tva|sous-total|net\s+[aà]\s+payer)/i.test(line)) continue;

    // Extract quantity e.g. "12 bt", "6 cols", "12 x", "x 6"
    let qty = 1;
    const qtyM = line.match(/\b(\d+)\s*(?:bt|blles?|cols?|bouteilles?|colis|x\b)/i) || line.match(/\bx\s*(\d+)\b/i);
    if (qtyM) qty = parseInt(qtyM[1]);

    // Extract price e.g. "85.00€ HT", "85 €", "85,50"
    let price = 0;
    const priceM = line.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur)/i) || line.match(/(\d+(?:[.,]\d+)?)\s*ht/i);
    if (priceM) {
      price = parseFloat(priceM[1].replace(',', '.'));
    }

    // Extract vintage e.g. "2020", "2018"
    let vintage = '';
    const vintageM = line.match(/\b(19\d\d|20\d\d)\b/);
    if (vintageM) vintage = vintageM[1];

    // Clean description
    let cleanDesc = line
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:€|eur|ht|ttc)/gi, '')
      .replace(/\b(\d+)\s*(?:bt|blles?|cols?|bouteilles?|colis|x\b)/gi, '')
      .replace(/\bx\s*(\d+)\b/gi, '')
      .replace(/\b(19\d\d|20\d\d)\b/g, '')
      .replace(/[-–—/:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanDesc || cleanDesc.length < 3) continue;

    // Check if domain is separated by hyphen or at start
    const outcome = findSmartWineMatchWithTypo({
      domain: detectedSupplier || supplierFallback,
      name: cleanDesc,
      vintage,
      color: 'rouge',
      rawLabel: line,
      targetSiteId: defaultSite
    }, wines);

    let matchedWine: Wine | null = null;
    let suggestedMatch: WineTypoSuggestion | null = null;
    let status: 'matched' | 'new_ref' | 'suggested' = 'new_ref';

    if (outcome.status === 'matched' && outcome.matchedWine) {
      const vMatch = normalizeVintage(vintage);
      const wVMatch = normalizeVintage(outcome.matchedWine.vintage);
      if (vMatch && wVMatch && vMatch === wVMatch) {
        matchedWine = outcome.matchedWine;
        status = 'matched';
      } else if (!vMatch && wVMatch) {
        suggestedMatch = {
          wine: outcome.matchedWine,
          score: 80,
          reason: `Même cuvée en cave (${outcome.matchedWine.vintage || 'S.A.'}) — veuillez vérifier le millésime reçu`,
          domainSimilarity: 100,
          nameSimilarity: 100
        };
        status = 'suggested';
      } else if (vMatch && !wVMatch) {
        suggestedMatch = {
          wine: outcome.matchedWine,
          score: 75,
          reason: `Cuvée existante sans millésime (vous recevez le millésime ${vintage})`,
          domainSimilarity: 100,
          nameSimilarity: 100
        };
        status = 'suggested';
      } else {
        matchedWine = outcome.matchedWine;
        status = 'matched';
      }
    } else if (outcome.status === 'suggested' && outcome.suggestedMatch) {
      suggestedMatch = outcome.suggestedMatch;
      status = 'suggested';
    }

    items.push({
      id: `purch_item_text_${Date.now()}_${idx}`,
      rawLabel: line,
      domain: detectedSupplier || supplierFallback || (matchedWine?.domain || 'Domaine'),
      wineName: cleanDesc || (matchedWine?.name || 'Vin'),
      vintage: vintage || '',
      color: (matchedWine?.color || 'rouge') as WineColor,
      format: matchedWine?.format || 'Bouteille (75cl)',
      quantity: qty,
      priceBuyHt: price,
      shippingCostPerUnit: 0,
      selectedWineId: matchedWine ? matchedWine.id : null,
      isNewReference: !matchedWine,
      targetSiteId: matchedWine ? matchedWine.siteId : defaultSite,
      isIncluded: true,
      status,
      suggestedMatch
    });
  }

  return {
    items,
    shippingTotal: Math.round(shippingTotal * 100) / 100,
    supplierName: detectedSupplier,
    invoiceNumber: detectedInvoiceNumber,
    invoiceDate: detectedInvoiceDate
  };
}

interface PurchaseInvoiceImporterProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export const PurchaseInvoiceImporter: React.FC<PurchaseInvoiceImporterProps> = ({ onClose, onSuccess }) => {
  const { wines, sites, updateWine, addWine, addMovement, user } = useFirebase();

  const [importMode, setImportMode] = useState<'pdf' | 'excel' | 'text'>('pdf');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{ 
    totalQty: number; 
    linesCount: number; 
    newRefsCount: number;
    totalShippingAdded?: number;
    totalInvoiceHt?: number;
  } | null>(null);

  // File uploads
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invoice metadata
  const [supplierName, setSupplierName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [defaultDestinationSiteId, setDefaultDestinationSiteId] = useState<string>('');

  // Items
  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [totalShippingCostHt, setTotalShippingCostHt] = useState<number>(0);
  const [step, setStep] = useState<'upload' | 'review' | 'confirmed'>('upload');

  // Initial site selection (prefer Site 3 or 4: Réserve)
  React.useEffect(() => {
    if (sites.length > 0 && !defaultDestinationSiteId) {
      const reserveSite = sites.find(s => s.name.toLowerCase().includes('site 3') || s.name.toLowerCase().includes('réserve'));
      setDefaultDestinationSiteId(reserveSite ? reserveSite.id : sites[0].id);
    }
  }, [sites, defaultDestinationSiteId]);

  // Wine reassignment modal
  const [reassigningItemIndex, setReassigningItemIndex] = useState<number | null>(null);
  const [wineSearchQuery, setWineSearchQuery] = useState<string>('');

  const findBestWineMatch = (domain: string, name: string, vintage: string, targetSiteId?: string): Wine | null => {
    if (!wines || wines.length === 0) return null;
    const result = findBestWineMatchInCatalog({
      domain,
      name,
      vintage,
      targetSiteId
    }, wines);
    return result.wine;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = err => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleStartManualEntry = () => {
    const defaultSite = defaultDestinationSiteId || (sites[0]?.id || '');
    if (items.length === 0) {
      setItems([{
        id: `purch_item_manual_${Date.now()}_1`,
        rawLabel: 'Nouvelle ligne de vin',
        domain: supplierName || 'Domaine',
        wineName: '',
        vintage: '',
        color: 'rouge',
        format: 'Bouteille (75cl)',
        quantity: 6,
        priceBuyHt: 0,
        shippingCostPerUnit: 0,
        selectedWineId: null,
        isNewReference: true,
        targetSiteId: defaultSite,
        isIncluded: true,
        status: 'new_ref'
      }]);
    }
    setStep('review');
  };

  const addNewItem = () => {
    const defaultSite = defaultDestinationSiteId || (sites[0]?.id || '');
    const currentBottles = items.filter(i => i.isIncluded).reduce((acc, curr) => acc + curr.quantity, 0);
    const fallbackShipping = totalShippingCostHt > 0 && currentBottles > 0
      ? Math.round((totalShippingCostHt / (currentBottles + 6)) * 100) / 100
      : 0;

    const newItem: PurchaseLineItem = {
      id: `purch_item_manual_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      rawLabel: 'Nouvelle référence',
      domain: supplierName || 'Domaine',
      wineName: '',
      vintage: '',
      color: 'rouge',
      format: 'Bouteille (75cl)',
      quantity: 6,
      priceBuyHt: 0,
      shippingCostPerUnit: fallbackShipping,
      selectedWineId: null,
      isNewReference: true,
      targetSiteId: defaultSite,
      isIncluded: true,
      status: 'new_ref'
    };

    setItems(prev => [newItem, ...prev]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItemField = (id: string, field: keyof PurchaseLineItem, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      return { ...i, [field]: value };
    }));
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisProgress('Lecture des documents en cours...');

    try {
      let extractedData: any = null;
      let usedLocalFallback = false;

      // Compact catalog references (up to 1000 wines) to help Gemini match accurately with cuvee and domain
      const catalogForAi = wines.slice(0, 1000).map(w => ({
        id: w.id,
        name: w.name,
        cuvee: w.cuvee || '',
        domain: w.domain,
        vintage: w.vintage,
        color: w.color
      }));

      const defaultSite = defaultDestinationSiteId || (sites[0]?.id || '');

      if (importMode === 'excel') {
        if (!selectedFile) throw new Error('Veuillez sélectionner un fichier Excel.');
        setAnalysisProgress('Lecture du tableau Excel...');
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 }) as any[][];

        setAnalysisProgress('Extraction et rapprochement avec le catalogue...');
        let usedAi = false;
        try {
          const res = await fetch('/api/gemini/parse-purchase-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rawRows: jsonRows.slice(0, 150),
              existingCatalog: catalogForAi
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.items) && data.items.length > 0) {
              extractedData = data;
              usedAi = true;
            }
          }
        } catch (apiErr) {
          console.warn('AI unavailable, falling back to local Excel parser:', apiErr);
        }

        // Deterministic local parser fallback
        if (!usedAi || !extractedData || !extractedData.items || extractedData.items.length === 0) {
          setAnalysisProgress('Analyse directe des colonnes du tableau...');
          const localParsed = parseExcelInvoiceLocally(
            jsonRows,
            wines,
            defaultSite,
            supplierName
          );
          if (localParsed.items.length > 0) {
            extractedData = {
              supplierName: localParsed.supplierName || supplierName,
              invoiceNumber: localParsed.invoiceNumber || invoiceNumber,
              invoiceDate: localParsed.invoiceDate || invoiceDate,
              totalShippingCostHt: localParsed.shippingTotal,
              items: localParsed.items
            };
            usedLocalFallback = true;
          } else {
            throw new Error("Impossible de détecter automatiquement les colonnes de ce fichier. Vous pouvez utiliser la saisie manuelle.");
          }
        }
      } else if (importMode === 'pdf') {
        if (!selectedFile) throw new Error('Veuillez sélectionner un fichier PDF.');
        setAnalysisProgress('Conversion et transmission du PDF...');
        const base64Pdf = await readFileAsBase64(selectedFile);

        setAnalysisProgress('Analyse du document et extraction des données...');
        const res = await fetch('/api/gemini/parse-purchase-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64: base64Pdf,
            existingCatalog: catalogForAi
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Erreur lors de l\'analyse du PDF. Vous pouvez passer en saisie manuelle.');
        }
        extractedData = await res.json();
      } else {
        if (!rawText.trim()) throw new Error('Veuillez coller le texte de la facture.');
        setAnalysisProgress('Analyse du texte brut...');
        let usedAi = false;
        try {
          const res = await fetch('/api/gemini/parse-purchase-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rawText: rawText.trim(),
              existingCatalog: catalogForAi
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.items) && data.items.length > 0) {
              extractedData = data;
              usedAi = true;
            }
          }
        } catch (apiErr) {
          console.warn('AI unavailable, falling back to local text parser:', apiErr);
        }

        if (!usedAi || !extractedData || !extractedData.items || extractedData.items.length === 0) {
          const localParsed = parseTextInvoiceLocally(
            rawText.trim(),
            wines,
            defaultSite,
            supplierName
          );
          if (localParsed.items.length > 0) {
            extractedData = {
              supplierName: localParsed.supplierName || supplierName,
              invoiceNumber: localParsed.invoiceNumber || invoiceNumber,
              invoiceDate: localParsed.invoiceDate || invoiceDate,
              totalShippingCostHt: localParsed.shippingTotal,
              items: localParsed.items
            };
            usedLocalFallback = true;
          } else {
            throw new Error("Aucune ligne de vin n'a pu être extraite du texte. Vous pouvez utiliser la saisie manuelle.");
          }
        }
      }

      if (extractedData?.supplierName) setSupplierName(extractedData.supplierName);
      if (extractedData?.invoiceNumber) setInvoiceNumber(extractedData.invoiceNumber);
      if (extractedData?.invoiceDate) setInvoiceDate(extractedData.invoiceDate);

      let parsedShippingTotal = 0;
      if (typeof extractedData?.totalShippingCostHt === 'number' && extractedData.totalShippingCostHt >= 0) {
        parsedShippingTotal = extractedData.totalShippingCostHt;
      }

      const rawItems = extractedData?.items || [];
      if (rawItems.length === 0) {
        throw new Error('Aucune ligne de vin n\'a été détectée sur cette facture.');
      }

      const totalBottlesInInvoice = rawItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
      const fallbackUnitShipping = parsedShippingTotal > 0 && totalBottlesInInvoice > 0
        ? Math.round((parsedShippingTotal / totalBottlesInInvoice) * 100) / 100
        : 0;

      const mapped: PurchaseLineItem[] = rawItems.map((item: any, idx: number) => {
        // If already structured PurchaseLineItem from local parser
        if (item.id && item.status && item.targetSiteId) {
          return {
            ...item,
            shippingCostPerUnit: item.shippingCostPerUnit || fallbackUnitShipping
          };
        }

        let matchedWine: Wine | null = null;
        let suggestedMatch: WineTypoSuggestion | null = null;
        let status: 'matched' | 'new_ref' | 'suggested' = 'new_ref';

        if (item.matchedWineId && item.matchedWineId !== 'null' && item.matchedWineId !== 'undefined') {
          const candidate = wines.find(w => w.id === item.matchedWineId) || null;
          if (candidate) {
            const vInvoice = normalizeVintage(item.vintage);
            const vCatalog = normalizeVintage(candidate.vintage);
            if (vInvoice && vCatalog && vInvoice !== vCatalog) {
              // Different vintage! (e.g. invoice 2023 vs catalog 2021) -> do not force match!
              matchedWine = null;
              status = 'new_ref';
            } else if (!vInvoice && vCatalog) {
              suggestedMatch = {
                wine: candidate,
                score: 80,
                reason: `Même vin en cave (${candidate.vintage}) — veuillez vérifier le millésime reçu`,
                domainSimilarity: 100,
                nameSimilarity: 100
              };
              matchedWine = null;
              status = 'suggested';
            } else {
              matchedWine = candidate;
              status = 'matched';
            }
          }
        }

        if (!matchedWine && status !== 'suggested') {
          const outcome = findSmartWineMatchWithTypo({
            domain: item.domain || supplierName,
            name: item.wineName,
            vintage: item.vintage,
            color: item.color,
            rawLabel: item.rawLabel,
            targetSiteId: defaultSite
          }, wines);

          if (outcome.status === 'matched' && outcome.matchedWine) {
            const vInvoice = normalizeVintage(item.vintage);
            const vCatalog = normalizeVintage(outcome.matchedWine.vintage);
            if (vInvoice && vCatalog && vInvoice === vCatalog) {
              matchedWine = outcome.matchedWine;
              status = 'matched';
            } else if (!vInvoice && vCatalog) {
              suggestedMatch = {
                wine: outcome.matchedWine,
                score: 80,
                reason: `Même cuvée en cave (${outcome.matchedWine.vintage || 'S.A.'}) — veuillez renseigner le millésime`,
                domainSimilarity: 100,
                nameSimilarity: 100
              };
              status = 'suggested';
            } else if (!vInvoice && !vCatalog) {
              matchedWine = outcome.matchedWine;
              status = 'matched';
            } else {
              status = 'new_ref';
            }
          } else if (outcome.status === 'suggested' && outcome.suggestedMatch) {
            suggestedMatch = outcome.suggestedMatch;
            status = 'suggested';
          } else {
            status = 'new_ref';
          }
        }

        const isNew = !matchedWine;
        const itemPort = typeof item.shippingCostPerUnit === 'number' && item.shippingCostPerUnit > 0
          ? item.shippingCostPerUnit
          : fallbackUnitShipping;

        return {
          id: `purch_item_${Date.now()}_${idx}`,
          rawLabel: item.rawLabel || `${item.domain} ${item.wineName}`,
          domain: item.domain || supplierName || 'Domaine',
          wineName: item.wineName || 'Vin',
          vintage: item.vintage || '',
          color: (item.color || 'rouge') as WineColor,
          format: item.format || 'Bouteille (75cl)',
          quantity: item.quantity && item.quantity > 0 ? item.quantity : 6,
          priceBuyHt: item.priceBuyHt && item.priceBuyHt > 0 ? item.priceBuyHt : 0,
          shippingCostPerUnit: itemPort,
          selectedWineId: matchedWine ? matchedWine.id : null,
          isNewReference: isNew,
          targetSiteId: matchedWine ? matchedWine.siteId : defaultSite,
          isIncluded: true,
          status,
          suggestedMatch
        };
      });

      if (parsedShippingTotal === 0) {
        const sumItemPort = mapped.reduce((acc, it) => acc + (it.quantity * (it.shippingCostPerUnit || 0)), 0);
        if (sumItemPort > 0) parsedShippingTotal = Math.round(sumItemPort * 100) / 100;
      }
      setTotalShippingCostHt(parsedShippingTotal);

      setItems(mapped);
      setStep('review');
    } catch (err: any) {
      console.error('Error parsing purchase invoice:', err);
      setErrorMessage(err.message || 'Erreur inattendue.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const kpis = useMemo(() => {
    const included = items.filter(i => i.isIncluded);
    const totalBottles = included.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalAmountHt = included.reduce((acc, curr) => acc + (curr.quantity * curr.priceBuyHt), 0);
    const totalShippingHt = included.reduce((acc, curr) => acc + (curr.quantity * (curr.shippingCostPerUnit || 0)), 0);
    const totalAmountWithShippingHt = totalAmountHt + totalShippingHt;
    const matchedCount = items.filter(i => i.status === 'matched').length;
    const suggestedCount = items.filter(i => i.status === 'suggested').length;
    const newRefCount = items.filter(i => i.status === 'new_ref').length;

    return {
      totalBottles,
      totalAmountHt,
      totalShippingHt,
      totalAmountWithShippingHt,
      matchedCount,
      suggestedCount,
      newRefCount,
      includedCount: included.length
    };
  }, [items]);

  const confirmAllSuggestions = () => {
    setItems(prev => prev.map(item => {
      if (item.status === 'suggested' && item.suggestedMatch?.wine) {
        return {
          ...item,
          selectedWineId: item.suggestedMatch.wine.id,
          isNewReference: false,
          status: 'matched',
          targetSiteId: item.suggestedMatch.wine.siteId || item.targetSiteId
        };
      }
      return item;
    }));
  };

  const rejectAllSuggestions = () => {
    setItems(prev => prev.map(item => {
      if (item.status === 'suggested') {
        return {
          ...item,
          selectedWineId: null,
          isNewReference: true,
          status: 'new_ref'
        };
      }
      return item;
    }));
  };

  const confirmSingleSuggestion = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.suggestedMatch?.wine) {
        return {
          ...item,
          selectedWineId: item.suggestedMatch.wine.id,
          isNewReference: false,
          status: 'matched',
          targetSiteId: item.suggestedMatch.wine.siteId || item.targetSiteId
        };
      }
      return item;
    }));
  };

  const rejectSingleSuggestion = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          selectedWineId: null,
          isNewReference: true,
          status: 'new_ref'
        };
      }
      return item;
    }));
  };

  const unlinkMatchedWine = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          selectedWineId: null,
          isNewReference: true,
          status: 'new_ref',
          suggestedMatch: null
        };
      }
      return item;
    }));
  };

  const reassignWine = (wineId: string) => {
    if (reassigningItemIndex === null) return;
    const targetWine = wines.find(w => w.id === wineId);
    if (!targetWine) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== reassigningItemIndex) return item;
      return {
        ...item,
        domain: targetWine.domain,
        wineName: targetWine.name,
        vintage: targetWine.vintage || '',
        color: targetWine.color,
        format: targetWine.format || item.format,
        selectedWineId: targetWine.id,
        isNewReference: false,
        status: 'matched',
        suggestedMatch: null,
        targetSiteId: targetWine.siteId || item.targetSiteId
      };
    }));
    setReassigningItemIndex(null);
    setWineSearchQuery('');
  };

  const detachToNewRef = (index: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        selectedWineId: null,
        isNewReference: true,
        status: 'new_ref',
        suggestedMatch: null
      };
    }));
  };

  const updateItemQty = (id: string, qty: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const updateItemPrice = (id: string, price: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, priceBuyHt: Math.max(0, price) } : i));
  };

  const updateItemShipping = (id: string, shippingUnit: number) => {
    const safeUnit = Math.max(0, Number(shippingUnit) || 0);
    setItems(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, shippingCostPerUnit: safeUnit } : i);
      const newTotal = updated
        .filter(i => i.isIncluded)
        .reduce((sum, i) => sum + (i.quantity * (i.shippingCostPerUnit || 0)), 0);
      setTotalShippingCostHt(Math.round(newTotal * 100) / 100);
      return updated;
    });
  };

  const applyShippingTotalToItems = (newTotalShipping: number) => {
    const safeTotal = Math.max(0, Number(newTotalShipping) || 0);
    setTotalShippingCostHt(safeTotal);
    setItems(prev => {
      const included = prev.filter(i => i.isIncluded);
      const totalBottles = included.reduce((acc, curr) => acc + curr.quantity, 0);
      const perUnit = totalBottles > 0 ? Math.round((safeTotal / totalBottles) * 100) / 100 : 0;
      return prev.map(i => {
        if (!i.isIncluded) return i;
        return {
          ...i,
          shippingCostPerUnit: perUnit
        };
      });
    });
  };

  const updateItemSite = (id: string, siteId: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, targetSiteId: siteId } : i));
  };

  const toggleItemIncluded = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isIncluded: !i.isIncluded } : i));
  };

  const handleValidateAndReceive = async () => {
    const itemsToReceive = items.filter(i => i.isIncluded && i.quantity > 0);
    if (itemsToReceive.length === 0) {
      setErrorMessage('Aucun vin sélectionné pour l\'entrée en stock.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisProgress('Incrémentation des stocks et création des références...');

    try {
      let totalQtyAdded = 0;
      let newRefsCreated = 0;
      const runningStockMap = new Map<string, number>();
      wines.forEach(w => runningStockMap.set(w.id, w.quantity));

      for (const item of itemsToReceive) {
        let finalWineId = item.selectedWineId;

        // 1. Existing wine reference
        if (finalWineId) {
          const existing = wines.find(w => w.id === finalWineId);
          if (existing) {
            const vItem = normalizeVintage(item.vintage);
            const vExisting = normalizeVintage(existing.vintage);
            // Safety guard: if the user specified a distinct vintage that differs from existing wine,
            // don't merge into the wrong vintage! Fall through to create the new vintage reference.
            if (vItem && vExisting && vItem !== vExisting) {
              finalWineId = null;
            }
          }
        }

        if (finalWineId) {
          const existing = wines.find(w => w.id === finalWineId);
          if (existing) {
            let targetWineId = existing.id;
            const isAtTargetSite = existing.siteId === item.targetSiteId;

            if (isAtTargetSite) {
              const currentStock = runningStockMap.get(existing.id) ?? existing.quantity;
              const newQty = currentStock + item.quantity;
              runningStockMap.set(existing.id, newQty);
              const updatedHt = item.priceBuyHt !== undefined && item.priceBuyHt > 0 ? item.priceBuyHt : existing.priceBuyHt;
              const updatedPort = item.shippingCostPerUnit !== undefined ? item.shippingCostPerUnit : (existing.shippingCost || 0);
              const updatedBuy = updatedHt !== undefined ? Math.round((updatedHt + updatedPort) * 100) / 100 : existing.priceBuy;

              await updateWine(existing.id, {
                quantity: newQty,
                priceBuyHt: updatedHt,
                shippingCost: updatedPort,
                priceBuy: updatedBuy,
                updatedAt: Date.now()
              }, 'stock');
            } else {
              // Existing reference is at another site. Check if it ALSO exists at item.targetSiteId
              const matchAtTarget = wines.find(w => w.siteId === item.targetSiteId && isSameWineReference(w, existing));
              if (matchAtTarget) {
                targetWineId = matchAtTarget.id;
                const currentStock = runningStockMap.get(matchAtTarget.id) ?? matchAtTarget.quantity;
                const newQty = currentStock + item.quantity;
                runningStockMap.set(matchAtTarget.id, newQty);
                const updatedHt = item.priceBuyHt !== undefined && item.priceBuyHt > 0 ? item.priceBuyHt : matchAtTarget.priceBuyHt;
                const updatedPort = item.shippingCostPerUnit !== undefined ? item.shippingCostPerUnit : (matchAtTarget.shippingCost || 0);
                const updatedBuy = updatedHt !== undefined ? Math.round((updatedHt + updatedPort) * 100) / 100 : matchAtTarget.priceBuy;

                await updateWine(matchAtTarget.id, {
                  quantity: newQty,
                  priceBuyHt: updatedHt,
                  shippingCost: updatedPort,
                  priceBuy: updatedBuy,
                  updatedAt: Date.now()
                }, 'stock');
              } else {
                // Clone the reference to the designated site with the new quantity, keeping all metadata
                const unitHt = item.priceBuyHt !== undefined && item.priceBuyHt > 0 ? item.priceBuyHt : existing.priceBuyHt;
                const unitPort = item.shippingCostPerUnit !== undefined ? item.shippingCostPerUnit : (existing.shippingCost || 0);
                const unitBuy = unitHt !== undefined ? Math.round((unitHt + unitPort) * 100) / 100 : existing.priceBuy;
                const calculatedSell = existing.priceSell || (unitBuy && unitBuy > 0 ? calculateSellingPrice(unitBuy) : 0);

                const clonedWineId = await addWine({
                  name: existing.name,
                  domain: existing.domain,
                  vintage: existing.vintage,
                  color: existing.color,
                  region: existing.region,
                  subRegion: existing.subRegion,
                  country: existing.country,
                  quantity: item.quantity,
                  alertThreshold: existing.alertThreshold || 3,
                  siteId: item.targetSiteId,
                  priceBuyHt: unitHt,
                  shippingCost: unitPort,
                  priceBuy: unitBuy,
                  priceSell: calculatedSell,
                  format: existing.format || item.format,
                  appellation: existing.appellation,
                  cuvee: existing.cuvee,
                  technicalSheet: existing.technicalSheet,
                  notes: existing.notes
                });
                targetWineId = clonedWineId;
                newRefsCreated += 1;
              }
            }

            await addMovement({
              wineId: targetWineId,
              wineName: `${existing.domain} - ${existing.name} (${existing.vintage || 'S.A.'})`,
              type: 'in',
              quantity: item.quantity,
              toSiteId: item.targetSiteId,
              reason: 'livraison',
              notes: `Réception facture ${supplierName ? `${supplierName} ` : ''}${invoiceNumber ? `#${invoiceNumber}` : ''} du ${invoiceDate}`,
              userId: user?.uid,
              userName: user?.displayName || user?.email || 'Gestionnaire',
              createdAt: new Date(`${invoiceDate}T12:00:00`).getTime() || Date.now()
            });
          }
        } 
        // 2. New Reference to create in Cellar
        else {
          const unitHt = item.priceBuyHt;
          const unitPort = item.shippingCostPerUnit || 0;
          const unitBuy = unitHt !== undefined ? Math.round((unitHt + unitPort) * 100) / 100 : 0;
          const calculatedSell = unitBuy > 0 ? calculateSellingPrice(unitBuy) : (unitHt ? calculateSellingPrice(unitHt) : 0);

          const newWineData: Omit<Wine, 'id' | 'createdAt' | 'updatedAt'> = {
            name: item.wineName,
            domain: item.domain,
            vintage: item.vintage,
            color: item.color,
            quantity: item.quantity,
            alertThreshold: 3,
            siteId: item.targetSiteId,
            priceBuyHt: unitHt,
            shippingCost: unitPort,
            priceBuy: unitBuy,
            priceSell: calculatedSell,
            format: item.format
          };

          const newCreatedWineId = await addWine(newWineData as any);
          newRefsCreated += 1;

          await addMovement({
            wineId: newCreatedWineId,
            wineName: `${item.domain} - ${item.wineName} (${item.vintage || 'S.A.'})`,
            type: 'in',
            quantity: item.quantity,
            toSiteId: item.targetSiteId,
            reason: 'livraison',
            notes: `Création & Réception facture ${supplierName ? `${supplierName} ` : ''}${invoiceNumber ? `#${invoiceNumber}` : ''}`,
            userId: user?.uid,
            userName: user?.displayName || user?.email || 'Gestionnaire',
            createdAt: new Date(`${invoiceDate}T12:00:00`).getTime() || Date.now()
          });
        }

        totalQtyAdded += item.quantity;
      }

      setSuccessSummary({
        totalQty: totalQtyAdded,
        linesCount: itemsToReceive.length,
        newRefsCount: newRefsCreated,
        totalShippingAdded: kpis.totalShippingHt,
        totalInvoiceHt: kpis.totalAmountWithShippingHt
      });
      setStep('confirmed');

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error receiving purchases:', err);
      setErrorMessage(err.message || 'Erreur lors de l\'enregistrement des entrées en stock.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden text-stone-900 font-sans">
      
      {/* 1. Header Banner */}
      <div className="bg-stone-950 text-white p-6 border-b border-stone-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-white tracking-tight">
              Import des Factures Fournisseurs (Réception & Entrées de Stock)
            </h2>
            <p className="text-xs text-stone-400 font-mono">
              Incrémentation des quantités & mise à jour des prix de revient HT
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Step: UPLOAD */}
      {step === 'upload' && (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
          
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 block">
              1. Format de votre facture d'achat
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => { setImportMode('pdf'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  importMode === 'pdf' ? 'border-[#BD6346] bg-[#BD6346]/5 text-stone-950 shadow-sm' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <FileText className={`w-6 h-6 mb-2 ${importMode === 'pdf' ? 'text-[#BD6346]' : 'text-stone-400'}`} />
                <p className="font-bold text-sm">Facture PDF</p>
                <p className="text-[11px] text-stone-500">Scan ou facture numérique du domaine</p>
              </button>

              <button
                type="button"
                onClick={() => { setImportMode('excel'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  importMode === 'excel' ? 'border-emerald-600 bg-emerald-50/50 text-stone-950 shadow-sm' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <FileSpreadsheet className={`w-6 h-6 mb-2 ${importMode === 'excel' ? 'text-emerald-600' : 'text-stone-400'}`} />
                <p className="font-bold text-sm">Bon de livraison Excel</p>
                <p className="text-[11px] text-stone-500">Fichier .xlsx, .xls ou .csv</p>
              </button>

              <button
                type="button"
                onClick={() => { setImportMode('text'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  importMode === 'text' ? 'border-indigo-600 bg-indigo-50/50 text-stone-950 shadow-sm' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <Building2 className={`w-6 h-6 mb-2 ${importMode === 'text' ? 'text-indigo-600' : 'text-stone-400'}`} />
                <p className="font-bold text-sm">Copier-Coller</p>
                <p className="text-[11px] text-stone-500">Lignes d'un email ou récapitulatif</p>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 block">
              2. Fichier de facture
            </label>

            {importMode === 'text' ? (
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Exemple :
Domaine Leflaive - Puligny-Montrachet 2022 - 12 bt - 85.00€ HT
Domaine Roulot - Meursault Luchets 2021 - 6 bt - 110.00€ HT"
                className="w-full p-4 rounded-xl border border-stone-300 font-mono text-xs bg-stone-50 focus:bg-white"
              />
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-stone-400 rounded-2xl p-8 text-center cursor-pointer bg-stone-50/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importMode === 'pdf' ? '.pdf' : '.xlsx,.xls,.csv'}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-stone-400" />
                  <p className="font-bold text-sm text-stone-800">
                    {selectedFile ? selectedFile.name : 'Sélectionnez votre fichier de facture'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-200">
            <div>
              <label className="text-xs font-mono font-bold uppercase text-stone-500 block mb-1">
                Date de Réception
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-bold uppercase text-stone-500 block mb-1">
                Site de Rangement par défaut
              </label>
              <select
                value={defaultDestinationSiteId}
                onChange={(e) => setDefaultDestinationSiteId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 text-xs"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleStartManualEntry}
                className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0 transition-colors"
              >
                Passer en saisie manuelle →
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={handleStartManualEntry}
              className="w-full sm:w-auto h-11 px-4 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-stone-500" />
              <span>Saisie manuelle directe</span>
            </button>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (importMode !== 'text' && !selectedFile) || (importMode === 'text' && !rawText.trim())}
              className="w-full sm:w-auto h-12 px-6 bg-stone-950 hover:bg-stone-800 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>{analysisProgress}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Analyser la Facture d'Achat</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* 3. Step: REVIEW & VALIDATION */}
      {step === 'review' && (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in">
          
          {/* Executive Invoice Header with editable fields and Transport Section */}
          <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-stone-500 block mb-1">
                  Fournisseur / Domaine
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ex: Domaine / Vigneron"
                  className="w-full h-9 px-3 rounded-xl border border-stone-300 text-xs bg-white font-medium focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-stone-500 block mb-1">
                  N° Facture
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: FA-2024-001"
                  className="w-full h-9 px-3 rounded-xl border border-stone-300 text-xs bg-white font-mono focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-stone-500 block mb-1">
                  Date de Facture
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-stone-300 text-xs bg-white font-mono focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-stone-500 block mb-1">
                  Site de Rangement par défaut
                </label>
                <select
                  value={defaultDestinationSiteId}
                  onChange={(e) => {
                    const newSite = e.target.value;
                    setDefaultDestinationSiteId(newSite);
                    setItems(prev => prev.map(it => it.isNewReference ? { ...it, targetSiteId: newSite } : it));
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-stone-300 text-xs bg-white focus:ring-1 focus:ring-stone-400 focus:outline-none"
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* FRAIS DE PORT / TRANSPORT GLOBAL */}
            <div className="pt-3 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 uppercase font-mono tracking-wider">
                      Frais de Transport / Port (€ HT)
                    </span>
                    {totalShippingCostHt > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold font-mono">
                        {totalShippingCostHt.toFixed(2)} € détecté / saisi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-stone-200 text-stone-600 rounded-full text-[10px] font-bold font-mono">
                        0.00 € (franco de port)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Les frais de port s'ajoutent au prix d'achat net pour calculer le <strong>coût de revient unitaire</strong> exact de chaque bouteille.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-stone-300 shadow-xs">
                  <span className="text-xs font-bold text-stone-500">Total :</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalShippingCostHt || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      applyShippingTotalToItems(val);
                    }}
                    placeholder="0.00"
                    className="w-20 font-mono font-extrabold text-sm text-stone-950 focus:outline-none text-right"
                  />
                  <span className="text-xs font-bold text-stone-600">€ HT</span>
                </div>

                <button
                  type="button"
                  onClick={() => applyShippingTotalToItems(totalShippingCostHt)}
                  className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Ventiler sur toutes les bouteilles cochées"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Ventiler ({kpis.totalBottles > 0 ? (totalShippingCostHt / kpis.totalBottles).toFixed(2) : '0.00'} € / bt)
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-stone-400">Total Bouteilles</p>
              <p className="text-2xl font-mono font-extrabold text-stone-900 mt-1">{kpis.totalBottles} bt</p>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-stone-400">Montant Vins HT</p>
              <p className="text-2xl font-mono font-extrabold text-stone-900 mt-1">{kpis.totalAmountHt.toFixed(2)} €</p>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-amber-800 flex items-center gap-1">
                <Truck className="w-3 h-3 text-amber-600" />
                Frais de Port HT
              </p>
              <p className="text-2xl font-mono font-extrabold text-amber-950 mt-1">{kpis.totalShippingHt.toFixed(2)} €</p>
            </div>
            <div className="p-4 bg-stone-900 text-white border border-stone-800 rounded-xl shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase text-stone-400">Total Facture HT</p>
              <p className="text-2xl font-mono font-extrabold text-white mt-1">{kpis.totalAmountWithShippingHt.toFixed(2)} €</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-emerald-700">Vins existants</p>
              <p className="text-2xl font-mono font-extrabold text-emerald-900 mt-1">{kpis.matchedCount}</p>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-indigo-700">Nouvelles références</p>
              <p className="text-2xl font-mono font-extrabold text-indigo-900 mt-1">{kpis.newRefCount}</p>
            </div>
          </div>

          {/* Banner for Suggested Typo Matches */}
          {kpis.suggestedCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-xs text-amber-950">
                    {kpis.suggestedCount} rapprochement{kpis.suggestedCount > 1 ? 's' : ''} suggéré{kpis.suggestedCount > 1 ? 's' : ''} (coquilles probables détectées)
                  </p>
                  <p className="text-[11px] text-amber-800/90">
                    Des fiches très similaires existent déjà en cave malgré une légère divergence d'orthographe (ex: Thibault / Thibaud).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={confirmAllSuggestions}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Tout accepter ({kpis.suggestedCount})
                </button>
                <button
                  type="button"
                  onClick={rejectAllSuggestions}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Créer en nouvelles réf
                </button>
              </div>
            </div>
          )}

          {/* Table Header Bar with Add Line Action */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
              Lignes de la facture ({items.length})
            </span>
            <button
              type="button"
              onClick={addNewItem}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ajouter une ligne de vin</span>
            </button>
          </div>

          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[55vh] scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 font-mono font-bold uppercase text-stone-600 border-b border-stone-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-10 text-center">Ajouter</th>
                    <th className="p-3">Domaine & Vin Facturé</th>
                    <th className="p-3 w-20 text-center">Qté reçue</th>
                    <th className="p-3 w-28">Prix Achat HT</th>
                    <th className="p-3 w-28">Port / bt HT</th>
                    <th className="p-3 w-32">Coût Revient HT</th>
                    <th className="p-3 w-36">Rangement</th>
                    <th className="p-3 w-28 text-right">Statut</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {items.map((item, idx) => {
                    const matchedWine = item.selectedWineId ? wines.find(w => w.id === item.selectedWineId) : null;
                    const itemCostPriceHt = (item.priceBuyHt || 0) + (item.shippingCostPerUnit || 0);
                    const isVintageMismatch = Boolean(
                      matchedWine && 
                      item.vintage && 
                      matchedWine.vintage && 
                      normalizeVintage(item.vintage) !== normalizeVintage(matchedWine.vintage)
                    );

                    return (
                      <tr key={item.id} className={!item.isIncluded ? 'opacity-50' : 'hover:bg-stone-50/80 transition-colors'}>
                        <td className="p-3 text-center align-top pt-4">
                          <input
                            type="checkbox"
                            checked={item.isIncluded}
                            onChange={() => toggleItemIncluded(item.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-emerald-600"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <div className="space-y-2">
                            {/* Always-editable Domain & Wine Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[9px] font-mono font-bold uppercase text-stone-600 block mb-0.5">
                                  Domaine / Vigneron
                                </label>
                                <input
                                  type="text"
                                  placeholder="Domaine / Vigneron"
                                  value={item.domain}
                                  onChange={(e) => updateItemField(item.id, 'domain', e.target.value)}
                                  className="w-full h-7 px-2 border border-stone-300 rounded text-xs font-semibold bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono font-bold uppercase text-stone-600 block mb-0.5">
                                  Cuvée / Nom du vin
                                </label>
                                <input
                                  type="text"
                                  placeholder="Nom / Appellation / Cuvée"
                                  value={item.wineName}
                                  onChange={(e) => updateItemField(item.id, 'wineName', e.target.value)}
                                  className="w-full h-7 px-2 border border-stone-300 rounded text-xs bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                                />
                              </div>
                            </div>

                            {/* Always-editable Vintage, Color, Format */}
                            <div className="flex flex-wrap items-center gap-2">
                              <div>
                                <label className="text-[9px] font-mono font-bold uppercase text-stone-600 block mb-0.5">
                                  Millésime
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: 2022 ou S.A."
                                  value={item.vintage}
                                  onChange={(e) => updateItemField(item.id, 'vintage', e.target.value)}
                                  className={`w-28 h-6 px-1.5 border rounded text-[11px] font-mono bg-white focus:outline-none ${
                                    isVintageMismatch 
                                      ? 'border-amber-400 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-300' 
                                      : 'border-stone-300 text-stone-900'
                                  }`}
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-mono font-bold uppercase text-stone-600 block mb-0.5">
                                  Couleur
                                </label>
                                <select
                                  value={item.color}
                                  onChange={(e) => updateItemField(item.id, 'color', e.target.value as WineColor)}
                                  className="h-6 px-1.5 border border-stone-300 rounded text-[11px] bg-white font-medium focus:outline-none"
                                >
                                  <option value="rouge">Rouge</option>
                                  <option value="blanc">Blanc</option>
                                  <option value="rose">Rosé</option>
                                  <option value="bulle">Effervescent</option>
                                  <option value="orange">Orange</option>
                                  <option value="spiritueux">Spiritueux</option>
                                  <option value="autre">Autre</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[9px] font-mono font-bold uppercase text-stone-600 block mb-0.5">
                                  Format
                                </label>
                                <select
                                  value={item.format || 'Bouteille (75cl)'}
                                  onChange={(e) => updateItemField(item.id, 'format', e.target.value)}
                                  className="h-6 px-1.5 border border-stone-300 rounded text-[11px] bg-white font-medium focus:outline-none"
                                >
                                  <option value="Bouteille (75cl)">Bouteille (75cl)</option>
                                  <option value="Magnum (1.5L)">Magnum (1.5L)</option>
                                  <option value="Demi-bouteille (37.5cl)">Demi (37.5cl)</option>
                                  <option value="Jéroboam (3L)">Jéroboam (3L)</option>
                                  <option value="Autre">Autre</option>
                                </select>
                              </div>
                            </div>

                            {/* Case 1: Already matched */}
                            {item.status === 'matched' && matchedWine && (
                              <div className="space-y-1.5 pt-0.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-900 bg-emerald-50/90 border border-emerald-200/90 px-2.5 py-1.5 rounded-lg">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">
                                      Rattaché à : <strong>{matchedWine.domain} {matchedWine.name} ({matchedWine.vintage || 'S.A.'})</strong>
                                      <span className="text-emerald-700/80 ml-1">({matchedWine.quantity} bt en stock)</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => unlinkMatchedWine(item.id)}
                                      title="Détacher pour créer comme nouvelle référence indépendante"
                                      className="text-stone-500 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-0.5 text-[10px] font-medium"
                                    >
                                      <Unlink className="w-3 h-3" />
                                      Détacher (créer nouveau vin)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setReassigningItemIndex(idx); setWineSearchQuery(item.wineName || item.domain); }}
                                      className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer text-[10px] font-medium"
                                    >
                                      <Search className="w-3 h-3" />
                                      Changer...
                                    </button>
                                  </div>
                                </div>

                                {/* Vintage mismatch warning if user entered a different vintage than the matched wine */}
                                {isVintageMismatch && (
                                  <div className="flex items-center justify-between gap-2 text-[10px] bg-amber-50 text-amber-950 border border-amber-300 px-2 py-1 rounded-md animate-fade-in">
                                    <span>
                                      ⚠️ Millésime facture <strong>« {item.vintage} »</strong> ≠ Fiche en stock <strong>« {matchedWine.vintage || 'S.A.'} »</strong>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => unlinkMatchedWine(item.id)}
                                      className="px-2 py-0.5 bg-amber-800 hover:bg-amber-900 text-white rounded text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                                    >
                                      Créer la fiche {item.vintage} (Détacher)
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Case 2: Suggested Match with Typo */}
                            {item.status === 'suggested' && item.suggestedMatch && (
                              <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-1.5 animate-fade-in shadow-xs text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    Rapprochement suggéré ({item.suggestedMatch.score}%)
                                  </span>
                                  <span className="text-[10px] text-amber-800 font-mono">
                                    {item.suggestedMatch.reason}
                                  </span>
                                </div>

                                <p className="text-[11px] text-stone-800 font-serif">
                                  Fiche en cave : <strong>{item.suggestedMatch.wine.domain} - {item.suggestedMatch.wine.name} {item.suggestedMatch.wine.vintage ? `(${item.suggestedMatch.wine.vintage})` : ''}</strong>
                                  <span className="text-[10px] text-stone-500 font-sans ml-1.5">
                                    ({item.suggestedMatch.wine.quantity} bt en stock)
                                  </span>
                                </p>

                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => confirmSingleSuggestion(item.id)}
                                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    Confirmer le rapprochement
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => rejectSingleSuggestion(item.id)}
                                    className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Créer en nouveau vin
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setReassigningItemIndex(idx); setWineSearchQuery(item.wineName || item.domain); }}
                                    className="px-2 py-1 text-stone-600 hover:text-stone-900 text-[10px] flex items-center gap-1 cursor-pointer underline ml-auto"
                                  >
                                    <Search className="w-3 h-3" />
                                    Autre vin...
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Case 3: New reference */}
                            {item.status === 'new_ref' && (
                              <div className="flex items-center justify-between text-[11px] pt-0.5 text-stone-600">
                                <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded text-[10px] font-bold">
                                  <Plus className="w-3 h-3" /> Nouvelle référence en cave
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setReassigningItemIndex(idx); setWineSearchQuery(item.wineName || item.domain); }}
                                  className="text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                                >
                                  <Search className="w-3 h-3" />
                                  Rattacher à une fiche existante...
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center align-top pt-3">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center font-mono font-bold border border-stone-300 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-3 align-top pt-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.5}
                              min={0}
                              value={item.priceBuyHt}
                              onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 px-2 font-mono border border-stone-300 rounded-lg text-xs"
                            />
                            <span className="text-[11px] text-stone-400">€</span>
                          </div>
                        </td>
                        <td className="p-3 align-top pt-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              value={item.shippingCostPerUnit !== undefined ? item.shippingCostPerUnit : 0}
                              onChange={(e) => updateItemShipping(item.id, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 px-2 font-mono border border-amber-300 bg-amber-50/30 rounded-lg text-xs font-semibold text-amber-950 focus:bg-white"
                              title="Port unitaire HT par bouteille pour cette ligne"
                            />
                            <span className="text-[11px] text-stone-400">€</span>
                          </div>
                        </td>
                        <td className="p-3 align-top pt-3 font-mono">
                          <div>
                            <span className="font-extrabold text-stone-950 text-xs block">
                              {itemCostPriceHt.toFixed(2)} € HT
                            </span>
                            <span className="text-[10px] text-stone-400 block">
                              {item.shippingCostPerUnit && item.shippingCostPerUnit > 0 
                                ? `${item.priceBuyHt.toFixed(2)} + ${item.shippingCostPerUnit.toFixed(2)}` 
                                : 'sans port'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 align-top pt-3">
                          <select
                            value={item.targetSiteId}
                            onChange={(e) => updateItemSite(item.id, e.target.value)}
                            className="w-full h-8 px-2 text-xs border border-stone-300 rounded-lg bg-stone-50"
                          >
                            {sites.map(s => (
                              <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right font-mono font-bold align-top pt-3">
                          {item.status === 'matched' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100/70 border border-emerald-300/60 px-2 py-0.5 rounded-lg text-[10px]">
                              <Check className="w-3 h-3" /> Existant
                            </span>
                          ) : item.status === 'suggested' ? (
                            <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg text-[10px] animate-pulse">
                              <Sparkles className="w-3 h-3 text-amber-600" /> Coquille ?
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-indigo-800 bg-indigo-100/70 border border-indigo-300/60 px-2 py-0.5 rounded-lg text-[10px]">
                              <Plus className="w-3 h-3" /> + Nouvelle réf
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center align-top pt-3">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            title="Supprimer cette ligne"
                            className="p-1 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
            <button
              onClick={() => setStep('upload')}
              className="h-10 px-4 border border-stone-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              Retour
            </button>

            <button
              onClick={handleValidateAndReceive}
              disabled={isAnalyzing || kpis.totalBottles === 0}
              className="h-11 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 text-white rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Valider l'Entrée de Stock ({kpis.totalBottles} bt &bull; {kpis.totalAmountWithShippingHt.toFixed(2)} € HT)
                  </span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* 4. Step: CONFIRMED */}
      {step === 'confirmed' && successSummary && (
        <div className="p-8 md:p-12 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-3 max-w-lg mx-auto">
            <h3 className="text-xl font-serif font-bold text-stone-900">
              Entrée en Stock Confirmée !
            </h3>
            <p className="text-xs text-stone-600 font-sans">
              <strong>{successSummary.totalQty} bouteilles</strong> ont été ajoutées à vos stocks ({successSummary.newRefsCount} nouvelles références créées).
            </p>

            {successSummary.totalShippingAdded !== undefined && successSummary.totalShippingAdded > 0 && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 font-sans flex items-center justify-center gap-2">
                <Truck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Frais de port intégrés aux coûts de revient : <strong>{successSummary.totalShippingAdded.toFixed(2)} € HT</strong> (Total facture : <strong>{successSummary.totalInvoiceHt?.toFixed(2)} € HT</strong>)
                </span>
              </div>
            )}
          </div>
          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => { setStep('upload'); setSelectedFile(null); setItems([]); }}
              className="h-10 px-5 bg-stone-900 text-white rounded-xl text-xs font-bold font-mono uppercase cursor-pointer"
            >
              Importer une autre facture
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="h-10 px-5 bg-stone-100 text-stone-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal: Manual Reassignment */}
      {reassigningItemIndex !== null && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col font-sans">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">
                  Rapprocher manuellement avec la cave
                </h3>
                <p className="text-xs text-stone-500 font-sans">
                  Ligne de facture : <strong>{items[reassigningItemIndex]?.domain} - {items[reassigningItemIndex]?.wineName} ({items[reassigningItemIndex]?.vintage || 'S.A.'})</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassigningItemIndex(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                autoFocus
                value={wineSearchQuery}
                onChange={(e) => setWineSearchQuery(e.target.value)}
                placeholder="Rechercher par domaine, cuvée, appellation ou millésime..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-300 text-xs text-stone-800 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-stone-100 border border-stone-200 rounded-xl max-h-72">
              {wines
                .filter(w => matchesWineSearch(w, wineSearchQuery))
                .sort((a, b) => {
                  if (!wineSearchQuery.trim()) return (b.quantity || 0) - (a.quantity || 0);
                  const scoreB = getWineSearchRelevanceScore(b, wineSearchQuery);
                  const scoreA = getWineSearchRelevanceScore(a, wineSearchQuery);
                  if (scoreB !== scoreA) return scoreB - scoreA;
                  return (b.quantity || 0) - (a.quantity || 0);
                })
                .slice(0, 50)
                .map(w => {
                  const siteName = sites.find(s => s.id === w.siteId)?.name || 'Cave';
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => reassignWine(w.id)}
                      className="w-full p-3 text-left hover:bg-stone-50 flex items-center justify-between transition-colors cursor-pointer group"
                    >
                      <div className="space-y-0.5">
                        <p className="font-serif font-bold text-stone-900 text-xs group-hover:text-emerald-700">
                          {w.name} {w.vintage ? `(${w.vintage})` : ''}
                        </p>
                        <p className="text-[11px] text-stone-500 font-sans">
                          {w.domain} &bull; <span className="font-mono">{siteName}</span>
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs shrink-0">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          w.quantity > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {w.quantity} bt
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  if (reassigningItemIndex !== null) detachToNewRef(reassigningItemIndex);
                  setReassigningItemIndex(null);
                }}
                className="text-xs text-stone-600 hover:text-stone-900 font-medium cursor-pointer"
              >
                Conserver comme nouvelle référence
              </button>
              <button
                type="button"
                onClick={() => setReassigningItemIndex(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
