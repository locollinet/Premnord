import React, { useState, useRef } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, getCanonicalDomain, isSameWineReference, getWineReferenceKey } from '../types';
import { calculateSellingPrice } from '../lib/pricing';
import { 
  FileText, 
  Upload, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Trash2, 
  Database, 
  CornerDownRight, 
  Info,
  Clipboard,
  HelpCircle,
  Layers
} from 'lucide-react';

interface CsvImporterProps {
  onImportComplete?: () => void;
}

interface ParsedRow {
  name: string;
  domain: string;
  vintage: string;
  color: WineColor;
  region: string;
  quantity: number;
  alertThreshold: number;
  priceBuy?: number;
  priceBuyHt?: number;
  shippingCost?: number;
  priceSell?: number;
  bin?: string;
  notes?: string;
  isValid: boolean;
  error?: string;
  siteId?: string;
  siteName?: string;
  appellation?: string;
  cuvee?: string;
  importStatus?: 'new' | 'iso' | 'different';
}

const consolidateRows = (rows: ParsedRow[], isReferencesOnly: boolean = false): ParsedRow[] => {
  const result: ParsedRow[] = [];
  const map = new Map<string, ParsedRow>();

  const normalizeText = (str: string | undefined): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  };

  rows.forEach(row => {
    if (!row.isValid) {
      result.push(row);
      return;
    }

    const refKey = getWineReferenceKey(row);
    const key = isReferencesOnly
      ? refKey
      : `${refKey}__${row.siteId || ''}`;
    
    if (map.has(key)) {
      const existing = map.get(key)!;
      if (isReferencesOnly) {
        existing.quantity = 0;
        existing.bin = undefined;
      } else {
        existing.quantity += row.quantity;
        if (row.bin && row.bin !== existing.bin) {
          if (existing.bin) {
            const bins = existing.bin.split(',').map(b => b.trim());
            if (!bins.includes(row.bin.trim())) {
              existing.bin = `${existing.bin}, ${row.bin.trim()}`;
            }
          } else {
            existing.bin = row.bin;
          }
        }
      }
      
      if (row.priceBuy !== undefined) existing.priceBuy = row.priceBuy;
      if (row.priceBuyHt !== undefined) existing.priceBuyHt = row.priceBuyHt;
      if (row.shippingCost !== undefined) existing.shippingCost = row.shippingCost;
      if (row.priceSell !== undefined) existing.priceSell = row.priceSell;
      if (!existing.appellation) existing.appellation = row.appellation;
      if (!existing.cuvee) existing.cuvee = row.cuvee;
    } else {
      const cloned = { ...row };
      if (isReferencesOnly) {
        cloned.quantity = 0;
        cloned.bin = undefined;
      }
      map.set(key, cloned);
      result.push(cloned);
    }
  });

  return result;
};

