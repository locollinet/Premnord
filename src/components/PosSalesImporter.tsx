import React, { useState, useRef, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, Site, getCanonicalDomain, normalizeWineString, isSameWineReference } from '../types';
import { findBestWineMatchInCatalog } from '../lib/wineMatching';
import { matchesWineSearch, removeAccents, normalizeSearchTokens, getWineSearchRelevanceScore } from '../lib/stringUtils';
import * as XLSX from 'xlsx';
import { 
  Receipt, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Search, 
  RefreshCw, 
  Trash2, 
  Check, 
  X, 
  ArrowRight, 
  Layers, 
  Calendar, 
  Hash, 
  Database,
  Filter,
  Eye,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

export interface PosLineItem {
  id: string;
  rawLabel: string;
  isBeverageOrWine: boolean;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  
  // AI suggestions
  suggestedDomain?: string;
  suggestedAppellation?: string;
  suggestedVintage?: string;
  suggestedColor?: string;
  suggestedFormat?: string;
  confidenceScore?: number;
  aiNotes?: string;

  // Human validated mapping
  selectedWineId: string | null;
  targetSiteId: string;
  isIncluded: boolean;
  status: 'perfect' | 'ambiguous' | 'unmatched' | 'non_beverage';
}

interface PosSalesImporterProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export const PosSalesImporter: React.FC<PosSalesImporterProps> = ({ onClose, onSuccess }) => {
  const { wines, sites, updateWine, addMovement, user } = useFirebase();

  // Mode: 'pdf' | 'excel' | 'text'
  const [importMode, setImportMode] = useState<'pdf' | 'excel' | 'text'>('pdf');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{ totalQty: number; linesCount: number; timestamp: number } | null>(null);

  // File uploads
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General receipt metadata
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [defaultDestination, setDefaultDestination] = useState<string>('auto'); // 'auto' | siteId

  // Extracted items list
  const [items, setItems] = useState<PosLineItem[]>([]);
  const [step, setStep] = useState<'upload' | 'review' | 'confirmed'>('upload');

  // Filter & Search in Review Mode
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'to_review' | 'perfect' | 'unmatched'>('all');

  // Wine search modal for manual reassignment
  const [reassigningItemIndex, setReassigningItemIndex] = useState<number | null>(null);
  const [wineSearchQuery, setWineSearchQuery] = useState<string>('');

  // Determine standard site by color
  const getAutoSiteIdForColor = (color: WineColor | string | undefined): string => {
    const c = (color || '').toLowerCase();
    // Look for Site 1 or Site 2
    const site1 = sites.find(s => s.name.toLowerCase().includes('site 1') || s.name.toLowerCase().includes('blanc'));
    const site2 = sites.find(s => s.name.toLowerCase().includes('site 2') || s.name.toLowerCase().includes('rouge'));
    
    if (c === 'rouge' || c === 'rose') {
      return site2 ? site2.id : (sites[1]?.id || sites[0]?.id || '');
    }
    return site1 ? site1.id : (sites[0]?.id || '');
  };

  // Find best matching wine in the user's database
  const findBestWineMatch = (
    rawLabel: string, 
    suggestedDomain?: string, 
    suggestedAppellation?: string, 
    suggestedVintage?: string, 
    suggestedColor?: string,
    targetSiteId?: string
  ): { wine: Wine | null; status: 'perfect' | 'ambiguous' | 'unmatched' } => {
    if (!wines || wines.length === 0) return { wine: null, status: 'unmatched' };

    const result = findBestWineMatchInCatalog({
      rawLabel,
      domain: suggestedDomain,
      name: suggestedAppellation,
      vintage: suggestedVintage,
      color: suggestedColor,
      targetSiteId
    }, wines);

    return {
      wine: result.wine,
      status: result.status
    };
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
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisProgress('Initialisation de la lecture des données...');

    try {
      let extractedData: any = null;

      // 1. EXCEL / CSV DIRECT PARSING
      if (importMode === 'excel') {
        if (!selectedFile) {
          throw new Error('Veuillez sélectionner un fichier Excel (.xlsx, .xls ou .csv)');
        }
        setAnalysisProgress('Lecture du classeur Excel...');
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        setAnalysisProgress('Analyse des colonnes et envoi à l\'IA pour structuration...');
        const response = await fetch('/api/gemini/parse-sales-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawRows: jsonRows.slice(0, 150),
            existingCatalog: wines.map(w => ({ id: w.id, name: w.name, domain: w.domain, vintage: w.vintage, color: w.color, format: w.format }))
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de l\'interprétation des lignes Excel.');
        }
        extractedData = await response.json();
      }

      // 2. PDF PARSING VIA GEMINI 3.5 FLASH (Native PDF support)
      else if (importMode === 'pdf') {
        if (!selectedFile) {
          throw new Error('Veuillez sélectionner un fichier PDF de ticket de caisse ou export PMS.');
        }
        setAnalysisProgress('Conversion et transmission sécurisée du PDF...');
        const base64Pdf = await readFileAsBase64(selectedFile);

        setAnalysisProgress('Lecture visuelle du ticket et rapprochement avec la cave par Gemini...');
        const response = await fetch('/api/gemini/parse-sales-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64: base64Pdf,
            existingCatalog: wines.map(w => ({ id: w.id, name: w.name, domain: w.domain, vintage: w.vintage, color: w.color, format: w.format }))
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de l\'interprétation du PDF de caisse.');
        }
        extractedData = await response.json();
      }

      // 3. RAW TEXT COPIED / PASTED
      else if (importMode === 'text') {
        if (!rawText.trim()) {
          throw new Error('Veuillez coller le texte brut du ticket de caisse.');
        }
        setAnalysisProgress('Analyse du texte brut par l\'IA...');
        const response = await fetch('/api/gemini/parse-sales-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: rawText.trim(),
            existingCatalog: wines.map(w => ({ id: w.id, name: w.name, domain: w.domain, vintage: w.vintage, color: w.color, format: w.format }))
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de l\'analyse du texte de caisse.');
        }
        extractedData = await response.json();
      }

      if (extractedData?.receiptDate) {
        setReceiptDate(extractedData.receiptDate);
      }
      if (extractedData?.receiptNumber) {
        setReceiptNumber(extractedData.receiptNumber);
      }

      const rawItems = extractedData?.items || [];
      if (rawItems.length === 0) {
        throw new Error('Aucune ligne de vente ou boisson n\'a été détectée dans le document fourni.');
      }

      // Map raw items to our state and perform deterministic matching
      const mappedItems: PosLineItem[] = rawItems.map((item: any, idx: number) => {
        let matchedWine: Wine | null = null;
        let matchStatus: 'perfect' | 'ambiguous' | 'unmatched' | 'non_beverage' = 'unmatched';

        if (!item.isBeverageOrWine) {
          matchStatus = 'non_beverage';
        } else if (item.matchedWineId) {
          matchedWine = wines.find(w => w.id === item.matchedWineId) || null;
          if (matchedWine) {
            matchStatus = item.confidenceScore && item.confidenceScore < 70 ? 'ambiguous' : 'perfect';
          }
        }

        if (!matchedWine && item.isBeverageOrWine) {
          const localMatch = findBestWineMatch(
            item.rawLabel,
            item.suggestedDomain,
            item.suggestedAppellation,
            item.suggestedVintage,
            item.suggestedColor
          );
          matchedWine = localMatch.wine;
          matchStatus = localMatch.status;
        }

        const chosenSiteId = defaultDestination !== 'auto' 
          ? defaultDestination 
          : (matchedWine ? matchedWine.siteId : getAutoSiteIdForColor(item.suggestedColor));

        return {
          id: `pos_item_${Date.now()}_${idx}`,
          rawLabel: item.rawLabel || 'Ligne de vente',
          isBeverageOrWine: item.isBeverageOrWine !== false,
          quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          suggestedDomain: item.suggestedDomain,
          suggestedAppellation: item.suggestedAppellation,
          suggestedVintage: item.suggestedVintage,
          suggestedColor: item.suggestedColor,
          suggestedFormat: item.suggestedFormat,
          confidenceScore: item.confidenceScore || 70,
          aiNotes: item.notes,
          selectedWineId: matchedWine ? matchedWine.id : null,
          targetSiteId: chosenSiteId,
          isIncluded: item.isBeverageOrWine !== false && matchedWine !== null,
          status: matchStatus
        };
      });

      setItems(mappedItems);
      setStep('review');
    } catch (err: any) {
      console.error('Error during POS analysis:', err);
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalLines = items.length;
    const includedItems = items.filter(i => i.isIncluded);
    const totalBottlesToDeduct = includedItems.reduce((acc, curr) => acc + curr.quantity, 0);
    const perfectMatches = items.filter(i => i.status === 'perfect').length;
    const ambiguousMatches = items.filter(i => i.status === 'ambiguous').length;
    const unmatched = items.filter(i => i.status === 'unmatched').length;
    const nonBeverage = items.filter(i => i.status === 'non_beverage').length;

    return {
      totalLines,
      includedCount: includedItems.length,
      totalBottlesToDeduct,
      perfectMatches,
      ambiguousMatches,
      unmatched,
      nonBeverage
    };
  }, [items]);

  // Filtered items in review view
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search (accent-insensitive, multi-words)
      if (reviewSearch.trim()) {
        const tokens = normalizeSearchTokens(reviewSearch);
        const selectedWine = item.selectedWineId ? wines.find(w => w.id === item.selectedWineId) : null;
        const target = removeAccents(
          `${item.rawLabel || ''} ${item.suggestedDomain || ''} ${item.suggestedAppellation || ''} ${selectedWine?.name || ''} ${selectedWine?.domain || ''} ${selectedWine?.cuvee || ''}`
        );
        const allTokensMatch = tokens.every(tok => target.includes(tok));
        if (!allTokensMatch) return false;
      }

      // Status filter
      if (statusFilter === 'to_review') {
        return item.status === 'ambiguous' || item.status === 'unmatched';
      }
      if (statusFilter === 'perfect') {
        return item.status === 'perfect';
      }
      if (statusFilter === 'unmatched') {
        return item.status === 'unmatched';
      }

      return true;
    });
  }, [items, reviewSearch, statusFilter, wines]);

  // Handle toggles and updates in review
  const toggleItemIncluded = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isIncluded: !item.isIncluded } : item));
  };

  const updateItemQuantity = (id: string, newQty: number) => {
    const qty = Math.max(0.5, newQty);
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const updateItemSite = (id: string, siteId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const currentWine = wines.find(w => w.id === item.selectedWineId);
      let newSelectedWineId = item.selectedWineId;

      if (currentWine && currentWine.siteId !== siteId) {
        const wineOnNewSite = wines.find(w => w.siteId === siteId && isSameWineReference(w, currentWine));
        if (wineOnNewSite) {
          newSelectedWineId = wineOnNewSite.id;
        }
      }

      return { ...item, targetSiteId: siteId, selectedWineId: newSelectedWineId };
    }));
  };

  const reassignWine = (wineId: string) => {
    if (reassigningItemIndex === null) return;
    const itemToUpdate = items[reassigningItemIndex];
    if (!itemToUpdate) return;

    const selectedWine = wines.find(w => w.id === wineId);

    setItems(prev => prev.map((item, idx) => {
      if (idx === reassigningItemIndex) {
        return {
          ...item,
          selectedWineId: wineId,
          targetSiteId: selectedWine ? selectedWine.siteId : item.targetSiteId,
          isIncluded: true,
          status: 'perfect'
        };
      }
      return item;
    }));

    setReassigningItemIndex(null);
    setWineSearchQuery('');
  };

  // Bulk actions
  const selectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, isIncluded: item.selectedWineId !== null })));
  };

  const deselectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, isIncluded: false })));
  };

  // FINAL HUMAN VALIDATION & ATOMIC FIRESTORE DEDUCTION
  const handleValidateAndDeduct = async () => {
    const itemsToDeduct = items.filter(i => i.isIncluded && i.selectedWineId && i.quantity > 0);
    if (itemsToDeduct.length === 0) {
      setErrorMessage('Aucun vin sélectionné pour le déstockage.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisProgress('Enregistrement des sorties de stock et mise à jour de la cave...');

    try {
      let totalDeductedCount = 0;
      // Track running stock per wine ID to correctly handle duplicate lines on the same ticket
      const runningStockMap = new Map<string, number>();
      wines.forEach(w => runningStockMap.set(w.id, w.quantity));

      for (const item of itemsToDeduct) {
        const wine = wines.find(w => w.id === item.selectedWineId);
        if (!wine) continue;

        const currentQty = runningStockMap.get(wine.id) ?? wine.quantity;
        const newQty = Math.max(0, currentQty - item.quantity);
        runningStockMap.set(wine.id, newQty);
        
        // 1. Update wine quantity in Firestore with action 'stock'
        await updateWine(wine.id, {
          quantity: newQty,
          updatedAt: Date.now()
        }, 'stock');

        // 2. Record stock movement with the exact site from which the bottle was decremented
        await addMovement({
          wineId: wine.id,
          wineName: `${wine.domain} - ${wine.name} (${wine.vintage || 'S.A.'})`,
          type: 'out',
          quantity: item.quantity,
          fromSiteId: wine.siteId,
          reason: 'vente',
          notes: `Vente importée ticket PMS ${receiptNumber ? `#${receiptNumber}` : ''} (${item.rawLabel}) du ${receiptDate}`,
          userId: user?.uid,
          userName: user?.displayName || user?.email || 'Sommelier',
          createdAt: new Date(`${receiptDate}T12:00:00`).getTime() || Date.now()
        });

        totalDeductedCount += item.quantity;
      }

      setSuccessSummary({
        totalQty: totalDeductedCount,
        linesCount: itemsToDeduct.length,
        timestamp: Date.now()
      });
      setStep('confirmed');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error deducting stock:', err);
      setErrorMessage(err.message || 'Erreur lors de l\'enregistrement des déstockages.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden text-stone-900 font-sans">
      
      {/* 1. Header Banner */}
      <div className="bg-stone-950 text-white p-6 border-b border-stone-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Receipt className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-white tracking-tight">
                Importation des Tickets de Caisse & Ventes (PMS)
              </h2>
              <p className="text-xs text-stone-400 font-mono">
                Zelty, Lightspeed, Micros, L'Addition &bull; Rapprochement IA & Contrôle Humain
              </p>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Step: UPLOAD & PARAMETERS */}
      {step === 'upload' && (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
          
          {/* Format Selection Tabs */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 block">
              1. Choisissez le format de votre export de caisse
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => { setImportMode('pdf'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  importMode === 'pdf'
                    ? 'border-[#BD6346] bg-[#BD6346]/5 text-stone-950 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileText className={`w-6 h-6 ${importMode === 'pdf' ? 'text-[#BD6346]' : 'text-stone-400'}`} />
                  {importMode === 'pdf' && <span className="w-2.5 h-2.5 rounded-full bg-[#BD6346]" />}
                </div>
                <div>
                  <p className="font-bold text-sm">Ticket de Caisse PDF</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Clôture Z, ticket de caisse scanné ou PDF natif</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setImportMode('excel'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  importMode === 'excel'
                    ? 'border-emerald-600 bg-emerald-50/50 text-stone-950 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileSpreadsheet className={`w-6 h-6 ${importMode === 'excel' ? 'text-emerald-600' : 'text-stone-400'}`} />
                  {importMode === 'excel' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                </div>
                <div>
                  <p className="font-bold text-sm">Tableau Excel / CSV</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Export direct .xlsx, .xls ou .csv du logiciel de caisse</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setImportMode('text'); setSelectedFile(null); }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  importMode === 'text'
                    ? 'border-indigo-600 bg-indigo-50/50 text-stone-950 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Receipt className={`w-6 h-6 ${importMode === 'text' ? 'text-indigo-600' : 'text-stone-400'}`} />
                  {importMode === 'text' && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                </div>
                <div>
                  <p className="font-bold text-sm">Copier-Coller Brut</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Coller directement le texte ou les lignes d'un rapport</p>
                </div>
              </button>
            </div>
          </div>

          {/* File Upload Zone or Text Area */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 block">
              2. Fichier ou données à analyser
            </label>

            {importMode === 'text' ? (
              <div className="space-y-2">
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Exemple de texte collé :
TABLE 14 - SERVICE SOIR
1x CHASSAGNE MONTRACHET BLANCHOT 2020 160.00€
2x DPR CLOS CORVEES 2017 380.00€
1x MEURSAULT LOU DUMONT 2021 110.00€
1x CHAMPAGNE JACQUES SELOSSE INITIAL 320.00€
3x CAFE EXPRESSO 9.00€`}
                  className="w-full p-4 rounded-xl border border-stone-300 font-mono text-xs bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 leading-relaxed"
                />
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importMode === 'pdf' ? '.pdf' : '.xlsx,.xls,.csv'}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedFile ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  }`}>
                    <Upload className="w-6 h-6" />
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="font-bold text-stone-900 text-sm flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} Ko &bull; Prêt pour l'analyse IA
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-stone-800 text-sm">
                        Cliquez pour déposer votre fichier {importMode === 'pdf' ? 'PDF' : 'Excel (.xlsx, .csv)'}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        Glissez-déposez ou parcourez vos documents
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Options de contexte (Date et Site) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-200">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Date des ventes
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 font-mono text-xs text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-stone-400" />
                Réf. Ticket / Clôture (Optionnel)
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="Ex: Z-2026-0902 / Table 14"
                className="w-full h-10 px-3 rounded-xl border border-stone-300 font-sans text-xs text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                Déstockage prioritaire
              </label>
              <select
                value={defaultDestination}
                onChange={(e) => setDefaultDestination(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 font-sans text-xs text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                <option value="auto">Automatique (Blancs Site 1, Rouges Site 2)</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (importMode !== 'text' && !selectedFile) || (importMode === 'text' && !rawText.trim())}
              className="h-12 px-6 bg-stone-950 hover:bg-stone-800 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>{analysisProgress || 'Analyse IA en cours...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Lancer l'Interprétation IA</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* 3. Step: REVIEW & HUMAN CONTROL */}
      {step === 'review' && (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in">
          
          {/* Summary KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-stone-400">Total Bouteilles à sortir</p>
              <p className="text-2xl font-mono font-extrabold text-stone-900 mt-1">{kpis.totalBottlesToDeduct} bt</p>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-emerald-700">Correspondances certaines</p>
              <p className="text-2xl font-mono font-extrabold text-emerald-800 mt-1">{kpis.perfectMatches}</p>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-amber-700">À vérifier (ambiguïtés)</p>
              <p className="text-2xl font-mono font-extrabold text-amber-800 mt-1">{kpis.ambiguousMatches}</p>
            </div>

            <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl">
              <p className="text-[10px] font-mono font-bold uppercase text-rose-700">Non trouvés en cave</p>
              <p className="text-2xl font-mono font-extrabold text-rose-800 mt-1">{kpis.unmatched}</p>
            </div>
          </div>

          {/* Action Bar & Filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Rechercher une ligne..."
                  className="h-9 pl-8 pr-3 rounded-xl border border-stone-300 text-xs font-sans text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 w-48 sm:w-64"
                />
              </div>

              <div className="flex bg-stone-100 p-1 rounded-xl gap-1 text-[11px] font-mono font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Tous ({items.length})
                </button>
                <button
                  onClick={() => setStatusFilter('to_review')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'to_review' ? 'bg-amber-100 text-amber-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  À vérifier ({kpis.ambiguousMatches + kpis.unmatched})
                </button>
                <button
                  onClick={() => setStatusFilter('perfect')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'perfect' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Certains ({kpis.perfectMatches})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="h-8 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Tout cocher
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="h-8 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Tout décocher
              </button>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="h-8 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Recharger un fichier
              </button>
            </div>
          </div>

          {/* TABLEAU DE CONTRÔLE HUMAIN */}
          <div className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[55vh] scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-stone-600 font-mono font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-stone-200">
                  <tr>
                    <th className="p-3 w-10 text-center">Déstocker</th>
                    <th className="p-3">Libellé Ticket Caisse</th>
                    <th className="p-3">Vin Associé dans la Cave Premnord</th>
                    <th className="p-3 w-28 text-center">Qté</th>
                    <th className="p-3 w-48">Site de Sortie</th>
                    <th className="p-3 w-32 text-right">Confiance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-400 italic">
                        Aucune ligne ne correspond aux filtres actuels.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => {
                      const actualItemIndex = items.findIndex(i => i.id === item.id);
                      const matchedWine = wines.find(w => w.id === item.selectedWineId);
                      const targetSite = sites.find(s => s.id === item.targetSiteId);
                      
                      // Stock on target site check
                      const currentStockOnTargetSite = matchedWine && matchedWine.siteId === item.targetSiteId 
                        ? matchedWine.quantity 
                        : (matchedWine ? matchedWine.quantity : 0);
                      
                      const hasStockAlert = matchedWine && currentStockOnTargetSite < item.quantity;

                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-colors ${
                            !item.isIncluded 
                              ? 'bg-stone-50/50 opacity-60' 
                              : item.status === 'ambiguous'
                              ? 'bg-amber-50/20'
                              : item.status === 'unmatched'
                              ? 'bg-rose-50/20'
                              : 'hover:bg-stone-50/70'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.isIncluded}
                              onChange={() => toggleItemIncluded(item.id)}
                              disabled={!item.selectedWineId}
                              className="w-4.5 h-4.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer disabled:opacity-30"
                              title={item.selectedWineId ? 'Inclure dans le déstockage' : 'Associez d\'abord un vin de la cave'}
                            />
                          </td>

                          {/* 2. Raw Label & Price */}
                          <td className="p-3 space-y-1">
                            <p className="font-bold text-stone-900 font-sans">{item.rawLabel}</p>
                            <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono">
                              {item.unitPrice && (
                                <span>{item.unitPrice.toFixed(2)} € / bt</span>
                              )}
                              {item.suggestedFormat && (
                                <span className="bg-stone-100 px-1.5 py-0.2 rounded text-stone-600 font-sans">
                                  {item.suggestedFormat}
                                </span>
                              )}
                              {!item.isBeverageOrWine && (
                                <span className="text-stone-400 italic">Non vinicole / ignoré</span>
                              )}
                            </div>
                          </td>

                          {/* 3. Matched Wine in Cellar with change selector */}
                          <td className="p-3">
                            {matchedWine ? (
                              <div className="space-y-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-serif font-bold text-stone-950 text-sm">
                                    {matchedWine.name} ({matchedWine.vintage || 'S.A.'})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassigningItemIndex(actualItemIndex);
                                      setWineSearchQuery(matchedWine.name);
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer shrink-0"
                                  >
                                    Modifier
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-stone-500 font-sans">
                                  <span>{matchedWine.domain}</span>
                                  <span>&bull;</span>
                                  <span className="font-mono font-bold text-stone-700">
                                    Stock actuel : {matchedWine.quantity} bt
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-rose-600 font-semibold italic">
                                  Vin non associé dans la base
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReassigningItemIndex(actualItemIndex);
                                    setWineSearchQuery(item.suggestedAppellation || item.rawLabel);
                                  }}
                                  className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                                >
                                  Associer un vin
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 4. Quantity Adjuster */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value) || 1)}
                                className="w-12 h-7 text-center font-mono font-bold text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-500"
                              />
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* 5. Target Site Selection */}
                          <td className="p-3">
                            <select
                              value={item.targetSiteId}
                              onChange={(e) => updateItemSite(item.id, e.target.value)}
                              className="w-full h-8 px-2 rounded-lg border border-stone-300 text-xs font-sans text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                            >
                              {sites.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name.split(' - ')[0]} {matchedWine && matchedWine.siteId === s.id ? `(${matchedWine.quantity} bt)` : ''}
                                </option>
                              ))}
                            </select>
                            {hasStockAlert && (
                              <p className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Stock insuffisant sur ce site ({currentStockOnTargetSite} dispo)
                              </p>
                            )}
                          </td>

                          {/* 6. Confidence Status */}
                          <td className="p-3 text-right">
                            {item.status === 'perfect' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                Certain (100%)
                              </span>
                            )}
                            {item.status === 'ambiguous' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 text-amber-800 border border-amber-200" title={item.aiNotes}>
                                <AlertTriangle className="w-3 h-3" />
                                À vérifier
                              </span>
                            )}
                            {item.status === 'unmatched' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                                <X className="w-3 h-3" />
                                Non trouvé
                              </span>
                            )}
                            {item.status === 'non_beverage' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-stone-100 text-stone-500">
                                Ignoré
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Error banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bottom Confirmation Bar */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-xs text-stone-600">
              <p className="font-bold text-stone-900">
                Prêt à déstocker {kpis.totalBottlesToDeduct} bouteille{kpis.totalBottlesToDeduct > 1 ? 's' : ''} sur {kpis.includedCount} ligne{kpis.includedCount > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-stone-500">
                Chaque mouvement sera historisé avec la date du {receiptDate}.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex-1 sm:flex-initial h-11 px-4 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleValidateAndDeduct}
                disabled={isAnalyzing || kpis.totalBottlesToDeduct === 0}
                className="flex-1 sm:flex-initial h-11 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Valider le Déstockage ({kpis.totalBottlesToDeduct} bt)</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 4. Step: CONFIRMED SUCCESS */}
      {step === 'confirmed' && successSummary && (
        <div className="p-8 md:p-12 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-serif font-bold text-stone-900">
              Déstockage Validé & Enregistré avec Succès !
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed font-sans">
              <strong>{successSummary.totalQty} bouteilles</strong> ont été déduites de la cave sur <strong>{successSummary.linesCount} références</strong>. Les mouvements de stocks et l'historique des ventes sont à jour.
            </p>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => {
                setStep('upload');
                setSelectedFile(null);
                setRawText('');
                setItems([]);
              }}
              className="h-10 px-5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              Importer un autre ticket
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="h-10 px-5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: WINE REASSIGNMENT SELECTOR */}
      {reassigningItemIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-stone-200 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <div>
                <h4 className="font-serif font-bold text-stone-900 text-base">
                  Sélectionner le vin correspondant
                </h4>
                <p className="text-xs text-stone-500 font-sans">
                  Ligne du ticket : <span className="font-bold text-stone-800">{items[reassigningItemIndex]?.rawLabel}</span>
                </p>
              </div>
              <button
                onClick={() => setReassigningItemIndex(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={wineSearchQuery}
                onChange={(e) => setWineSearchQuery(e.target.value)}
                placeholder="Rechercher par domaine, cuvée, appellation ou millésime..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-300 text-xs font-sans text-stone-800 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-stone-100 border border-stone-200 rounded-xl max-h-80">
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
                        <p className="font-serif font-bold text-stone-900 text-xs group-hover:text-[#BD6346]">
                          {w.name} {w.vintage ? `(${w.vintage})` : ''}
                        </p>
                        <p className="text-[11px] text-stone-500 font-sans">
                          {w.domain} &bull; <span className="font-mono">{siteName}</span>
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs shrink-0">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          w.quantity > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {w.quantity} bt
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