export const CsvImporter: React.FC<CsvImporterProps> = ({ onImportComplete }) => {
  const { sites, wines, addWine, updateWine, addMovement } = useFirebase();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [importType, setImportType] = useState<'references_only' | 'stock_full'>('references_only');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'different' | 'iso'>('all');
  const [inputText, setInputText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [queueRows, setQueueRows] = useState<ParsedRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [importResults, setImportResults] = useState<{
    newCreated: number;
    updatedReplaced: number;
    skippedIso: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findMatchingWine = React.useCallback((row: ParsedRow, currentWines: Wine[], targetSiteId: string, isRefOnlyMode: boolean): Wine | undefined => {
    return currentWines.find(w => {
      if (!isRefOnlyMode && w.siteId !== targetSiteId) return false;
      return isSameWineReference(w, row);
    });
  }, []);

  const checkIsIso = React.useCallback((existing: Wine, row: ParsedRow, isRefOnlyMode: boolean): boolean => {
    const normalizeText = (str: string | undefined): string => {
      if (!str) return '';
      return str.trim().toLowerCase();
    };
    if (isRefOnlyMode) {
      return (
        existing.priceBuy === row.priceBuy &&
        existing.priceBuyHt === row.priceBuyHt &&
        existing.shippingCost === row.shippingCost &&
        existing.priceSell === row.priceSell &&
        existing.color === row.color &&
        normalizeText(existing.region) === normalizeText(row.region)
      );
    }
    return (
      existing.quantity === row.quantity &&
      (existing.bin || '') === (row.bin || '') &&
      existing.priceBuy === row.priceBuy &&
      existing.priceBuyHt === row.priceBuyHt &&
      existing.shippingCost === row.shippingCost &&
      existing.priceSell === row.priceSell &&
      existing.color === row.color &&
      normalizeText(existing.region) === normalizeText(row.region)
    );
  }, []);

  const isRefOnly = importType === 'references_only';

  const enrichedRows = React.useMemo(() => {
    return parsedRows.map(row => {
      if (!row.isValid) return row;
      const targetSiteId = row.siteId || selectedSiteId;
      const matched = findMatchingWine(row, wines, targetSiteId, isRefOnly);
      if (!matched) {
        return { ...row, importStatus: 'new' as 'new' | 'iso' | 'different' };
      } else {
        const isIso = checkIsIso(matched, row, isRefOnly);
        return { ...row, importStatus: (isIso ? 'iso' : 'different') as 'new' | 'iso' | 'different' };
      }
    });
  }, [parsedRows, wines, selectedSiteId, findMatchingWine, checkIsIso, isRefOnly]);

  const enrichedQueueRows = React.useMemo(() => {
    return queueRows.map(row => {
      if (!row.isValid) return row;
      const targetSiteId = row.siteId || selectedSiteId;
      const matched = findMatchingWine(row, wines, targetSiteId, isRefOnly);
      if (!matched) {
        return { ...row, importStatus: 'new' as 'new' | 'iso' | 'different' };
      } else {
        const isIso = checkIsIso(matched, row, isRefOnly);
        return { ...row, importStatus: (isIso ? 'iso' : 'different') as 'new' | 'iso' | 'different' };
      }
    });
  }, [queueRows, wines, selectedSiteId, findMatchingWine, checkIsIso, isRefOnly]);

  const tabStats = React.useMemo(() => {
    const valid = enrichedRows.filter(r => r.isValid);
    const total = valid.length;
    if (total === 0) return null;

    const existingInDb = valid.filter(r => r.importStatus === 'iso' || r.importStatus === 'different');
    const newCount = valid.filter(r => r.importStatus === 'new').length;
    const priceUpdateCount = valid.filter(r => r.importStatus === 'different').length;
    const isoCount = valid.filter(r => r.importStatus === 'iso').length;
    const matchPercentage = Math.round((existingInDb.length / total) * 100);

    return {
      total,
      existingCount: existingInDb.length,
      newCount,
      priceUpdateCount,
      isoCount,
      matchPercentage,
      isFullyImported: newCount === 0 && priceUpdateCount === 0,
      hasOnlyPriceUpdates: newCount === 0 && priceUpdateCount > 0,
    };
  }, [enrichedRows]);

  const handleAddToQueue = () => {
    const valid = parsedRows.filter(r => r.isValid);
    if (valid.length === 0) {
      setErrorMsg("Aucune ligne valide à ajouter à la file d'attente.");
      return;
    }
    setQueueRows(prev => consolidateRows([...prev, ...valid]));
    setInputText('');
    setParsedRows([]);
    setErrorMsg(null);
  };

  // Initialize site selected if not set
  React.useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      // Default to the Reserve site if possible, else the first site
      const reserve = sites.find(s => s.name.toLowerCase().includes('réserve') || s.name.toLowerCase().includes('stock'));
      setSelectedSiteId(reserve ? reserve.id : sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Clean values from quotes and trim
  const cleanCell = (val: string): string => {
    if (!val) return '';
    return val.replace(/^["']|["']$/g, '').trim();
  };

  // Map arbitrary strings to valid WineColor
  const detectColor = (colorStr: string, wineName: string): WineColor => {
    const text = (colorStr || wineName || '').toLowerCase();
    
    if (text.startsWith('bla') || text.includes('blanc') || text.includes('white') || text.includes('blc')) return 'blanc';
    if (text.startsWith('rou') || text.includes('rouge') || text.includes('red') || text.includes('rog')) return 'rouge';
    if (text.startsWith('eff') || text.includes('champagne') || text.includes('bulle') || text.includes('crémant') || text.includes('mousseux') || text.includes('sparkling') || text.includes('chp')) return 'bulle';
    if (text.startsWith('ros') || text.includes('rosé') || text.includes('rose')) return 'rose';
    if (text.includes('orange')) return 'orange';
    
    // Softs detection
    if (
      text.includes('soft') ||
      text.includes('sans alcool') ||
      text.includes('soda') ||
      text.includes('jus') ||
      text.includes('cola') ||
      text.includes('coca') ||
      text.includes('tonic') ||
      text.includes('limonade') ||
      text.includes('eau') ||
      text.includes('water') ||
      text.includes('fanta') ||
      text.includes('sprite') ||
      text.includes('perrier') ||
      text.includes('evian') ||
      text.includes('schweppes') ||
      text.includes('schwepp') ||
      text.includes('sirop') ||
      text.includes('nectar') ||
      text.includes('red bull') ||
      text.includes('ice tea') ||
      text.includes('orangina') ||
      text.includes('virgin')
    ) return 'soft';

    // Spirits/Alcools forts detection
    if (
      text.includes('spiritueux') ||
      text.includes('digestif') ||
      text.includes('cognac') ||
      text.includes('rum') ||
      text.includes('whisky') ||
      text.includes('rhum') ||
      text.includes('gin') ||
      text.includes('vodka') ||
      text.includes('tequila') ||
      text.includes('armagnac') ||
      text.includes('calvados') ||
      text.includes('liqueur') ||
      text.includes('pastis') ||
      text.includes('anis') ||
      text.includes('ricard') ||
      text.includes('mezcal') ||
      text.includes('bourbon') ||
      text.includes('fort') ||
      text.includes('eau de vie') ||
      text.includes('eau-de-vie') ||
      text.includes('chartreuse') ||
      text.includes('aperol') ||
      text.includes('campari') ||
      text.includes('vermouth') ||
      text.includes('amaretto') ||
      text.includes('triple sec') ||
      text.includes('cointreau') ||
      text.includes('grand marnier') ||
      text.includes('limoncello')
    ) return 'spiritueux';

    if (text.includes('bière') || text.includes('cidre') || text.includes('beer') || text.includes('cider')) return 'cidre_biere';
    
    return 'autre';
  };

  const expandRegion = (regStr: string, domainStr?: string, appellationStr?: string): string => {
    let text = (regStr || '').trim().toLowerCase();
    const dom = (domainStr || '').trim().toLowerCase();
    const appell = (appellationStr || '').trim().toLowerCase();
    
    // 1. CHILE DETECTOR
    const isChilean = 
      text.includes('chili') || text.includes('chile') || text.startsWith('valle') || text.startsWith('val de') || text.startsWith('vdl') ||
      dom.includes('henriquez') || dom.includes('henríquez') || dom.includes('viu manent') || 
      dom.includes('concha') || dom.includes('montes') || dom.includes('almaviva') ||
      appell.includes('biobio') || appell.includes('bio bio') || appell.includes('bío-bío') || 
      appell.includes('itata') || appell.includes('colchagua') || appell.includes('maule') || 
      appell.includes('casablanca') || appell.includes('leyda') || appell.includes('valle central') ||
      appell.includes('pais') || appell.includes('país') || appell.includes('chili') || appell.includes('chile');

    if (isChilean) {
      return 'Chili';
    }

    // 2. ITALY DETECTOR
    const isItalian = 
      text.includes('ital') || text.includes('itb') ||
      dom.includes('cos') || dom.includes('principiano') || dom.includes('princic') || 
      dom.includes('foradori') || dom.includes('pepe') || dom.includes('mascarello') || dom.includes('migliavacca') ||
      appell.includes('barolo') || appell.includes('toscane') || appell.includes('abruzzo') || 
      appell.includes('sicilia') || appell.includes('veneto') || appell.includes('chianti') || 
      appell.includes('barbaresco') || appell.includes('langhe') || appell.includes('piemont') || appell.includes('vittoria');

    if (isItalian) {
      return 'Italie';
    }

    // 3. SPAIN DETECTOR
    const isSpanish = 
      text.includes('esp') || text.includes('spa') ||
      dom.includes('tondonia') || dom.includes('marqués') || dom.includes('marques') || dom.includes('alella') ||
      appell.includes('rioja') || appell.includes('ribera') || appell.includes('priorat') || 
      appell.includes('cava') || appell.includes('canarias') || appell.includes('tenerife') || appell.includes('galicia');

    if (isSpanish) {
      return 'Espagne';
    }

    // 4. GERMANY DETECTOR
    const isGerman = 
      text.includes('all') || text.includes('ger') ||
      dom.includes('breuer') || dom.includes('kilburg') || dom.includes('urbans-hof') || dom.includes('markovic') ||
      appell.includes('mosel') || appell.includes('rheingau') || appell.includes('ruwer') || 
      appell.includes('pfalz') || appell.includes('trocken') || appell.includes('kabinett');

    if (isGerman) {
      return 'Allemagne';
    }

    // 5. SWITZERLAND DETECTOR
    const isSwiss = 
      text.includes('swi') || text.includes('sui') ||
      dom.includes('beudon') || dom.includes('chappaz') ||
      appell.includes('valais') || appell.includes('plamont') || appell.includes('arvine') || appell.includes('gamay');

    if (isSwiss) {
      return 'Suisse';
    }

    // 6. SOUTH AFRICA DETECTOR
    const isSouthAfrican = 
      text.includes('sud') || text.includes('saf') ||
      dom.includes('sadie') || dom.includes('testalonga') ||
      appell.includes('kirsten') || appell.includes('columella') || appell.includes('cortez');

    if (isSouthAfrican) {
      return 'Afrique du Sud';
    }

    // 7. USA DETECTOR
    const isUSA = 
      text.includes('usa') || text.includes('cali') || text.includes('amer') ||
      dom.includes('chëpika') || dom.includes('chepika') || dom.includes('racines') ||
      appell.includes('finger lakes') || appell.includes('rita hills') || appell.includes('napa') || appell.includes('sonoma');

    if (isUSA) {
      return 'USA / Californie';
    }

    // 8. ARGENTINA DETECTOR
    const isArgentinian = 
      text.includes('arg') ||
      dom.includes('riccitelli') ||
      appell.includes('semillon') || appell.includes('malbec') || appell.includes('mendoza') || appell.includes('patagonia');

    if (isArgentinian) {
      return 'Argentine';
    }

    // 9. GREECE DETECTOR
    const isGreek = 
      text.includes('gre') || text.includes('grè') ||
      dom.includes('petrakopoulos') ||
      appell.includes('robola') || appell.includes('kefalonia') || appell.includes('malvazija');

    if (isGreek) {
      return 'Grèce';
    }

    // 10. PORTUGAL DETECTOR
    const isPortuguese = 
      text.includes('por') ||
      dom.includes('seabra') || dom.includes('niepoort') ||
      appell.includes('douro') || appell.includes('redoma') || appell.includes('xisto') || appell.includes('charme');

    if (isPortuguese) {
      return 'Portugal';
    }

    // 11. NEW ZEALAND DETECTOR
    const isNewZealand = 
      text.includes('zel') || text.includes('nz') ||
      dom.includes('rangi') || dom.includes('felton') ||
      appell.includes('bannockburn') || appell.includes('craighall');

    if (isNewZealand) {
      return 'Nouvelle-Zélande';
    }

    // 12. AUSTRALIA DETECTOR
    const isAustralian = 
      text.includes('aus') ||
      dom.includes('margaux') || dom.includes('shobbrook') ||
      appell.includes('syrah') || appell.includes('wildman') || appell.includes('poolside');

    if (isAustralian) {
      return 'Australie';
    }

    if (!text) return '';

    if (text.startsWith('alsa')) return 'Alsace';
    if (text.startsWith('mos')) return 'Moselle';
    if (text.startsWith('bour') || text.startsWith('burg')) return 'Bourgogne';
    if (text.startsWith('bord')) return 'Bordeaux';
    if (text.startsWith('rhn') || text.startsWith('rhôn') || text.startsWith('rhon')) return 'Vallée du Rhône';
    if (text.startsWith('cham')) return 'Champagne';
    if (text.startsWith('prov')) return 'Provence';
    if (text.startsWith('loi')) return 'Val de Loire';
    if (text.startsWith('lang')) return 'Languedoc-Roussillon';
    
    return regStr.charAt(0).toUpperCase() + regStr.slice(1);
  };

  // Main Parser (handles CSV, TSV and copy-pasted spreadsheet cells)
  const parseData = (text: string) => {
    setErrorMsg(null);
    setSuccessCount(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      // Split into lines
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        setParsedRows([]);
        return;
      }

      // Determine delimiter (comma, semicolon, or tab)
      const firstLine = lines[0];
      let delimiter = '\t'; // Default to tab (Excel copy-paste)
      
      const tabs = (firstLine.match(/\t/g) || []).length;
      const semicolons = (firstLine.match(/;/g) || []).length;
      const commas = (firstLine.match(/,/g) || []).length;

      if (semicolons > tabs && semicolons > commas) {
        delimiter = ';';
      } else if (commas > tabs && commas > semicolons) {
        delimiter = ',';
      }

      // Helper to split line taking quotes into account
      const splitLine = (line: string): string[] => {
        if (delimiter === '\t') return line.split('\t');
        
        // Simple regex split for CSV with quotes support
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current);
        return result;
      };

      // Extract raw header cells
      const rawHeaders = splitLine(lines[0]).map(h => cleanCell(h).toLowerCase());
      
      // Let's identify the line index to start parsing from (usually 1, but we might skip headers if first line doesn't look like header)
      let startIdx = 1;
      let headers = rawHeaders;
      
      // If the first line has no matching keywords, it might not be a header line
      const looksLikeHeader = rawHeaders.some(h => 
        h.includes('nom') || h.includes('name') || h.includes('vin') || 
        h.includes('domaine') || h.includes('quant') || h.includes('qty') ||
        h.includes('millesime') || h.includes('millésime') || h.includes('vintage') ||
        h.includes('ty') || h.includes('appellation') || h.includes('cuvee') || h.includes('cuvée')
      );

      if (!looksLikeHeader) {
        // No header line, we'll assign dummy indices
        startIdx = 0;
        headers = [];
      }

      const rowsToParse = lines.slice(startIdx);
      const parsed: ParsedRow[] = [];

      // Find column indexes based on keywords
      const getColIdx = (keywords: string[]): number => {
        return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
      };

      // Helper to parse integer safely (handles French decimal numbers like "2,00" -> 2, "2 100,00" -> 2100)
      const parseInteger = (valStr: string): number => {
        if (!valStr) return 0;
        const trimmed = valStr.trim();
        if (!trimmed || trimmed === '-' || trimmed === '—') return 0;

        // Strip spaces and non-breaking spaces (thousand separators in French Excel)
        let cleanStr = trimmed.replace(/[\s\u00a0]/g, '');

        // Strip currency symbols or letters, but keep digits, minus, comma, dot
        cleanStr = cleanStr.replace(/[^\d.,-]/g, '');
        if (!cleanStr) return 0;

        // Handle French comma vs dot decimal separators
        if (cleanStr.includes(',') && cleanStr.includes('.')) {
          if (cleanStr.indexOf(',') < cleanStr.indexOf('.')) {
            cleanStr = cleanStr.replace(/,/g, '');
          } else {
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
          }
        } else if (cleanStr.includes(',')) {
          cleanStr = cleanStr.replace(',', '.');
        }

        const num = parseFloat(cleanStr);
        return isNaN(num) ? 0 : Math.round(num);
      };

      // Helper to parse float/price safely
      const parsePrice = (valStr: string): number | undefined => {
        if (!valStr) return undefined;
        const trimmed = valStr.trim();
        if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed.toLowerCase().includes('div')) return undefined;

        let cleanStr = trimmed.replace(/[\s\u00a0]/g, '').replace(/[^\d.,-]/g, '');
        if (!cleanStr) return undefined;

        if (cleanStr.includes(',') && cleanStr.includes('.')) {
          if (cleanStr.indexOf(',') < cleanStr.indexOf('.')) {
            cleanStr = cleanStr.replace(/,/g, '');
          } else {
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
          }
        } else if (cleanStr.includes(',')) {
          cleanStr = cleanStr.replace(',', '.');
        }

        const num = parseFloat(cleanStr);
        return isNaN(num) ? undefined : Math.round(num * 100) / 100;
      };

      // Exact or fuzzy index mapping for multi-site Excel columns
      let tyIdx = -1, regIdx = -1, formatIdx = -1, appellationIdx = -1, cuveeIdx = -1, millesimeIdx = -1;
      let estancoBinIdx = -1, estancoQtyIdx = -1, cuisineBinIdx = -1, cuisineQtyIdx = -1, cave4BinIdx = -1, cave4QtyIdx = -1, caveRestBinIdx = -1, caveRestQtyIdx = -1;
      let portIdx = -1, htPortIdx = -1;
      let totalQtyIdx = -1, prixHtIdx = -1, prixTtcIdx = -1;

      if (looksLikeHeader) {
        tyIdx = getColIdx(['ty', 'type', 'couleur', 'color', 'catégorie', 'categorie', 'famille', 'classe', 'coul']);
        regIdx = getColIdx(['reg', 'région', 'region', 'pays']);
        formatIdx = getColIdx(['format', 'contenance', 'vol', 'volume', 'for']);
        appellationIdx = getColIdx(['appellation', 'appel', 'appél', 'nom', 'vin', 'produit', 'article', 'boisson', 'libelle', 'libellé']);
        cuveeIdx = getColIdx(['cuvee', 'cuvée', 'cuv']);
        millesimeIdx = getColIdx(['millesime', 'millésime', 'vintage', 'mill', 'année', 'annee', 'ans', 'mill']);
        
        // Dynamic detection for bins and quantities (handling slight variations in "DPR" tab)
        estancoBinIdx = headers.findIndex(h => (h === 'est' || h === 'estanco' || h.includes('estanco')) && !h.includes('nb') && !h.includes('qty') && !h.includes('quant') && !h.includes('nb_'));
        estancoQtyIdx = headers.findIndex(h => (h.includes('estanco') || h.includes('est')) && (h.includes('nb') || h.includes('qty') || h.includes('quant') || h.includes('nb_')));

        cuisineBinIdx = headers.findIndex(h => (h === 'cuis' || h === 'cuisine' || h.includes('cuisine')) && !h.includes('nb') && !h.includes('qty') && !h.includes('quant') && !h.includes('nb_'));
        cuisineQtyIdx = headers.findIndex(h => (h.includes('cuisine') || h.includes('cuis')) && (h.includes('nb') || h.includes('qty') || h.includes('quant') || h.includes('nb_')));

        caveRestBinIdx = headers.findIndex(h => (h === 'rest' || h === 'resto' || h.includes('resto') || h.includes('cave rest') || h.includes('cave resto')) && !h.includes('nb') && !h.includes('qty') && !h.includes('quant') && !h.includes('nb_'));
        caveRestQtyIdx = headers.findIndex(h => (h.includes('resto') || h.includes('rest')) && (h.includes('nb') || h.includes('qty') || h.includes('quant') || h.includes('nb_')));

        cave4BinIdx = getColIdx(['cave +4', 'cave+4', '+4']);
        cave4QtyIdx = getColIdx(['nb +4', 'nb_+4', 'qty +4', 'qty+4']);
        
        totalQtyIdx = headers.findIndex(h => h === 'tot' || h === 'total' || h === 'nb tot' || h === 'qty tot' || (h.includes('total') && !h.includes('ht') && !h.includes('ca')) || (h.includes('tot') && !h.includes('ht') && !h.includes('ca')));
        
        prixHtIdx = headers.findIndex(h => (h === 'ht' || h.includes('ht') || h.includes('pht') || h.includes('achat') || h.includes('prix ht')) && !h.includes('port') && !h.includes('total') && !h.includes('tot') && !h.includes('cout') && !h.includes('coût'));
        prixTtcIdx = headers.findIndex(h => (h === 'ttc' || h.includes('ttc') || h.includes('pv') || h.includes('vente') || h.includes('public')) && !h.includes('total') && !h.includes('tot') && !h.includes('ca') && !h.includes('cout') && !h.includes('coût'));
        portIdx = headers.findIndex(h => h.includes('port') && !h.includes('ht'));
        htPortIdx = headers.findIndex(h => h.includes('ht+port') || h.includes('ht + port') || h.includes('ht port'));

        // Fallback: If Column A (index 0) header is empty and we haven't found region yet,
        // and no other column has claimed index 0, assign regIdx = 0
        if (regIdx === -1 && headers[0] === '') {
          const others = [tyIdx, formatIdx, appellationIdx, cuveeIdx, millesimeIdx];
          if (!others.includes(0)) {
            regIdx = 0;
          }
        }
      }

      // Fuzzy / Dynamic Column Mapping Check by analyzing the first row values
      if (rowsToParse.length > 0) {
        const sampleCells = splitLine(rowsToParse[0]);
        
        if (tyIdx === -1) {
          for (let i = 0; i < Math.min(sampleCells.length, 7); i++) {
            const val = cleanCell(sampleCells[i]).toLowerCase();
            if (['rouge', 'blanc', 'rose', 'rosé', 'bulle', 'bulles', 'orange', 'spiritueux', 'bière', 'cidre'].some(kw => val.includes(kw))) {
              tyIdx = i;
              break;
            }
          }
        }
        
        if (formatIdx === -1) {
          for (let i = 0; i < Math.min(sampleCells.length, 7); i++) {
            const val = cleanCell(sampleCells[i]).toLowerCase();
            if (['bt', 'bouteille', 'magnum', 'half', 'cl', 'pot', 'cl.', 'flacon'].includes(val)) {
              formatIdx = i;
              break;
            }
          }
        }

        if (regIdx === -1) {
          for (let i = 0; i < Math.min(sampleCells.length, 7); i++) {
            const val = cleanCell(sampleCells[i]).toLowerCase();
            if (
              val.startsWith('valle') || 
              val.includes('chili') || 
              val.includes('chile') || 
              val.includes('bourgogne') || 
              val.includes('bordeaux') || 
              val.includes('rhone') || 
              val.includes('alsace') || 
              val.includes('loire') ||
              val.includes('biobio') ||
              val.includes('itata') ||
              val.includes('colchagua')
            ) {
              regIdx = i;
              break;
            }
          }
        }
      }

      const isMultiSiteExcel =
        (appellationIdx !== -1 && cuveeIdx !== -1) || 
        (headers.length === 0 && lines.length > 0 && splitLine(lines[0]).length >= 13) || 
        (headers.length > 0 && splitLine(lines[0]).length >= 13 && headers.some(h => h.includes('est') || h.includes('+4') || h.includes('rest') || h.includes('resto')));

      const maxCells = lines.reduce((max, line) => {
        const count = splitLine(line).length;
        return count > max ? count : max;
      }, 0);

      const hasCuisineInHeaders = headers.some(h => h.includes('cuisine') || h.includes('cuis'));
      
      const isPrieureRochLayout = isMultiSiteExcel && (
        hasCuisineInHeaders || 
        (headers.length === 0 && maxCells >= 15 && maxCells <= 18) ||
        lines.some(l => {
          const cells = splitLine(l);
          return cells.length >= 15 && cells.length <= 18;
        })
      );

      // Define default site lookups
      const findSiteId = (keywords: string[], fallbackId: string): string => {
        const matched = sites.find(s => keywords.some(kw => s.name.toLowerCase().includes(kw)));
        return matched ? matched.id : (sites.find(s => s.id === fallbackId)?.id || fallbackId);
      };

      const restBlancSiteId = findSiteId(['vins blancs', 'blanc', 'site 1'], 'site-1');
      const restRougeSiteId = findSiteId(['vins rouges', 'rouge', 'site 2'], 'site-2');
      const effervescentSiteId = findSiteId(['effervescents', 'champagne', 'bulle', 'site 3'], 'site-3');
      const cuisineSiteId = findSiteId(['cuisine dpr', 'cuisine', 'site 4'], 'site-4');
      const stockPrincipalSiteId = findSiteId(['stock 1,2,3', 'stock', 'estanco', 'site 5'], 'site-5');
      const vieillissementSiteId = findSiteId(['vieillissement', '+4', 'site 6'], 'site-6');
      const debarrasSiteId = findSiteId(['débarrasser', 'debarrasser', 'site 7'], 'site-7');

      // Index mapping for basic formats
      const nameIdx = getColIdx(['nom', 'name', 'vin', 'libellé', 'libelle', 'appellation', 'produit', 'article', 'boisson']);
      const domainIdx = getColIdx(['domaine', 'domain', 'producteur', 'maison', 'château', 'chateau', 'marque', 'brand', 'fabricant']);
      const vintageIdx = getColIdx(['millesime', 'millésime', 'vintage', 'annee', 'année', 'ans', 'mill']);
      const colorIdx = getColIdx(['couleur', 'color', 'type', 'catégorie', 'categorie', 'famille', 'classe']);
      const qtyIdx = getColIdx(['quantite', 'quantité', 'qty', 'quantity', 'bouteille', 'bt', 'stock', 'unit']);
      const regionIdx = getColIdx(['region', 'région', 'pays', 'terroir']);
      const binIdx = getColIdx(['emplacement', 'bin', 'rang', 'case', 'coordonnée', 'coordonnee']);
      const priceBuyIdx = headers.length > 0 
        ? headers.findIndex(h => ['achat', 'buy', 'pa', 'prix_achat'].some(kw => h.includes(kw)) && !h.includes('cout') && !h.includes('coût') && !h.includes('total') && !h.includes('tot'))
        : -1;
      const priceSellIdx = getColIdx(['vente', 'sell', 'pv', 'prix_vente', 'prix']);
      const notesIdx = getColIdx(['notes', 'note', 'commentaire', 'obs']);

      rowsToParse.forEach((line, index) => {
        const cells = splitLine(line);
        if (cells.length === 0 || cells.join('').trim() === '') return;

        const cellVal = (idx: number, fallbackIdx: number): string => {
          const finalIdx = idx !== -1 ? idx : fallbackIdx;
          return cells[finalIdx] ? cleanCell(cells[finalIdx]) : '';
        };

        if (isMultiSiteExcel) {
          // Choose positional fallbacks based on cell count if headers mapping isn't found
          const cellCount = cells.length;
          
          let defaultEstBin = 7;
          let defaultEstQty = 8;
          let defaultCuisineBin = -1;
          let defaultCuisineQty = -1;
          let defaultCave4Bin = 9;
          let defaultCave4Qty = 10;
          let defaultRestBin = 11;
          let defaultRestQty = 12;
          let defaultTotal = 13;
          let defaultHt = 14;
          let defaultTtc = 18;
          let defaultMill = 6;
          
          if (isPrieureRochLayout) {
            // Layout from the image (Type, REGION, Format, Appellation, Millesime, ESTANCO, NB EST, CUISINE, NB CUISINE, RESTO, NB RESTO, TOTAL, PRIX HT, COEF, PV TTC, TOT HT, CA)
            defaultMill = 4;
            defaultEstBin = 5;
            defaultEstQty = 6;
            defaultCuisineBin = 7;
            defaultCuisineQty = 8;
            defaultRestBin = 9;
            defaultRestQty = 10;
            defaultTotal = 11;
            defaultHt = 12;
            defaultTtc = 14;
            defaultCave4Bin = -1;
            defaultCave4Qty = -1;
          }

          let finalTyIdx = tyIdx !== -1 ? tyIdx : 2;
          let finalRegIdx = regIdx !== -1 ? regIdx : 0;
          let finalFormatIdx = formatIdx !== -1 ? formatIdx : 1;
          let finalAppellIdx = appellationIdx !== -1 ? appellationIdx : 3;
          let finalMillIdx = millesimeIdx !== -1 ? millesimeIdx : defaultMill;
          
          let finalEstBinIdx = estancoBinIdx !== -1 ? estancoBinIdx : defaultEstBin;
          let finalEstQtyIdx = estancoQtyIdx !== -1 ? estancoQtyIdx : defaultEstQty;
          let finalCuisineBinIdx = cuisineBinIdx !== -1 ? cuisineBinIdx : defaultCuisineBin;
          let finalCuisineQtyIdx = cuisineQtyIdx !== -1 ? cuisineQtyIdx : defaultCuisineQty;
          let finalCave4BinIdx = cave4BinIdx !== -1 ? cave4BinIdx : defaultCave4Bin;
          let finalCave4QtyIdx = cave4QtyIdx !== -1 ? cave4QtyIdx : defaultCave4Qty;
          let finalRestBinIdx = caveRestBinIdx !== -1 ? caveRestBinIdx : defaultRestBin;
          let finalRestQtyIdx = caveRestQtyIdx !== -1 ? caveRestQtyIdx : defaultRestQty;
          let finalTotalIdx = totalQtyIdx !== -1 ? totalQtyIdx : defaultTotal;
          
          let finalHtIdx = prixHtIdx !== -1 ? prixHtIdx : defaultHt;
          let finalPortIdx = portIdx !== -1 ? portIdx : -1;
          let finalHtPortIdx = htPortIdx !== -1 ? htPortIdx : -1;
          let finalTtcIdx = prixTtcIdx !== -1 ? prixTtcIdx : defaultTtc;

          const rTy = cellVal(finalTyIdx, 2);
          const rReg = cellVal(finalRegIdx, 0);
          const rFormat = cellVal(finalFormatIdx, 1);
          const rAppellation = cellVal(finalAppellIdx, 3);
          
          // Domain resolution:
          // If no domain column is present, and we are in the 15-18 cell count range (DPR Multi-Site Sheet),
          // we default to 'Domaine Prieuré-Roch' to prevent reading the vintage from index 4.
          let rDomain = '';
          if (domainIdx !== -1) {
            rDomain = cellVal(domainIdx, 4);
          } else if (isPrieureRochLayout) {
            rDomain = 'Domaine Prieuré-Roch';
          } else {
            rDomain = 'Domaine Inconnu';
          }

          if (rDomain && (rDomain.trim().toLowerCase() === 'dpr' || rDomain.trim().toLowerCase() === 'domaine prieuré-roch' || rDomain.trim().toLowerCase() === 'domaine prieure-roch')) {
            rDomain = 'Domaine Prieuré-Roch';
          }

          // Skip summary/total/placeholder/empty rows
          const appellLower = (rAppellation || '').trim().toLowerCase();
          const domLower = (rDomain || '').trim().toLowerCase();
          const tyLower = (rTy || '').trim().toLowerCase();

          if (
            (!rAppellation && !cuveeIdx && (!rDomain || domLower === 'domaine inconnu')) ||
            appellLower.includes('total') || 
            appellLower.includes('totaux') || 
            appellLower.includes('somme') || 
            appellLower.includes('cout achat') ||
            domLower.includes('total') || 
            domLower.includes('totaux') || 
            tyLower.includes('total') ||
            tyLower.includes('totaux') ||
            appellLower.startsWith('manquant') || 
            appellLower === 'vide' || 
            appellLower === 'aucun' || 
            appellLower === '-' || 
            appellLower === '—' ||
            (appellLower.includes('manquant') && (!domLower || domLower === 'domaine inconnu' || domLower.includes('manquant')))
          ) {
            return;
          }

          // Cuvee resolution:
          // If no cuvee column is present, we must NOT default to index 5 (which is the ESTANCO bin in the DPR layout!)
          let rCuvee = '';
          if (cuveeIdx !== -1) {
            rCuvee = cellVal(cuveeIdx, 5);
          } else {
            rCuvee = '';
          }

          const rVintage = cellVal(finalMillIdx, defaultMill) || 'N.V.';

          // Robust bin & quantity parsing (handling cases where users put pure digits in bin column)
          let rEstancoBin = cellVal(finalEstBinIdx, defaultEstBin);
          let rEstancoQty = parseInteger(cellVal(finalEstQtyIdx, defaultEstQty));
          if (rEstancoQty === 0 && rEstancoBin !== '') {
            if (/^\d+$/.test(rEstancoBin.trim())) {
              const num = parseInt(rEstancoBin.trim(), 10);
              if (num > 0) {
                rEstancoQty = num;
                rEstancoBin = '';
              }
            }
          }

          let rCuisineBin = finalCuisineBinIdx !== -1 ? cellVal(finalCuisineBinIdx, defaultCuisineBin) : '';
          let rCuisineQty = finalCuisineQtyIdx !== -1 ? parseInteger(cellVal(finalCuisineQtyIdx, defaultCuisineQty)) : 0;
          if (rCuisineQty === 0 && rCuisineBin !== '') {
            if (/^\d+$/.test(rCuisineBin.trim())) {
              const num = parseInt(rCuisineBin.trim(), 10);
              if (num > 0) {
                rCuisineQty = num;
                rCuisineBin = '';
              }
            }
          }

          let rCave4Bin = finalCave4BinIdx !== -1 ? cellVal(finalCave4BinIdx, defaultCave4Bin) : '';
          let rCave4Qty = finalCave4QtyIdx !== -1 ? parseInteger(cellVal(finalCave4QtyIdx, defaultCave4Qty)) : 0;
          if (rCave4Qty === 0 && rCave4Bin !== '') {
            if (/^\d+$/.test(rCave4Bin.trim())) {
              const num = parseInt(rCave4Bin.trim(), 10);
              if (num > 0) {
                rCave4Qty = num;
                rCave4Bin = '';
              }
            }
          }

          let rRestBin = cellVal(finalRestBinIdx, defaultRestBin);
          let rRestQty = parseInteger(cellVal(finalRestQtyIdx, defaultRestQty));
          if (rRestQty === 0 && rRestBin !== '') {
            if (/^\d+$/.test(rRestBin.trim())) {
              const num = parseInt(rRestBin.trim(), 10);
              if (num > 0) {
                rRestQty = num;
                rRestBin = '';
              }
            }
          }

          const rTotalQty = parseInteger(cellVal(finalTotalIdx, defaultTotal));

          // Pricing calculation:
          // PRIX HT = purchase price without shipping (rPriceBuyHt)
          // si y'a des frais de port, vrai prix d'achat = HT + PORT (rPriceBuy)
          const valHtNo = cellVal(finalHtIdx, defaultHt);
          const valPort = finalPortIdx !== -1 ? cellVal(finalPortIdx, -1) : '';
          const valHtPort = finalHtPortIdx !== -1 ? cellVal(finalHtPortIdx, -1) : '';

          const parsedHt = parsePrice(valHtNo);
          const parsedPort = parsePrice(valPort);
          const parsedHtPort = parsePrice(valHtPort);

          const rPriceBuyHt = parsedHt ?? (parsedHtPort !== undefined && parsedPort !== undefined ? Math.round((parsedHtPort - parsedPort) * 100) / 100 : undefined);
          let rShippingCost = parsedPort;

          // Si HT + Port est spécifié directement, on le prend. Sinon, on additionne HT + Port.
          let rPriceBuy: number | undefined = undefined;
          if (parsedHtPort !== undefined) {
            rPriceBuy = parsedHtPort;
          } else if (parsedHt !== undefined) {
            rPriceBuy = Math.round((parsedHt + (parsedPort ?? 0)) * 100) / 100;
          }

          if (rPriceBuy !== undefined && rPriceBuyHt !== undefined && rShippingCost === undefined) {
            const diff = Math.round((rPriceBuy - rPriceBuyHt) * 100) / 100;
            if (diff > 0) {
              rShippingCost = diff;
            }
          }

          let rPriceSell = parsePrice(cellVal(finalTtcIdx, defaultTtc));
          if (rPriceSell === undefined && rPriceBuy !== undefined && rPriceBuy > 0) {
            rPriceSell = calculateSellingPrice(rPriceBuy);
          }

          // Combine Appellation & Cuvée for wine's name
          let rName = rAppellation;
          if (rCuvee) {
            rName = rAppellation ? `${rAppellation} - ${rCuvee}` : rCuvee;
          }

          if (!rName) {
            parsed.push({
              name: '',
              domain: '',
              vintage: '',
              color: 'autre',
              region: '',
              quantity: 0,
              alertThreshold: 2,
              isValid: false,
              error: `Ligne ${index + startIdx + 1}: Informations de vin ou appellation manquantes.`
            });
            return;
          }

          // Format suffix representation (e.g. Magnum, 50 cl)
          let formatSuffix = '';
          if (rFormat && rFormat.toLowerCase() !== 'bt' && rFormat.toLowerCase() !== 'bouteille') {
            formatSuffix = ` (${rFormat})`;
          }
          const finalName = `${rName}${formatSuffix}`;

          const rColor = detectColor(rTy || rCuvee || rAppellation, finalName);
          const rRegion = expandRegion(rReg, rDomain, rAppellation);

          // Build separate rows for each site that has active quantity
          let hasAddedSubRow = false;

          if (isRefOnly) {
            // MODE 1: REFERENCE ONLY (STOCK = 0)
            parsed.push({
              name: finalName,
              domain: rDomain || 'Domaine Inconnu',
              vintage: rVintage,
              color: rColor,
              region: rRegion,
              quantity: 0,
              alertThreshold: 2,
              priceBuy: rPriceBuy,
              priceBuyHt: rPriceBuyHt,
              shippingCost: rShippingCost,
              priceSell: rPriceSell,
              bin: undefined,
              siteId: selectedSiteId || stockPrincipalSiteId,
              siteName: 'Référence Catalogue',
              isValid: true,
              appellation: rAppellation || undefined,
              cuvee: rCuvee || undefined
            });
          } else {
            // MODE 2: FULL STOCK PER SITE
            const addSubRow = (qtyVal: number, siteId: string, siteName: string, binVal?: string) => {
              if (qtyVal > 0) {
                parsed.push({
                  name: finalName,
                  domain: rDomain || 'Domaine Inconnu',
                  vintage: rVintage,
                  color: rColor,
                  region: rRegion,
                  quantity: qtyVal,
                  alertThreshold: Math.max(1, Math.round(qtyVal / 3)),
                  priceBuy: rPriceBuy,
                  priceBuyHt: rPriceBuyHt,
                  shippingCost: rShippingCost,
                  priceSell: rPriceSell,
                  bin: binVal || undefined,
                  siteId,
                  siteName,
                  isValid: true,
                  appellation: rAppellation || undefined,
                  cuvee: rCuvee || undefined
                });
                hasAddedSubRow = true;
              }
            };

            // 1. Stock 1,2,3 et 4 (Site 5)
            addSubRow(rEstancoQty, stockPrincipalSiteId, "Site 5 : Stock 1,2,3 et 4", rEstancoBin);
            // 2. Cuisine DPR (Site 4)
            addSubRow(rCuisineQty, cuisineSiteId, "Site 4 : Cuisine DPR", rCuisineBin);
            // 3. Vieillissement (Site 6)
            if (finalCave4BinIdx !== -1) {
              addSubRow(rCave4Qty, vieillissementSiteId, "Site 6 : Vieillissement", rCave4Bin);
            }
            // 4. Carte according to color:
            // Blanc -> Site 1 : Vins blancs à la carte
            // Rouge -> Site 2 : Vins rouges à la carte
            // Bulle -> Site 3 : Effervescents à la carte
            let restSiteId = restBlancSiteId;
            let restSiteName = "Site 1 : Vins blancs à la carte";
            if (rColor === 'rouge') {
              restSiteId = restRougeSiteId;
              restSiteName = "Site 2 : Vins rouges à la carte";
            } else if (rColor === 'bulle') {
              restSiteId = effervescentSiteId;
              restSiteName = "Site 3 : Effervescents à la carte";
            }
            addSubRow(rRestQty, restSiteId, restSiteName, rRestBin);

            // Fallback if no sub-rows were generated
            if (!hasAddedSubRow) {
              let targetSiteIdForZero = stockPrincipalSiteId;
              let targetSiteNameForZero = "Site 5 : Stock 1,2,3 et 4";
              let targetBinForZero = rEstancoBin;

              if (rCuisineBin) {
                targetSiteIdForZero = cuisineSiteId;
                targetSiteNameForZero = "Site 4 : Cuisine DPR";
                targetBinForZero = rCuisineBin;
              } else if (rCave4Bin) {
                targetSiteIdForZero = vieillissementSiteId;
                targetSiteNameForZero = "Site 6 : Vieillissement";
                targetBinForZero = rCave4Bin;
              } else if (rRestBin) {
                targetSiteIdForZero = restSiteId;
                targetSiteNameForZero = restSiteName;
                targetBinForZero = rRestBin;
              } else if (rEstancoBin) {
                targetSiteIdForZero = stockPrincipalSiteId;
                targetSiteNameForZero = "Site 5 : Stock 1,2,3 et 4";
                targetBinForZero = rEstancoBin;
              } else {
                targetSiteIdForZero = selectedSiteId || stockPrincipalSiteId;
                targetSiteNameForZero = sites.find(s => s.id === targetSiteIdForZero)?.name || "Site 5 : Stock 1,2,3 et 4";
                targetBinForZero = '';
              }

              parsed.push({
                name: finalName,
                domain: rDomain || 'Domaine Inconnu',
                vintage: rVintage,
                color: rColor,
                region: rRegion,
                quantity: Math.max(0, rTotalQty),
                alertThreshold: 2,
                priceBuy: rPriceBuy,
                priceBuyHt: rPriceBuyHt,
                shippingCost: rShippingCost,
                priceSell: rPriceSell,
                bin: targetBinForZero || undefined,
                siteId: targetSiteIdForZero,
                siteName: targetSiteNameForZero,
                isValid: true,
                appellation: rAppellation || undefined,
                cuvee: rCuvee || undefined
              });
            }
          }
        } else {
          // STANDARD CSV / TSV FORMAT FALLBACK
          const rName = cellVal(nameIdx, 0);
          let rDomain = cellVal(domainIdx, 1);
          if (rDomain && (rDomain.trim().toLowerCase() === 'dpr' || rDomain.trim().toLowerCase() === 'domaine prieuré-roch' || rDomain.trim().toLowerCase() === 'domaine prieure-roch')) {
            rDomain = 'Domaine Prieuré-Roch';
          }

          // Skip summary / total / placeholder rows
          const nameLower = (rName || '').trim().toLowerCase();
          const domLower = (rDomain || '').trim().toLowerCase();
          if (
            nameLower.includes('total') ||
            nameLower.includes('totaux') ||
            nameLower.includes('somme') ||
            domLower.includes('total') ||
            domLower.includes('totaux') ||
            nameLower.startsWith('manquant') || 
            nameLower === 'vide' || 
            nameLower === 'aucun' || 
            nameLower === '-' || 
            nameLower === '—' ||
            (nameLower.includes('manquant') && (!domLower || domLower === 'domaine inconnu' || domLower.includes('manquant')))
          ) {
            return;
          }
          const rVintage = cellVal(vintageIdx, 2) || 'N.V.';
          const rColorRaw = cellVal(colorIdx, 3);
          const rQtyRaw = cellVal(qtyIdx, 4);
          const rRegionRaw = cellVal(regionIdx, 5);
          const rBin = cellVal(binIdx, 6);
          const rPriceBuyRaw = cellVal(priceBuyIdx, 7);
          const rPriceSellRaw = cellVal(priceSellIdx, 8);
          const rNotes = cellVal(notesIdx, 9);

          if (!rName) {
            parsed.push({
              name: '',
              domain: '',
              vintage: '',
              color: 'autre',
              region: '',
              quantity: 0,
              alertThreshold: 2,
              isValid: false,
              error: `Ligne ${index + startIdx + 1}: Nom du vin manquant.`
            });
            return;
          }

          // Parse quantity safely
          let rQty = isRefOnly ? 0 : parseInteger(rQtyRaw);
          if (!isRefOnly && isNaN(rQty)) {
            rQty = 1;
          }

          let rAppellation: string | undefined = undefined;
          let rCuvee: string | undefined = undefined;
          if (rName.includes(' - ')) {
            const parts = rName.split(' - ');
            rAppellation = parts[0].trim();
            rCuvee = parts.slice(1).join(' - ').trim();
          } else {
            rAppellation = rName;
          }

          const rPriceBuy = parsePrice(rPriceBuyRaw);
          const rPriceSell = parsePrice(rPriceSellRaw);
          const rColor = detectColor(rColorRaw, rName);
          const rRegion = expandRegion(rRegionRaw, rDomain, rAppellation);

          parsed.push({
            name: rName,
            domain: rDomain || 'Domaine Inconnu',
            vintage: rVintage,
            color: rColor,
            region: rRegion,
            quantity: isRefOnly ? 0 : rQty,
            alertThreshold: 2,
            priceBuy: rPriceBuy,
            priceSell: rPriceSell,
            bin: isRefOnly ? undefined : (rBin || undefined),
            notes: rNotes || undefined,
            isValid: true,
            appellation: rAppellation,
            cuvee: rCuvee
          });
        }
      });

      setParsedRows(consolidateRows(parsed, isRefOnly));
    } catch (e: any) {
      setErrorMsg(`Erreur lors de l'analyse du format : ${e?.message || e}`);
      setParsedRows([]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      parseData(text);
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    setInputText('');
    setParsedRows([]);
    setSuccessCount(null);
    setImportResults(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sequential batch insertion into Firestore
  const executeImport = async (targetRows?: ParsedRow[]) => {
    if (!selectedSiteId && !isRefOnly) {
      setErrorMsg("Veuillez sélectionner un site de stockage de destination.");
      return;
    }

    const rowsToProcess = targetRows ? enrichedQueueRows : enrichedRows;
    const validRows = rowsToProcess.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg("Aucune ligne valide à importer.");
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);
    setSuccessCount(null);
    setImportResults(null);
    setImportProgress({ current: 0, total: validRows.length });

    let count = 0;
    let newCreated = 0;
    let updatedReplaced = 0;
    let skippedIso = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const targetSiteId = row.siteId || selectedSiteId || 'site-3';
      
      if (row.importStatus === 'iso') {
        skippedIso++;
        count++;
        setImportProgress({ current: count, total: validRows.length });
        continue;
      }

      try {
        const existingWine = findMatchingWine(row, wines, targetSiteId, isRefOnly);

        if (isRefOnly) {
          // MODE 1: REFERENCE ONLY (STOCK STAYS STRICTLY 0)
          if (existingWine) {
            await updateWine(existingWine.id, {
              priceBuy: row.priceBuy !== undefined ? row.priceBuy : existingWine.priceBuy,
              priceBuyHt: row.priceBuyHt !== undefined ? row.priceBuyHt : existingWine.priceBuyHt,
              shippingCost: row.shippingCost !== undefined ? row.shippingCost : existingWine.shippingCost,
              priceSell: row.priceSell !== undefined ? row.priceSell : existingWine.priceSell,
              color: row.color,
              region: row.region || existingWine.region,
              appellation: row.appellation || existingWine.appellation,
              cuvee: row.cuvee || existingWine.cuvee
            }, 'edit');
            updatedReplaced++;
          } else {
            await addWine({
              name: row.name,
              domain: row.domain,
              vintage: row.vintage,
              color: row.color,
              region: row.region,
              quantity: 0,
              alertThreshold: 2,
              siteId: targetSiteId,
              priceBuy: row.priceBuy,
              priceBuyHt: row.priceBuyHt,
              shippingCost: row.shippingCost,
              priceSell: row.priceSell,
              bin: '',
              notes: row.notes,
              appellation: row.appellation,
              cuvee: row.cuvee
            });
            newCreated++;
          }
        } else {
          // MODE 2: FULL STOCK IMPORT
          const wineId = await addWine({
            name: row.name,
            domain: row.domain,
            vintage: row.vintage,
            color: row.color,
            region: row.region,
            quantity: row.quantity,
            alertThreshold: row.alertThreshold,
            siteId: targetSiteId,
            priceBuy: row.priceBuy,
            priceBuyHt: row.priceBuyHt,
            shippingCost: row.shippingCost,
            priceSell: row.priceSell,
            bin: row.bin,
            notes: row.notes || (row.siteName ? `Importation de stock - ${row.siteName}` : undefined),
            appellation: row.appellation,
            cuvee: row.cuvee
          }, { importMode: 'replace' });

          if (row.importStatus === 'new') {
            newCreated++;
            if (row.quantity > 0) {
              await addMovement({
                wineId,
                wineName: `${row.name} (${row.vintage})`,
                type: 'in',
                quantity: row.quantity,
                reason: 'livraison',
                notes: `Mise en stock initiale par import Excel/CSV (${row.siteName || 'Site sélectionné'}).`,
                toSiteId: targetSiteId
              });
            }
          } else if (row.importStatus === 'different') {
            updatedReplaced++;
            if (existingWine) {
              const qtyDiff = row.quantity - existingWine.quantity;
              if (qtyDiff !== 0) {
                await addMovement({
                  wineId,
                  wineName: `${row.name} (${row.vintage})`,
                  type: qtyDiff > 0 ? 'in' : 'out',
                  quantity: Math.abs(qtyDiff),
                  reason: 'correction',
                  notes: `Réajustement automatique de stock par réimport Excel/CSV (Ancien: ${existingWine.quantity}, Nouveau: ${row.quantity}).`,
                  fromSiteId: qtyDiff < 0 ? targetSiteId : undefined,
                  toSiteId: qtyDiff > 0 ? targetSiteId : undefined
                });
              }
            }
          }
        }

        count++;
        setImportProgress({ current: count, total: validRows.length });
      } catch (err) {
        console.error("Failed to import row:", row, err);
      }
    }

    setIsImporting(false);
    setSuccessCount(count);
    setImportResults({
      newCreated,
      updatedReplaced,
      skippedIso
    });
    setParsedRows([]);
    setQueueRows([]);
    setInputText('');
    
    if (onImportComplete) {
      onImportComplete();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-md p-6 space-y-6 text-slate-800">
      
      {/* Title block */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-600">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black tracking-wider text-slate-900 uppercase font-mono">
            Importateur de Fichier Excel / CSV
          </h3>
          <p className="text-xs text-slate-400 font-bold font-mono">
            Remplissage massif de la cave Premnord en 1 clic
          </p>
        </div>
      </div>

      {/* Mode Selector Header */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-2 border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setImportType('references_only');
            if (inputText) parseData(inputText);
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-3 cursor-pointer ${
            importType === 'references_only'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
          <div className="text-left">
            <div className="font-bold flex items-center gap-1.5">
              <span>Mode 1 : Références & Prix (Stock = 0)</span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] rounded font-mono uppercase">Vérification</span>
            </div>
            <div className="text-[10px] font-normal text-slate-500 leading-snug">
              Compare chaque onglet copié aux 2675 références en base. Importe fiches & prix sans aucun stock.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setImportType('stock_full');
            if (inputText) parseData(inputText);
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-3 cursor-pointer ${
            importType === 'stock_full'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Database className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-left">
            <div className="font-bold flex items-center gap-1.5">
              <span>Mode 2 : Inventaire & Stocks par Site</span>
              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] rounded font-mono uppercase">Stocks Physiques</span>
            </div>
            <div className="text-[10px] font-normal text-slate-500 leading-snug">
              Importation des bouteilles physiques avec ventilation par cave (Estanco, Cave +4, Cuisine, Restaurant).
            </div>
          </div>
        </button>
      </div>

      {/* Guide/Explain block */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-xs space-y-2">
        <p className="font-bold flex items-center gap-1.5 text-slate-900 text-xs">
          <Info className="w-4 h-4 text-red-600" />
          {importType === 'references_only' ? (
            "Copier-coller magique de vérification des Références (Sans stock)"
          ) : (
            "Comment ça marche pour l'oncle ? (Importation de stock)"
          )}
        </p>
        {importType === 'references_only' ? (
          <p className="text-slate-600 font-sans leading-relaxed">
            Sélectionnez n'importe quel onglet dans Excel, faites <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] shadow-sm">Ctrl+C</kbd>, puis collez dans la zone ci-dessous. Le système va instantanément scanner les références par rapport aux 2675 références enregistrées en base pour vous indiquer la conformité de cet onglet (<strong>100% présent</strong>, <strong>Prix modifiés</strong>, ou <strong>Références manquantes à créer</strong>).
          </p>
        ) : (
          <ul className="space-y-1.5 text-slate-600 pl-5 list-disc font-sans leading-relaxed">
            <li><strong>Méthode 1 (Copier-Coller - Recommandé)</strong> : Ouvrez le fichier Excel. Sélectionnez vos lignes de vin (avec ou sans les entêtes). Faites <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] shadow-sm">Ctrl+C</kbd> (ou <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] shadow-sm">Cmd+C</kbd>). Cliquez dans le cadre de saisie ci-dessous et faites <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px] shadow-sm">Ctrl+V</kbd> !</li>
            <li><strong>Méthode 2 (Fichier CSV)</strong> : Dans Excel, faites <i>Fichier &gt; Enregistrer sous...</i> et choisissez le format <strong>CSV (séparateur point-virgule ou virgule)</strong>. Glissez ensuite le fichier directement dans la zone de dépôt ci-dessous.</li>
            <li>Les colonnes reconnues automatiquement sont : <strong>Nom / Vin, Domaine / Producteur, Millésime, Quantité, Région, Emplacement / Case, Prix</strong>.</li>
          </ul>
        )}
      </div>

      {/* Step 1: Target Site Selection (only needed in full stock mode, or as fallback) */}
      {!isRefOnly && (
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-500 font-mono uppercase tracking-wider font-bold">
            1. Site de stockage de destination *
          </label>
          
          {parsedRows.some(r => r.siteId !== undefined) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1 animate-fade-in">
              <p className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                Format Multi-Sites Détecté !
              </p>
              <p className="text-xs text-amber-800 font-sans leading-relaxed">
                Votre fichier contient des colonnes de stock distinctes par zone (Estanco, Cave +4, Restaurant). Les bouteilles seront <strong>ventilées automatiquement</strong> vers leurs caves respectives. Le sélecteur ci-dessous servira uniquement de repli si une ligne n'a pas de site défini.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              disabled={isImporting}
              className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-800 text-sm rounded-xl px-4 outline-none cursor-pointer font-semibold shadow-sm"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-slate-400 font-mono leading-tight">
            {parsedRows.some(r => r.siteId !== undefined)
              ? "Site de secours par défaut si une ligne ne spécifie pas de zone."
              : "Toutes les bouteilles de cette importation seront initialement enregistrées dans cette zone de cave."}
          </p>
        </div>
      )}

      {/* Step 2: Paste or Drop */}
      {!parsedRows.length && !successCount && (
        <div className="space-y-3">
          <label className="block text-[11px] text-slate-500 font-mono uppercase tracking-wider font-bold">
            {isRefOnly ? "2. Collez les cellules d'un onglet Excel pour vérifier les références" : "2. Glissez le fichier CSV ou collez directement vos cellules Excel"}
          </label>
          
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[160px] cursor-pointer transition-all duration-200 ${
              dragActive 
                ? 'border-red-500 bg-red-50/20' 
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, text/csv, text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-xs font-bold text-slate-700">
              Déposez votre fichier CSV ici, ou cliquez pour parcourir
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Accepte les fichiers CSV (.csv) encodés en UTF-8
            </p>
            
            <div className="relative flex py-3 items-center w-full max-w-xs">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-[9px] uppercase tracking-widest font-mono font-bold">OU ALORS</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('excel-paste-area');
                el?.scrollIntoView({ behavior: 'smooth' });
                el?.focus();
              }}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-400" />
              Saisir / Coller du texte brut
            </button>
          </div>

          <div className="space-y-1">
            <textarea
              id="excel-paste-area"
              rows={4}
              placeholder="Collez ici le contenu d'un onglet Excel... (Nom, Domaine, Millésime, Prix, etc.)"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                parseData(e.target.value);
              }}
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl p-3 text-xs text-slate-800 outline-none font-mono placeholder:text-slate-400 placeholder:font-sans"
            />
          </div>
        </div>
      )}

      {/* Errors output */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2 items-center">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-600" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Success notification */}
      {importResults && (
        <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl space-y-3 shadow-inner text-slate-800">
          <div className="flex gap-2.5 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0 mt-0.5 animate-bounce">
              <Check className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-black uppercase font-mono tracking-wider text-emerald-900">
                Traitement des références terminé avec succès !
              </p>
              <div className="text-xs space-y-1 text-slate-600 font-sans">
                <p>La base de données a été synchronisée avec vos données copier-coller :</p>
                <ul className="list-disc pl-5 space-y-0.5 mt-1 font-mono text-[11px]">
                  {importResults.newCreated > 0 && (
                    <li><span className="font-bold text-emerald-700">+{importResults.newCreated}</span> nouvelles références créées (Stock = 0)</li>
                  )}
                  {importResults.updatedReplaced > 0 && (
                    <li><span className="font-bold text-amber-600">{importResults.updatedReplaced}</span> fiches références mises à jour (prix d'achat/vente)</li>
                  )}
                  {importResults.skippedIso > 0 && (
                    <li><span className="font-bold text-slate-500">{importResults.skippedIso}</span> fiches identiques déjà en base ignorées</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Tester un autre onglet
          </button>
        </div>
      )}

      {/* Import Progress state */}
      {isImporting && (
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between text-xs font-mono font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              Synchronisation des références dans Firestore...
            </span>
            <span>{importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-red-600 transition-all duration-300" 
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono text-center leading-none">
            Ne fermez pas cette page pendant l'enregistrement des références.
          </p>
        </div>
      )}

      {/* Step 3: Raw parsed preview rows */}
      {parsedRows.length > 0 && !isImporting && (
        <div className="space-y-4">
          
          {/* Double Check & Tab Diagnostic Banner */}
          {tabStats && (
            <div className={`p-5 rounded-2xl border ${
              tabStats.isFullyImported
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : tabStats.hasOnlyPriceUpdates
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-indigo-50/90 border-indigo-300 text-indigo-950'
            } space-y-3 shadow-sm font-sans animate-fade-in`}>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                    tabStats.isFullyImported
                      ? 'bg-emerald-600 text-white'
                      : tabStats.hasOnlyPriceUpdates
                      ? 'bg-amber-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {tabStats.matchPercentage}%
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2">
                      {tabStats.isFullyImported ? (
                        <span>✅ ONGLET 100% CONFORME & PRÉSENT EN BASE</span>
                      ) : tabStats.hasOnlyPriceUpdates ? (
                        <span>🟧 RÉFÉRENCES PRÉSENTES (Prix à mettre à jour)</span>
                      ) : (
                        <span>⚠️ ONGLET À IMPORTATION PARTIELLE ({tabStats.newCount} RÉF. MANQUANTE{tabStats.newCount > 1 ? 'S' : ''})</span>
                      )}
                    </h4>
                    <p className="text-xs opacity-90 leading-relaxed font-sans mt-0.5">
                      {tabStats.isFullyImported ? (
                        `Toutes les ${tabStats.total} références de cet onglet existent déjà dans votre catalogue avec des tarifs identiques.`
                      ) : tabStats.hasOnlyPriceUpdates ? (
                        `Les ${tabStats.total} références existent déjà en base. ${tabStats.priceUpdateCount} fiches présentent un nouveau prix d'achat/vente dans cet onglet.`
                      ) : (
                        `${tabStats.existingCount} sur ${tabStats.total} références (${tabStats.matchPercentage}%) existent déjà en stock/base. ${tabStats.newCount} référence${tabStats.newCount > 1 ? 's ne sont' : ' n\'est'} pas encore créée${tabStats.newCount > 1 ? 's' : ''}.`
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setInputText('');
                      setParsedRows([]);
                      setTimeout(() => {
                        const area = document.getElementById('excel-paste-area');
                        area?.focus();
                      }, 100);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="Effacer et coller l'onglet suivant"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                    Coller l'onglet suivant
                  </button>
                </div>
              </div>

              {/* Metric Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
                <span className="px-3 py-1 bg-white/80 border border-black/10 rounded-lg text-emerald-800 shadow-2xs">
                  🟢 {tabStats.isoCount} Références identiques en base
                </span>
                {tabStats.priceUpdateCount > 0 && (
                  <span className="px-3 py-1 bg-white/80 border border-black/10 rounded-lg text-amber-800 shadow-2xs">
                    🟧 {tabStats.priceUpdateCount} Prix modifiés à mettre à jour
                  </span>
                )}
                {tabStats.newCount > 0 && (
                  <span className="px-3 py-1 bg-white/80 border border-black/10 rounded-lg text-indigo-800 shadow-2xs">
                    🔵 {tabStats.newCount} Nouvelles références à créer (Stock = 0)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Filter Bar & Header controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wider font-bold">
              3. Aperçu des références ({parsedRows.filter(r => r.isValid).length} décodées)
            </span>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] font-mono font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tous ({enrichedRows.filter(r => r.isValid).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('new')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'new' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                🔵 Nouvelles ({tabStats?.newCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('different')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'different' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                🟧 Prix modifiés ({tabStats?.priceUpdateCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('iso')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'iso' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                🟢 Identiques ({tabStats?.isoCount || 0})
              </button>
            </div>

            <button
              onClick={clearAll}
              className="text-[10px] text-rose-600 hover:text-rose-700 font-mono font-bold flex items-center gap-1 cursor-pointer select-none"
            >
              <Trash2 className="w-3.5 h-3.5" /> Effacer l'onglet
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto shadow-sm">
            <table className="w-full text-[11px] font-mono border-collapse bg-slate-50">
              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Nom / Domaine</th>
                  <th className="px-3 py-2 text-center w-12">Année</th>
                  <th className="px-3 py-2 text-center w-16">Couleur</th>
                  <th className="px-3 py-2 text-center w-12">{isRefOnly ? "Stock" : "Qté"}</th>
                  <th className="px-3 py-2 text-right w-16">P. HT</th>
                  <th className="px-3 py-2 text-right w-16">Port</th>
                  <th className="px-3 py-2 text-right w-20 text-slate-900 font-black">P. Achat U.</th>
                  <th className="px-3 py-2 text-right w-16">P. TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-700">
                {enrichedRows
                  .filter(r => {
                    if (!r.isValid) return true;
                    if (filterStatus === 'all') return true;
                    return r.importStatus === filterStatus;
                  })
                  .map((row, idx) => (
                    <tr key={idx} className={row.isValid ? "bg-white hover:bg-slate-50" : "bg-rose-50 hover:bg-rose-100"}>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {row.isValid && (
                          row.importStatus === 'new' ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold uppercase tracking-wider">🔵 Nouvelle</span>
                          ) : row.importStatus === 'different' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[9px] font-bold uppercase tracking-wider">🟧 Prix Modifié</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold uppercase tracking-wider">🟢 Déjà en base</span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[220px]" title={row.name}>
                        <span className="font-bold text-slate-900 block truncate">{row.name || 'MANQUANT !'}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{row.domain} • {row.region || 'Aucune région'}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center font-bold text-slate-800">{row.vintage}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          row.color === 'rouge' ? 'bg-red-50 text-red-700 border border-red-100' :
                          row.color === 'blanc' ? 'bg-amber-50 text-amber-700 border border-amber-150' :
                          row.color === 'rose' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                          row.color === 'bulle' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                          row.color === 'spiritueux' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          row.color === 'soft' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {row.color}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center font-black text-slate-900">
                        {isRefOnly ? <span className="text-slate-400 font-mono font-normal">0 (Référence)</span> : row.quantity}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-slate-800">
                        {row.priceBuyHt !== undefined ? `${row.priceBuyHt}€` : (row.priceBuy !== undefined ? `${row.priceBuy}€` : '—')}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-amber-800">
                        {row.shippingCost !== undefined && row.shippingCost > 0 ? `${row.shippingCost}€` : '0€'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-slate-900 bg-slate-50/80 border-x border-slate-150">
                        {row.priceBuy !== undefined ? `${row.priceBuy}€` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-emerald-800">
                        {row.priceSell !== undefined ? `${row.priceSell}€` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Action Trigger import */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {isRefOnly 
                ? "Ce mode crée les fiches manquantes et met à jour les tarifs d'achat/vente avec un stock de 0."
                : "Ajoutez ces fiches à votre file globale pour copier un autre onglet, ou importez-les directement."}
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={clearAll}
                className="h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 rounded-xl font-semibold text-xs font-sans cursor-pointer transition-colors"
              >
                Annuler
              </button>

              <button
                onClick={() => executeImport()}
                className={`h-10 text-white px-5 rounded-xl font-bold text-xs font-sans flex items-center gap-1.5 cursor-pointer shadow-md select-none transition-all active:scale-95 ${
                  isRefOnly ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <Check className="w-4 h-4" />
                {isRefOnly 
                  ? `Importer / Synchroniser les ${tabStats?.newCount || 0} fiches manquantes (Stock = 0)`
                  : "Importer directement le stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cumulative global queue */}
      {queueRows.length > 0 && !isImporting && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px] font-black font-mono">
                {queueRows.length}
              </div>
              <h4 className="text-xs font-sans font-black tracking-wide text-slate-900 uppercase">
                File d'attente cumulative ({queueRows.length} référence{queueRows.length > 1 ? 's' : ''})
              </h4>
            </div>
            <button
              onClick={() => setQueueRows([])}
              className="text-[10px] text-rose-600 hover:text-rose-700 font-mono font-bold flex items-center gap-1 cursor-pointer select-none"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider la file
            </button>
          </div>

          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            Vous avez accumulé des lignes provenant de différents onglets Excel. Vous pouvez copier-coller d'autres onglets ci-dessus pour compléter votre liste, puis cliquer sur le bouton ci-dessous pour tout charger d'un coup !
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[150px] overflow-y-auto bg-white shadow-sm">
            <table className="w-full text-[10px] font-mono border-collapse divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-150 sticky top-0 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-1.5 text-left">Nom du vin</th>
                  <th className="px-3 py-1.5 text-center w-12">Année</th>
                  <th className="px-3 py-1.5 text-center w-12">Qté</th>
                  <th className="px-3 py-1.5 text-left">Destination</th>
                  <th className="px-3 py-1.5 text-left w-16">Empl.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {enrichedQueueRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-1 truncate max-w-[200px]" title={row.name}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 block truncate max-w-[130px]">{row.name}</span>
                        {row.importStatus === 'new' ? (
                          <span className="px-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Nouveau</span>
                        ) : row.importStatus === 'different' ? (
                          <span className="px-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Modifié</span>
                        ) : (
                          <span className="px-1 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Identique</span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block truncate">{row.domain}</span>
                    </td>
                    <td className="px-3 py-1 text-center font-bold text-slate-700">{row.vintage}</td>
                    <td className="px-3 py-1 text-center font-black text-slate-800">{row.quantity}</td>
                    <td className="px-3 py-1 text-slate-500 text-[9px] truncate max-w-[120px]">{row.siteName || 'Site principal'}</td>
                    <td className="px-3 py-1 text-slate-400 text-[9px]">{row.bin || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => executeImport(queueRows)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-2 cursor-pointer shadow-md select-none transition-all active:scale-95"
            >
              <Database className="w-4 h-4" />
              Lancer l'importation de TOUTE la file ({queueRows.length} vins)
            </button>
          </div>
        </div>
      )}

      {/* Cumulative global queue */}
      {queueRows.length > 0 && !isImporting && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px] font-black font-mono">
                {queueRows.length}
              </div>
              <h4 className="text-xs font-sans font-black tracking-wide text-slate-900 uppercase">
                File d'attente cumulative ({queueRows.length} référence{queueRows.length > 1 ? 's' : ''})
              </h4>
            </div>
            <button
              onClick={() => setQueueRows([])}
              className="text-[10px] text-rose-600 hover:text-rose-700 font-mono font-bold flex items-center gap-1 cursor-pointer select-none"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider la file
            </button>
          </div>

          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            Vous avez accumulé des lignes provenant de différents onglets Excel. Vous pouvez copier-coller d'autres onglets ci-dessus pour compléter votre liste, puis cliquer sur le bouton ci-dessous pour tout charger d'un coup !
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[150px] overflow-y-auto bg-white shadow-sm">
            <table className="w-full text-[10px] font-mono border-collapse divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-150 sticky top-0 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-1.5 text-left">Nom du vin</th>
                  <th className="px-3 py-1.5 text-center w-12">Année</th>
                  <th className="px-3 py-1.5 text-center w-12">Qté</th>
                  <th className="px-3 py-1.5 text-left">Destination</th>
                  <th className="px-3 py-1.5 text-left w-16">Empl.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {enrichedQueueRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-1 truncate max-w-[200px]" title={row.name}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 block truncate max-w-[130px]">{row.name}</span>
                        {row.importStatus === 'new' ? (
                          <span className="px-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Nouveau</span>
                        ) : row.importStatus === 'different' ? (
                          <span className="px-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Modifié</span>
                        ) : (
                          <span className="px-1 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[7px] font-bold uppercase tracking-wider scale-90 origin-left">Identique</span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block truncate">{row.domain}</span>
                    </td>
                    <td className="px-3 py-1 text-center font-bold text-slate-700">{row.vintage}</td>
                    <td className="px-3 py-1 text-center font-black text-slate-800">{row.quantity}</td>
                    <td className="px-3 py-1 text-slate-500 text-[9px] truncate max-w-[120px]">{row.siteName || 'Site principal'}</td>
                    <td className="px-3 py-1 text-slate-400 text-[9px]">{row.bin || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => executeImport(queueRows)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-2 cursor-pointer shadow-md select-none transition-all active:scale-95"
            >
              <Database className="w-4 h-4" />
              Lancer l'importation de TOUTE la file ({queueRows.length} vins)
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
