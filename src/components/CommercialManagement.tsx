import React, { useState, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, TechnicalSheet } from '../types';
import { matchesWineSearch } from '../lib/stringUtils';
import { PosSalesImporter } from './PosSalesImporter';
import { PurchaseInvoiceImporter } from './PurchaseInvoiceImporter';
import { 
  TrendingUp, 
  Coins, 
  FileText, 
  ShoppingBag, 
  CheckCircle, 
  Printer, 
  Download, 
  Search, 
  Plus, 
  Minus, 
  Info, 
  Layers, 
  ChevronRight, 
  Truck, 
  ClipboardList, 
  Clock, 
  Check, 
  SlidersHorizontal,
  Sparkles,
  Edit2,
  Receipt,
  FileSpreadsheet,
  X
} from 'lucide-react';

const COLOR_LABELS: Record<WineColor, string> = {
  rouge: 'Vin Rouge',
  blanc: 'Vin Blanc',
  rose: 'Vin Rosé',
  bulle: 'Champagne & Bulles',
  orange: 'Vin Orange',
  spiritueux: 'Spiritueux',
  cidre_biere: 'Bière / Cidre',
  soft: 'Soft & Sans Alcool',
  autre: 'Autre'
};

const COLOR_ACCENTS: Record<WineColor, { text: string; bg: string; border: string }> = {
  rouge: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-150' },
  blanc: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-150' },
  rose: { text: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-150' },
  bulle: { text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-150' },
  orange: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-150' },
  spiritueux: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-150' },
  cidre_biere: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-150' },
  soft: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-150' },
  autre: { text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-150' }
};

const PremiumFicheBottle: React.FC<{ color: WineColor }> = ({ color }) => {
  let bgLiquid = 'bg-red-800';
  let capColor = 'bg-red-950';
  
  if (color === 'blanc') {
    bgLiquid = 'bg-[#FAF2D8]';
    capColor = 'bg-amber-800';
  } else if (color === 'rose') {
    bgLiquid = 'bg-pink-300';
    capColor = 'bg-pink-700';
  } else if (color === 'bulle') {
    bgLiquid = 'bg-[#FEF08A]';
    capColor = 'bg-yellow-700';
  } else if (color === 'orange') {
    bgLiquid = 'bg-[#FDBA74]';
    capColor = 'bg-orange-800';
  } else if (color === 'spiritueux') {
    bgLiquid = 'bg-amber-700';
    capColor = 'bg-stone-800';
  }

  return (
    <div className="flex flex-col items-center py-10 px-4 bg-white border border-stone-200/40 rounded-2xl h-full shadow-inner relative overflow-hidden select-none min-h-[420px] justify-center">
      {/* Background elegant shadow glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-50/40 to-transparent pointer-events-none" />
      
      <div className="w-20 flex flex-col items-center relative z-10 filter drop-shadow-md">
        {/* Cap */}
        <div className={`w-4 h-8 ${capColor} rounded-t-sm border border-black/15 shadow-sm relative`}>
          <div className="absolute bottom-1.5 left-0 right-0 h-[1px] bg-yellow-400/40" />
        </div>
        {/* Neck */}
        <div className="w-5 h-16 border-x border-black/10 bg-stone-800/10 relative flex items-end">
          <div className={`w-full h-11 ${bgLiquid} opacity-95`} />
          <div className="absolute top-1.5 w-6 h-1 bg-black/10 rounded-full" />
        </div>
        {/* Shoulder */}
        <div className="w-15 h-9 overflow-hidden relative flex justify-center">
          <div className="absolute top-0 w-15 h-18 rounded-t-full border border-black/15 bg-stone-850/10 flex items-end">
            <div className={`w-full h-12 ${bgLiquid} opacity-95 rounded-t-full`} />
          </div>
        </div>
        {/* Body */}
        <div className="w-15 h-44 border-x border-b border-black/15 rounded-b-lg bg-stone-850/10 relative flex flex-col items-center justify-start pt-4 shadow-sm">
          <div className={`absolute inset-0 ${bgLiquid} opacity-95 rounded-b-md`} />
          {/* Shine line */}
          <div className="absolute left-1 top-0 bottom-0 w-1.5 bg-white/15 blur-[0.5px]" />
          <div className="absolute right-1 top-0 bottom-0 w-1 bg-black/10" />
          
          {/* Elegant paper label */}
          <div className="w-11 h-24 bg-[#FCFAF6] border border-stone-300 shadow-sm rounded-xs flex flex-col items-center justify-between py-2 px-1 text-center relative z-20">
            <div className="absolute inset-0.5 border border-stone-200/50 pointer-events-none" />
            <span className="text-[4px] uppercase tracking-widest text-stone-400 font-mono font-bold block leading-none">Domaine</span>
            <div className="w-4 h-[0.5px] bg-stone-300 my-0.5" />
            <span className="text-[6px] font-serif italic text-stone-800 font-bold leading-tight block truncate w-full px-0.5">Grand Vin</span>
            <div className="w-4 h-[0.5px] bg-stone-300 my-0.5" />
            <span className="text-[4px] font-mono font-bold text-red-800 leading-none block">Reserve</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrderItem {
  wineId: string;
  wineName: string;
  domain: string;
  vintage: string;
  qtyToOrder: number;
  priceBuy: number;
  siteId: string;
}

interface CommercialManagementProps {
  onNavigateToAccounting?: () => void;
}

export const CommercialManagement: React.FC<CommercialManagementProps> = ({ onNavigateToAccounting }) => {
  const { wines, sites, updateWine, addMovement, apply3TierPricingToAllWines } = useFirebase();

  // Local sub-tabs: 'valuation' | 'pos_sales' | 'purchase_invoices' | 'sheets' | 'orders'
  const [activeSubTab, setActiveSubTab] = useState<'valuation' | 'pos_sales' | 'purchase_invoices' | 'sheets' | 'orders'>('valuation');

  // --- STATE FOR SHEETS TAB ---
  const [sheetSearch, setSheetSearch] = useState('');
  const [selectedSheetWine, setSelectedSheetWine] = useState<Wine | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  // Extended Technical Sheet states (Domaine style)
  const [isEditingFullSheet, setIsEditingFullSheet] = useState(false);
  const [fullSheetForm, setFullSheetForm] = useState<TechnicalSheet>({});
  const [showTextImportPanel, setShowTextImportPanel] = useState(false);
  const [rawTextToExtract, setRawTextToExtract] = useState('');
  const [isExtractingText, setIsExtractingText] = useState(false);

  React.useEffect(() => {
    setIsEditingNotes(false);
    setIsEditingFullSheet(false);
    setGenerationError(null);
    setShowTextImportPanel(false);
    setRawTextToExtract('');
    if (selectedSheetWine) {
      setEditedNotes(selectedSheetWine.notes || '');
      setFullSheetForm(selectedSheetWine.technicalSheet || {
        aop: selectedSheetWine.appellation || selectedSheetWine.name || '',
        lieuDit: '',
        sol: '',
        cepage: '',
        ageVignes: '',
        rendement: '',
        densite: '',
        surface: '',
        culture: '',
        vinification: '',
        elevage: '',
        degustation: { oeil: '', nez: '', bouche: '' },
        service: { temperature: '', garde: '', accords: '' }
      });
    }
  }, [selectedSheetWine]);

  // --- STATE FOR ORDERS TAB ---
  const [orderCart, setOrderCart] = useState<OrderItem[]>([]);
  const [activeSupplierOrders, setActiveSupplierOrders] = useState<Record<string, { items: OrderItem[]; date: string; status: 'pending' | 'received' }>>({});
  const [orderQuantityInputs, setOrderQuantityInputs] = useState<Record<string, number>>({});
  const [receivedSuccessMsg, setReceivedSuccessMsg] = useState<string | null>(null);
  const [pricingRecalcMessage, setPricingRecalcMessage] = useState<string | null>(null);

  // --- VALUATION CALCULATIONS ---
  const valuationStats = useMemo(() => {
    let totalInvestedHT = 0;
    let totalTurnoverTTC = 0;

    const breakdownByColor = {} as Record<WineColor, { qty: number; cost: number; revenue: number }>;
    const breakdownBySite = {} as Record<string, { qty: number; cost: number; revenue: number }>;

    // Initialize maps
    Object.keys(COLOR_LABELS).forEach((c) => {
      breakdownByColor[c as WineColor] = { qty: 0, cost: 0, revenue: 0 };
    });
    sites.forEach((s) => {
      breakdownBySite[s.id] = { qty: 0, cost: 0, revenue: 0 };
    });

    wines.forEach((wine) => {
      const cost = (wine.priceBuy || 0) * wine.quantity;
      const revenue = (wine.priceSell || 0) * wine.quantity;

      totalInvestedHT += cost;
      totalTurnoverTTC += revenue;

      if (breakdownByColor[wine.color]) {
        breakdownByColor[wine.color].qty += wine.quantity;
        breakdownByColor[wine.color].cost += cost;
        breakdownByColor[wine.color].revenue += revenue;
      } else {
        breakdownByColor[wine.color] = { qty: wine.quantity, cost, revenue };
      }

      if (breakdownBySite[wine.siteId]) {
        breakdownBySite[wine.siteId].qty += wine.quantity;
        breakdownBySite[wine.siteId].cost += cost;
        breakdownBySite[wine.siteId].revenue += revenue;
      } else {
        breakdownBySite[wine.siteId] = { qty: wine.quantity, cost, revenue };
      }
    });

    const potentialMargin = totalTurnoverTTC - totalInvestedHT;
    const marginPercentage = totalTurnoverTTC ? (potentialMargin / totalTurnoverTTC) * 100 : 0;

    return {
      totalInvestedHT,
      totalTurnoverTTC,
      potentialMargin,
      marginPercentage,
      breakdownByColor,
      breakdownBySite
    };
  }, [wines, sites]);

  const handleGenerateTastingNotes = async () => {
    if (!selectedSheetWine) return;
    setIsGeneratingNotes(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/gemini/generate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wineName: selectedSheetWine.name,
          domain: selectedSheetWine.domain,
          vintage: selectedSheetWine.vintage,
          color: selectedSheetWine.color,
          region: selectedSheetWine.region
        })
      });
      let errorMsg = 'Une erreur est survenue lors de la communication avec le serveur Gemini.';
      if (!response.ok) {
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMsg = errorData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      const newNotes = data.text;
      await updateWine(selectedSheetWine.id, { notes: newNotes }, 'edit');
      setSelectedSheetWine(prev => prev ? { ...prev, notes: newNotes } : null);
      setEditedNotes(newNotes);
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Impossible de générer les notes de dégustation.');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedSheetWine) return;
    try {
      await updateWine(selectedSheetWine.id, { notes: editedNotes }, 'edit');
      setSelectedSheetWine(prev => prev ? { ...prev, notes: editedNotes } : null);
      setIsEditingNotes(false);
    } catch (err: any) {
      console.error(err);
      setGenerationError("Impossible d'enregistrer les notes.");
    }
  };

  const handleGenerateFullTechnicalSheet = async () => {
    if (!selectedSheetWine) return;
    setIsGeneratingNotes(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/gemini/generate-technical-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wineName: selectedSheetWine.appellation || selectedSheetWine.name || selectedSheetWine.domain || '',
          cuvee: selectedSheetWine.cuvee || '',
          domain: selectedSheetWine.domain,
          vintage: selectedSheetWine.vintage,
          color: selectedSheetWine.color,
          region: selectedSheetWine.region || ''
        })
      });

      let errorMsg = 'Une erreur est survenue lors de la communication avec le serveur.';
      if (!response.ok) {
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const sheet: TechnicalSheet = { ...data, hasGenerated: true };
      
      // Update in Firestore
      await updateWine(selectedSheetWine.id, { technicalSheet: sheet }, 'edit');
      
      // Update local state
      setSelectedSheetWine(prev => prev ? { ...prev, technicalSheet: sheet } : null);
      setFullSheetForm(sheet);
      
      // Also sync standard notes if available
      if (sheet.degustation?.bouche || sheet.degustation?.nez) {
        const generatedNotesText = `${sheet.degustation.oeil ? `Visuel : ${sheet.degustation.oeil}. ` : ''}${sheet.degustation.nez ? `Nez : ${sheet.degustation.nez}. ` : ''}${sheet.degustation.bouche ? `Bouche : ${sheet.degustation.bouche}. ` : ''}`;
        await updateWine(selectedSheetWine.id, { notes: generatedNotesText }, 'edit');
        setSelectedSheetWine(prev => prev ? { ...prev, notes: generatedNotesText } : null);
        setEditedNotes(generatedNotesText);
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Impossible de générer la fiche technique.");
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleExtractTechnicalSheetFromText = async () => {
    if (!selectedSheetWine || !rawTextToExtract.trim()) return;
    setIsExtractingText(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/gemini/extract-technical-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawTextToExtract
        })
      });

      let errorMsg = "Une erreur est survenue lors de l'analyse du texte.";
      if (!response.ok) {
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const sheet: TechnicalSheet = { ...data, hasGenerated: true };
      
      // Update in Firestore
      await updateWine(selectedSheetWine.id, { technicalSheet: sheet }, 'edit');
      
      // Update local state
      setSelectedSheetWine(prev => prev ? { ...prev, technicalSheet: sheet } : null);
      setFullSheetForm(sheet);
      setShowTextImportPanel(false);
      setRawTextToExtract('');

      // Also sync standard notes if available
      if (sheet.degustation?.bouche || sheet.degustation?.nez) {
        const generatedNotesText = `${sheet.degustation.oeil ? `Visuel : ${sheet.degustation.oeil}. ` : ''}${sheet.degustation.nez ? `Nez : ${sheet.degustation.nez}. ` : ''}${sheet.degustation.bouche ? `Bouche : ${sheet.degustation.bouche}. ` : ''}`;
        await updateWine(selectedSheetWine.id, { notes: generatedNotesText }, 'edit');
        setSelectedSheetWine(prev => prev ? { ...prev, notes: generatedNotesText } : null);
        setEditedNotes(generatedNotesText);
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Erreur d'extraction des caractéristiques.");
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleSaveFullTechnicalSheet = async () => {
    if (!selectedSheetWine) return;
    try {
      await updateWine(selectedSheetWine.id, { technicalSheet: fullSheetForm }, 'edit');
      setSelectedSheetWine(prev => prev ? { ...prev, technicalSheet: fullSheetForm } : null);
      setIsEditingFullSheet(false);
    } catch (err: any) {
      console.error(err);
      setGenerationError("Impossible d'enregistrer la fiche technique.");
    }
  };

  // --- EXPORT TO CSV FUNCTION ---
  const exportValuationCSV = () => {
    const headers = ['Nom', 'Domaine', 'Millésime', 'Catégorie', 'Site de stockage', 'Coordonnée (Bin)', 'Quantité en Stock', 'Prix Achat HT (€)', 'Valeur Achat Globale HT (€)', 'Prix Vente TTC (€)', 'Valeur Vente Globale TTC (€)', 'Marge Potentielle Globale (€)'];
    
    const rows = wines.map(w => {
      const site = sites.find(s => s.id === w.siteId);
      const siteName = site ? site.name.split(' - ')[0] : 'N/C';
      const buyPrice = w.priceBuy || 0;
      const sellPrice = w.priceSell || 0;
      const totalBuy = buyPrice * (w.quantity || 0);
      const totalSell = sellPrice * (w.quantity || 0);
      const margin = totalSell - totalBuy;

      const cleanName = (w.name || '').replace(/"/g, '""');
      const cleanDomain = (w.domain || '').replace(/"/g, '""');
      const cleanVintage = (w.vintage || '').toString().replace(/"/g, '""');
      const cleanColor = COLOR_LABELS[w.color] || w.color || 'N/C';
      const cleanBin = (w.bin || 'N/C').replace(/"/g, '""');

      return [
        `"${cleanName}"`,
        `"${cleanDomain}"`,
        `"${cleanVintage}"`,
        `"${cleanColor}"`,
        `"${siteName}"`,
        `"${cleanBin}"`,
        w.quantity || 0,
        buyPrice.toFixed(2),
        totalBuy.toFixed(2),
        sellPrice.toFixed(2),
        totalSell.toFixed(2),
        margin.toFixed(2)
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Premnord_Valorisation_Stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FILTERED WINES FOR SHEETS TAB ---
  const filteredSheetsWines = useMemo(() => {
    return wines.filter(w => matchesWineSearch(w, sheetSearch));
  }, [wines, sheetSearch]);

  // --- ORDER SUGGESTIONS (Wines with stock <= alertThreshold) ---
  const lowStockWines = useMemo(() => {
    return wines.filter(w => w.quantity <= w.alertThreshold);
  }, [wines]);

  const handleUpdateOrderInput = (wineId: string, value: number) => {
    setOrderQuantityInputs(prev => ({ ...prev, [wineId]: Math.max(1, value) }));
  };

  const addToCart = (wine: Wine) => {
    const qty = orderQuantityInputs[wine.id] || Math.max(6, wine.alertThreshold * 3);
    
    // Check if already in cart
    const exists = orderCart.some(item => item.wineId === wine.id);
    if (exists) {
      setOrderCart(prev => prev.map(item => item.wineId === wine.id ? { ...item, qtyToOrder: item.qtyToOrder + qty } : item));
    } else {
      setOrderCart(prev => [...prev, {
        wineId: wine.id,
        wineName: wine.name,
        domain: wine.domain,
        vintage: wine.vintage,
        qtyToOrder: qty,
        priceBuy: wine.priceBuy || 0,
        siteId: wine.siteId
      }]);
    }
  };

  const removeFromCart = (wineId: string) => {
    setOrderCart(prev => prev.filter(item => item.wineId !== wineId));
  };

  // Group active cart items by domain (Supplier) to trigger ordered status
  const cartGroupedBySupplier = useMemo(() => {
    const groups = {} as Record<string, OrderItem[]>;
    orderCart.forEach(item => {
      const supplier = (item.domain || '').trim() || 'Domaine Inconnu';
      if (!groups[supplier]) groups[supplier] = [];
      groups[supplier].push(item);
    });
    return groups;
  }, [orderCart]);

  const triggerOrder = (supplier: string, items: OrderItem[]) => {
    setActiveSupplierOrders(prev => ({
      ...prev,
      [supplier]: {
        items,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        status: 'pending'
      }
    }));
    // Remove these items from the cart
    setOrderCart(prev => prev.filter(item => item.domain !== supplier));
  };

  // Confirm receipt of active delivery & automatically add to Firestore live database with historic Movement
  const confirmReceipt = async (supplier: string) => {
    const orderDetails = activeSupplierOrders[supplier];
    if (!orderDetails) return;

    try {
      for (const item of orderDetails.items) {
        // Find existing wine record
        const wineRef = wines.find(w => w.id === item.wineId);
        if (wineRef) {
          const updatedQty = wineRef.quantity + item.qtyToOrder;
          
          // 1. Update in Firestore
          await updateWine(item.wineId, { quantity: updatedQty }, 'stock');

          // 2. Add delivery audit movement
          await addMovement({
            wineId: item.wineId,
            wineName: `${item.wineName} (${item.vintage})`,
            type: 'in',
            quantity: item.qtyToOrder,
            reason: 'livraison',
            notes: `Réception de commande automatisée via le Carnet de Commande (Domaine ${supplier}).`,
            toSiteId: item.siteId
          });
        }
      }

      setReceivedSuccessMsg(`Félicitations ! Les stocks des bouteilles commandées chez "${supplier}" ont été réintégrés avec succès dans vos sites respectifs.`);
      setActiveSupplierOrders(prev => {
        const copy = { ...prev };
        delete copy[supplier];
        return copy;
      });

      setTimeout(() => setReceivedSuccessMsg(null), 5000);
    } catch (e) {
      console.error("Error receiving order deliveries:", e);
      alert("Erreur lors de l'intégration de la livraison.");
    }
  };

  return (
    <div className="space-y-6 text-slate-800" id="commercial-view-root">
      
      {/* Header and Sub-tab selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans flex items-center gap-2">
            <Coins className="w-5.5 h-5.5 text-premnord-green-dark" />
            Valorisation & Carnet de Commande
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Analysez votre capital liquide, imprimez vos fiches sommeliers et gérez vos réapprovisionnements.
          </p>
        </div>

        {/* Action Buttons: Valuation export & Accounting Extraction */}
        <div className="flex items-center gap-2">
          {onNavigateToAccounting && (
            <button
              onClick={onNavigateToAccounting}
              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-[11px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-emerald-800 uppercase select-none"
              title="Ouvrir l'extraction comptable certifiée (Stocks début/fin de mois, Prix d'achat, Mouvements)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              Extraction Comptable (Excel)
            </button>
          )}

          {activeSubTab === 'valuation' && (
            <button
              onClick={exportValuationCSV}
              className="h-9 px-3 bg-premnord-dark hover:bg-slate-800 text-white font-mono font-bold text-[11px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-slate-900 uppercase"
              title="Exporter le livre de cave financiers au format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter CSV
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-full max-w-2xl">
        <button
          onClick={() => {
            setActiveSubTab('valuation');
            setSelectedSheetWine(null);
          }}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold font-sans transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'valuation'
              ? 'bg-white text-premnord-dark shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          Valorisation Stock
        </button>
        <button
          onClick={() => {
            setActiveSubTab('pos_sales');
            setSelectedSheetWine(null);
          }}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'pos_sales'
              ? 'bg-white text-stone-950 shadow-sm border border-stone-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50/50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-amber-600" />
          <span>Tickets Caisse (PMS)</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab('purchase_invoices');
            setSelectedSheetWine(null);
          }}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'purchase_invoices'
              ? 'bg-white text-stone-950 shadow-sm border border-stone-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50/50'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Factures d'Achat</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab('sheets');
            setSelectedSheetWine(null);
          }}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold font-sans transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'sheets'
              ? 'bg-white text-premnord-dark shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          Fiches Techniques
        </button>
        <button
          onClick={() => {
            setActiveSubTab('orders');
            setSelectedSheetWine(null);
          }}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold font-sans transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'orders'
              ? 'bg-white text-premnord-dark shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          Commandes ({lowStockWines.length})
        </button>
      </div>

      {/* Received success alert banner */}
      {receivedSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in" id="order-success-banner">
          <CheckCircle className="w-5.5 h-5.5 text-emerald-600 shrink-0 animate-bounce" />
          <p className="font-semibold">{receivedSuccessMsg}</p>
        </div>
      )}

      {/* --- SUB-TAB CONTENT 1: VALUATION --- */}
      {activeSubTab === 'valuation' && (
        <div className="space-y-6 animate-fade-in" id="valuation-sub-view">
          
          {/* Pricing Strategy Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-800 px-2.5 py-0.5 rounded-md">
                  Grille Tarifaire Activée
                </span>
                <span className="text-xs font-mono text-slate-400">4 Tranches</span>
              </div>
              <h3 className="text-sm font-bold font-sans text-slate-100">Coefficients Achat / Vente Appliqués (Arrondi à l'€ supérieur)</h3>
              <p className="text-xs text-slate-300 font-mono flex flex-wrap items-center gap-2 pt-1">
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">≤ 50€ : <strong className="text-emerald-400">2,7x</strong></span>
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">50€ - 100€ : <strong className="text-amber-400">2,5x</strong></span>
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">100€ - 200€ : <strong className="text-sky-400">2,2x</strong></span>
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">≥ 200€ : <strong className="text-purple-400">2,0x</strong></span>
                <span className="bg-amber-950/60 border border-amber-800/80 text-amber-300 px-2 py-0.5 rounded text-[11px] font-sans">
                  Arrondi à l'€ supérieur
                </span>
              </p>
            </div>

            <button
              onClick={async () => {
                const count = await apply3TierPricingToAllWines();
                const msg = count > 0 
                  ? `Succès ! ${count} prix de vente ont été ajustés selon la nouvelle grille tarifaire (x2 à partir de 200€).`
                  : `Toutes vos références respectent déjà la grille tarifaire.`;
                setPricingRecalcMessage(msg);
                setTimeout(() => setPricingRecalcMessage(null), 6000);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer shrink-0 self-stretch sm:self-auto text-center"
            >
              Recalculer les prix de vente
            </button>
          </div>

          {pricingRecalcMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{pricingRecalcMessage}</span>
              </div>
              <button 
                onClick={() => setPricingRecalcMessage(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Stat: Total Invested HT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Coins className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Capital Immo. (Achat HT)</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1.5">
                {valuationStats.totalInvestedHT.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Valeur cumulée prix d'achat HT</p>
            </div>

            {/* Stat: Projected Turnover TTC */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">C.A. Potentiel (Vente TTC)</p>
              <p className="text-xl font-bold font-mono text-premnord-green-dark mt-1.5">
                {valuationStats.totalTurnoverTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Ventes globales estimées TTC</p>
            </div>

            {/* Stat: Margin € */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Marge Brut Estimée</p>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-1.5">
                {valuationStats.potentialMargin.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Différence brute Vente - Achat</p>
            </div>

            {/* Stat: Margin % */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Taux de Marge Moyen</p>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1.5">
                {valuationStats.marginPercentage.toFixed(1)} %
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Marge moyenne sur prix public</p>
            </div>

          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Color/Category breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Valorisation par Catégorie
                </h3>
              </div>

              <div className="space-y-3.5">
                {(Object.entries(valuationStats.breakdownByColor) as [WineColor, { qty: number; cost: number; revenue: number }][]).map(([color, data]) => {
                  if (data.qty === 0) return null;
                  const pctCost = valuationStats.totalInvestedHT ? (data.cost / valuationStats.totalInvestedHT) * 100 : 0;
                  const accent = COLOR_ACCENTS[color as WineColor] || COLOR_ACCENTS.autre;
                  
                  return (
                    <div key={color} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${accent.bg} border ${accent.border}`} />
                          <span className="font-bold text-slate-800">{COLOR_LABELS[color as WineColor]}</span>
                          <span className="text-[10px] font-mono text-slate-400">({data.qty} bt)</span>
                        </div>
                        <div className="font-mono text-right">
                          <span className="font-bold text-slate-900">{data.cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € HT</span>
                          <span className="text-[10px] text-slate-400 block">Vente: {data.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${pctCost}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Site breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Valorisation par Site de Stockage
                </h3>
              </div>

              <div className="space-y-3.5">
                {(Object.entries(valuationStats.breakdownBySite) as [string, { qty: number; cost: number; revenue: number }][]).map(([siteId, data]) => {
                  if (data.qty === 0) return null;
                  const siteObj = sites.find(s => s.id === siteId);
                  const siteName = siteObj ? siteObj.name.split(' - ')[0] : 'N/C';
                  const pctCost = valuationStats.totalInvestedHT ? (data.cost / valuationStats.totalInvestedHT) * 100 : 0;

                  return (
                    <div key={siteId} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{siteName}</span>
                          <span className="text-[10px] font-mono text-slate-400 ml-1">({data.qty} bt)</span>
                        </div>
                        <div className="font-mono text-right">
                          <span className="font-bold text-slate-900">{data.cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € HT</span>
                          <span className="text-[10px] text-slate-400 block">Vente: {data.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${pctCost}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Ledger table card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                Livre de Cave Comptable des Valeurs
              </h3>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Données certifiées Firestore</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="p-3 font-semibold pl-4">Nom du Vin</th>
                    <th className="p-3 font-semibold">Millésime</th>
                    <th className="p-3 font-semibold">Catégorie</th>
                    <th className="p-3 font-semibold">Stock</th>
                    <th className="p-3 font-semibold text-right">P.A. HT</th>
                    <th className="p-3 font-semibold text-right">Valeur Achat HT</th>
                    <th className="p-3 font-semibold text-right">P.V. TTC</th>
                    <th className="p-3 font-semibold text-right">Marge Est.</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {wines.slice(0, 30).map((wine) => {
                    const totalBuy = (wine.priceBuy || 0) * wine.quantity;
                    const totalSell = (wine.priceSell || 0) * wine.quantity;
                    const margin = totalSell - totalBuy;
                    
                    return (
                      <tr key={wine.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-900 pl-4">
                          <p className="truncate max-w-[200px]">{wine.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[200px] font-sans">{wine.domain}</p>
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-600">{wine.vintage}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${COLOR_ACCENTS[wine.color]?.bg} ${COLOR_ACCENTS[wine.color]?.text}`}>
                            {wine.color === 'rouge' ? 'Rouge' : wine.color === 'blanc' ? 'Blanc' : wine.color === 'bulle' ? 'Bulles' : 'Autre'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold">{wine.quantity}</td>
                        <td className="p-3 font-mono text-right text-slate-500">{(wine.priceBuy || 0).toFixed(2)} €</td>
                        <td className="p-3 font-mono text-right text-slate-900 font-bold">{totalBuy.toFixed(2)} €</td>
                        <td className="p-3 font-mono text-right text-slate-500">{(wine.priceSell || 0).toFixed(2)} €</td>
                        <td className="p-3 font-mono text-right text-emerald-600 font-bold">{margin.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {wines.length > 30 && (
              <div className="p-3 text-center bg-slate-50 border-t border-slate-100 text-[10px] font-mono text-slate-400">
                Affichage des 30 premières fiches sur {wines.length} pour préserver les performances d'écran. Utilisez l'export CSV pour visualiser le livre complet.
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- SUB-TAB CONTENT: POS SALES IMPORT --- */}
      {activeSubTab === 'pos_sales' && (
        <div className="space-y-6 animate-fade-in" id="pos-sales-sub-view">
          <PosSalesImporter onSuccess={() => {}} />
        </div>
      )}

      {/* --- SUB-TAB CONTENT: PURCHASE INVOICES IMPORT --- */}
      {activeSubTab === 'purchase_invoices' && (
        <div className="space-y-6 animate-fade-in" id="purchase-invoices-sub-view">
          <PurchaseInvoiceImporter onSuccess={() => {}} />
        </div>
      )}

      {/* --- SUB-TAB CONTENT 2: FICHES TECHNIQUES --- */}
      {activeSubTab === 'sheets' && (
        <div className="space-y-6 animate-fade-in" id="sheets-sub-view">
          
          {selectedSheetWine ? (
            /* Selected Wine Technical Card Details Panel with elegant print form */
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* Tool Control panel - hidden during print */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-wrap gap-2.5 items-center justify-between shadow-sm print:hidden">
                <button
                  onClick={() => {
                    setSelectedSheetWine(null);
                    setIsEditingFullSheet(false);
                    setShowTextImportPanel(false);
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shadow-xs flex items-center gap-1.5 animate-fade-in"
                >
                  ← Retour au Catalogue
                </button>

                <div className="flex flex-wrap gap-2">
                  {/* Print Button */}
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer la Fiche
                  </button>

                  {/* Edit manually toggle */}
                  <button
                    onClick={() => {
                      if (isEditingFullSheet) {
                        setIsEditingFullSheet(false);
                      } else {
                        setIsEditingFullSheet(true);
                        setShowTextImportPanel(false);
                      }
                    }}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-4 h-4 text-stone-500" />
                    {isEditingFullSheet ? "Annuler l'édition" : "Modifier la Fiche"}
                  </button>

                  {/* Copy Paste Extractor Toggle */}
                  <button
                    onClick={() => {
                      setShowTextImportPanel(!showTextImportPanel);
                      setIsEditingFullSheet(false);
                    }}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Collez le texte brut de la fiche technique d'un vigneron et laissez Gemini l'analyser et l'extraire pour vous sans aucune hallucination !"
                  >
                    <Download className="w-4 h-4" />
                    Analyse Copier-Coller (IA)
                  </button>

                  {/* Fully Automated Generator */}
                  <button
                    onClick={handleGenerateFullTechnicalSheet}
                    disabled={isGeneratingNotes}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 disabled:bg-slate-50 text-red-700 disabled:opacity-50 border border-red-200 rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Générer de manière encyclopédique la fiche complète avec l'IA Gemini"
                  >
                    <Sparkles className={`w-4 h-4 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                    {isGeneratingNotes ? "Génération..." : "Générer (IA)"}
                  </button>
                </div>
              </div>

              {/* Copy-Paste Text Import & Analysis Panel */}
              {showTextImportPanel && (
                <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-4 print:hidden animate-fade-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider font-sans">
                        Extraction IA Zéro Hallucination par Copier-Coller
                      </h4>
                      <p className="text-[11px] text-amber-700 font-sans mt-0.5 leading-relaxed">
                        Copiez le texte brut de la fiche officielle reçue du vigneron ou présente sur son site internet (comme celle du Domaine Rougeot), puis collez-le ci-dessous. Gemini va rigoureusement extraire et remplir chaque champ technique avec 100% de fiabilité.
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowTextImportPanel(false)}
                      className="text-stone-400 hover:text-stone-700 font-bold font-mono text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={rawTextToExtract}
                      onChange={(e) => setRawTextToExtract(e.target.value)}
                      placeholder="Collez ici le texte brut de la fiche technique ou de la présentation du vin..."
                      className="w-full min-h-[160px] text-xs p-3.5 border border-amber-200/80 rounded-xl bg-white text-stone-800 outline-none focus:ring-1 focus:ring-amber-500 font-sans leading-relaxed shadow-inner"
                    />
                    
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRawTextToExtract('');
                          setShowTextImportPanel(false);
                        }}
                        className="px-3.5 py-1.5 text-xs text-stone-600 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl font-bold font-sans transition-colors cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleExtractTechnicalSheetFromText}
                        disabled={isExtractingText || !rawTextToExtract.trim()}
                        className="px-4 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 disabled:bg-stone-250 disabled:text-stone-450 rounded-xl font-bold font-sans transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        {isExtractingText ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 animate-spin" />
                            Analyse et Extraction en cours...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                            Lancer l'Extraction IA
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {generationError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-800 text-xs font-mono print:hidden">
                  {generationError}
                </div>
              )}

              {/* Content render toggle (EDIT FORM or VISUAL CARD) */}
              {isEditingFullSheet ? (
                /* Elegant Edit Form in card style */
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 print:hidden animate-fade-in">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                      Formulaire d'Édition Fiche Sommelier
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Modification des caractéristiques du vin</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
                    {/* Identité terroir */}
                    <div className="space-y-4 md:col-span-2">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-slate-100 pb-1 font-mono">
                        1. Identité Terroir & Vignes
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">AOP / Appellation d'Origine</label>
                      <input
                        type="text"
                        value={fullSheetForm.aop || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, aop: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Bourgogne Aligoté"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Lieu-dit / Climat / Parcelle</label>
                      <input
                        type="text"
                        value={fullSheetForm.lieuDit || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, lieuDit: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Les Plumes, village de Meursault"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Nature du Sol / Géologie</label>
                      <input
                        type="text"
                        value={fullSheetForm.sol || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, sol: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Argilo-calcaire"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Cépage(s)</label>
                      <input
                        type="text"
                        value={fullSheetForm.cepage || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, cepage: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Aligoté"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Âge moyen des vignes</label>
                      <input
                        type="text"
                        value={fullSheetForm.ageVignes || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, ageVignes: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 40 ans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Rendement de récolte</label>
                      <input
                        type="text"
                        value={fullSheetForm.rendement || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, rendement: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 55 hl/ha"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Densité de plantation</label>
                      <input
                        type="text"
                        value={fullSheetForm.densite || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, densite: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 10 000 pieds/ha"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Surface cultivée (hectares)</label>
                      <input
                        type="text"
                        value={fullSheetForm.surface || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, surface: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 0,60 ha"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Mode de culture</label>
                      <input
                        type="text"
                        value={fullSheetForm.culture || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, culture: e.target.value })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Biologique, biodynamie..."
                      />
                    </div>

                    {/* Vinification / Elevage */}
                    <div className="space-y-4 md:col-span-2 pt-2">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-slate-100 pb-1 font-mono">
                        2. Processus de Cave (Vinification & Élevage)
                      </h4>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Méthode de Vinification</label>
                      <textarea
                        value={fullSheetForm.vinification || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, vinification: e.target.value })}
                        className="w-full min-h-[90px] bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-red-500 font-sans leading-relaxed"
                        placeholder="Ex: Vendanges manuelles, pressurage direct..."
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Élevage (type & durée)</label>
                      <textarea
                        value={fullSheetForm.elevage || ''}
                        onChange={(e) => setFullSheetForm({ ...fullSheetForm, elevage: e.target.value })}
                        className="w-full min-h-[70px] bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-red-500 font-sans leading-relaxed"
                        placeholder="Ex: 14 mois en fût de 1 à 5 vins..."
                      />
                    </div>

                    {/* Profil de degustation */}
                    <div className="space-y-4 md:col-span-2 pt-2">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-slate-100 pb-1 font-mono">
                        3. Profil Sensoriel de Dégustation
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">L'Œil (robe, reflets)</label>
                      <input
                        type="text"
                        value={fullSheetForm.degustation?.oeil || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          degustation: { ...(fullSheetForm.degustation || {}), oeil: e.target.value } 
                        })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Robe or brillant..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Le Nez (arômes, bouquets)</label>
                      <input
                        type="text"
                        value={fullSheetForm.degustation?.nez || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          degustation: { ...(fullSheetForm.degustation || {}), nez: e.target.value } 
                        })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: Notes de fleurs blanches..."
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">La Bouche (attaque, volume, persistance)</label>
                      <textarea
                        value={fullSheetForm.degustation?.bouche || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          degustation: { ...(fullSheetForm.degustation || {}), bouche: e.target.value } 
                        })}
                        className="w-full min-h-[70px] bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-red-500 font-sans"
                        placeholder="Ex: Bouche saline et grasse..."
                      />
                    </div>

                    {/* Service & Accords */}
                    <div className="space-y-4 md:col-span-2 pt-2">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-slate-100 pb-1 font-mono">
                        4. Conseils de Service & Accords
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Température de Service</label>
                      <input
                        type="text"
                        value={fullSheetForm.service?.temperature || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          service: { ...(fullSheetForm.service || {}), temperature: e.target.value } 
                        })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 11 - 13°C"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Potentiel de Garde</label>
                      <input
                        type="text"
                        value={fullSheetForm.service?.garde || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          service: { ...(fullSheetForm.service || {}), garde: e.target.value } 
                        })}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:border-red-500"
                        placeholder="Ex: 5 à 10 ans"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Accords Mets-Vins Recommandés</label>
                      <textarea
                        value={fullSheetForm.service?.accords || ''}
                        onChange={(e) => setFullSheetForm({ 
                          ...fullSheetForm, 
                          service: { ...(fullSheetForm.service || {}), accords: e.target.value } 
                        })}
                        className="w-full min-h-[60px] bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-red-500 font-sans"
                        placeholder="Ex: Ris de veau aux morilles, turbot..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5">
                    <button
                      onClick={() => setIsEditingFullSheet(false)}
                      className="px-4 py-2 text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold font-sans transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveFullTechnicalSheet}
                      className="px-5 py-2 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-xl font-bold font-sans transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      Enregistrer les Modifications
                    </button>
                  </div>
                </div>
              ) : (
                /* The Sublime visual Technical Sheet (Domaine style, identical to images) */
                <div className="bg-[#FAF9F5] border border-stone-200 rounded-2xl p-6 sm:p-14 shadow-lg space-y-10 relative overflow-hidden" id="print-sheet-card">
                  
                  {/* Subtle paper watermark texture */}
                  <div className="absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15] pointer-events-none" />

                  {/* Elegant Fiche Design */}
                  <div className="space-y-8 text-stone-900">
                    
                    {/* Visual Header Ornament - Garamond Domain style */}
                    <div className="text-center space-y-2 border-b border-stone-200 pb-6 shrink-0">
                      <h1 className="text-3xl sm:text-4xl font-serif tracking-[0.18em] text-[#C4A47A] font-medium uppercase leading-tight">
                        {selectedSheetWine.domain}
                      </h1>
                      <h2 className="text-lg sm:text-2xl font-serif tracking-tight text-[#B09066] font-normal italic">
                        {fullSheetForm.aop || selectedSheetWine.name} {selectedSheetWine.vintage !== 'N.V.' ? `« ${selectedSheetWine.vintage} »` : ''}
                      </h2>
                    </div>

                    {/* Layout Body: Bottle on Left, Structured specs on Right */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-2 items-start">
                      
                      {/* Left: Bottle illustration */}
                      <div className="md:col-span-4 flex justify-center">
                        <PremiumFicheBottle color={selectedSheetWine.color} />
                      </div>

                      {/* Right: Detailed list of technical properties */}
                      <div className="md:col-span-8 space-y-5 font-serif text-stone-800">
                        <div className="space-y-4">
                          
                          {/* AOP */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">AOP :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.aop || selectedSheetWine.name}</span>
                          </div>

                          {/* Lieu-dit */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Lieu-dit :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.lieuDit || 'Non renseigné'}</span>
                          </div>

                          {/* Sol */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Sol :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.sol || 'Non renseigné'}</span>
                          </div>

                          {/* Cépage */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Cépage :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.cepage || 'Non renseigné'}</span>
                          </div>

                          {/* Âge des vignes */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Age moyen des vignes :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.ageVignes || 'Non renseigné'}</span>
                          </div>

                          {/* Rendement */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Rendement :</span>
                            <span className="text-sm sm:text-base text-stone-950 leading-snug">{fullSheetForm.rendement || 'Non renseigné'}</span>
                          </div>

                          {/* Densité */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Densité de plantation :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.densite || 'Non renseigné'}</span>
                          </div>

                          {/* Surface */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Surface :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.surface || 'Non renseigné'}</span>
                          </div>

                          {/* Culture */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 gap-1">
                            <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Mode de culture :</span>
                            <span className="text-sm sm:text-base text-stone-900 leading-snug">{fullSheetForm.culture || 'Non renseigné'}</span>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Full Vinification & Élevage block */}
                    <div className="space-y-6 pt-4 font-serif text-stone-800 leading-relaxed text-sm sm:text-base">
                      {fullSheetForm.vinification && (
                        <div className="space-y-1.5">
                          <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 block">Méthode de vinification :</span>
                          <p className="text-stone-900 text-justify whitespace-pre-line">{fullSheetForm.vinification}</p>
                        </div>
                      )}

                      {fullSheetForm.elevage && (
                        <div className="space-y-1.5 pt-2">
                          <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 block">Elevage :</span>
                          <p className="text-stone-900 text-justify whitespace-pre-line">{fullSheetForm.elevage}</p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-baseline border-b border-stone-200/50 pb-2 pt-2 gap-1">
                        <span className="font-bold uppercase tracking-wider text-[11px] font-sans text-stone-500 w-full sm:w-[190px] shrink-0">Mise en bouteilles :</span>
                        <span className="text-sm sm:text-base text-stone-900 leading-snug">Par nos soins à la propriété.</span>
                      </div>
                    </div>

                    {/* Sommelier Tasting notes (Oeil, Nez, Bouche) */}
                    {(fullSheetForm.degustation?.oeil || fullSheetForm.degustation?.nez || fullSheetForm.degustation?.bouche) && (
                      <div className="border-t border-stone-300 pt-6 space-y-4">
                        <h4 className="text-xs font-mono uppercase text-[#C4A47A] font-black tracking-widest text-center">
                          Conseils & Notes de Dégustation
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-stone-800 font-serif leading-relaxed text-xs sm:text-sm">
                          {fullSheetForm.degustation?.oeil && (
                            <div className="space-y-1">
                              <span className="font-bold uppercase tracking-widest text-[10px] font-sans text-[#B09066] block">L'Œil :</span>
                              <p className="italic text-stone-600">« {fullSheetForm.degustation.oeil} »</p>
                            </div>
                          )}

                          {fullSheetForm.degustation?.nez && (
                            <div className="space-y-1 border-t md:border-t-0 md:border-x border-stone-200/60 pt-3 md:pt-0 md:px-4">
                              <span className="font-bold uppercase tracking-widest text-[10px] font-sans text-[#B09066] block">Le Nez :</span>
                              <p className="italic text-stone-600">« {fullSheetForm.degustation.nez} »</p>
                            </div>
                          )}

                          {fullSheetForm.degustation?.bouche && (
                            <div className="space-y-1 border-t md:border-t-0 pt-3 md:pt-0">
                              <span className="font-bold uppercase tracking-widest text-[10px] font-sans text-[#B09066] block">La Bouche :</span>
                              <p className="italic text-stone-600">« {fullSheetForm.degustation.bouche} »</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sommelier Service & Accords block */}
                    {(fullSheetForm.service?.temperature || fullSheetForm.service?.garde || fullSheetForm.service?.accords) && (
                      <div className="border-t border-stone-200 pt-5 text-xs font-sans text-stone-600 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {fullSheetForm.service?.temperature && (
                          <div className="space-y-0.5">
                            <span className="font-bold uppercase tracking-wider text-[9px] text-stone-400 block">Température de Service :</span>
                            <span className="font-bold text-stone-800 text-sm">{fullSheetForm.service.temperature}</span>
                          </div>
                        )}

                        {fullSheetForm.service?.garde && (
                          <div className="space-y-0.5">
                            <span className="font-bold uppercase tracking-wider text-[9px] text-stone-400 block">Potentiel de Garde :</span>
                            <span className="font-bold text-stone-800 text-sm">{fullSheetForm.service.garde}</span>
                          </div>
                        )}

                        {fullSheetForm.service?.accords && (
                          <div className="space-y-0.5 sm:col-span-1">
                            <span className="font-bold uppercase tracking-wider text-[9px] text-stone-400 block">Accords Gastronomiques :</span>
                            <span className="text-stone-800 font-serif font-medium leading-relaxed block">{fullSheetForm.service.accords}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footnote stamp */}
                    <div className="border-t border-dashed border-stone-300 pt-6 text-center text-[10px] font-mono text-stone-400 shrink-0">
                      <p>Premnord Haute Restauration &bull; {selectedSheetWine.id}</p>
                      <p className="mt-1">L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</p>
                    </div>

                  </div>

                </div>
              )}

            </div>
          ) : (
            /* Search list of sheet wines to select */
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
                <p className="text-xs text-slate-500 font-sans">
                  Saisissez un nom de cuvée ou de domaine pour isoler une bouteille, puis ouvrez sa fiche technique officielle prête à être éditée ou imprimée pour votre clientèle.
                </p>
                
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer parmi les fiches de vins..."
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl pl-11 pr-4 text-slate-900 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              {/* Grid result */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSheetsWines.slice(0, 48).map((wine) => (
                  <div
                    key={wine.id}
                    onClick={() => setSelectedSheetWine(wine)}
                    className="bg-white border border-slate-200 hover:border-slate-300 p-4 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase border mb-2.5 inline-block ${COLOR_ACCENTS[wine.color]?.bg} ${COLOR_ACCENTS[wine.color]?.text}`}>
                        {COLOR_LABELS[wine.color]}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-1">{wine.name}</h4>
                      <p className="text-[11px] text-slate-400 italic font-medium mt-0.5">{wine.domain} • {wine.vintage}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4 text-[10px] font-mono text-slate-400">
                      <span>Case: {wine.bin || 'N/C'}</span>
                      <span className="text-red-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Ouvrir fiche <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}

                {filteredSheetsWines.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 font-mono text-xs bg-white border border-slate-200 rounded-2xl">
                    Aucun vin ne correspond à votre filtre.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* --- SUB-TAB CONTENT 3: CARNET DE COMMANDE --- */}
      {activeSubTab === 'orders' && (
        <div className="space-y-6 animate-fade-in" id="orders-sub-view">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Re-order suggestions (Low Stock Alerts) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <ClipboardList className="w-4 h-4 text-slate-400" />
                  Alertes de Réapprovisionnement Automatiques
                </h3>
                <p className="text-xs text-slate-500 font-sans leading-relaxed">
                  Ces fiches de vins ont atteint ou sont passées sous leur seuil critique d'alerte défini. Préparez vos volumes et cliquez sur l'icône de panier pour les planifier dans vos commandes en cours.
                </p>
              </div>

              <div className="space-y-3">
                {lowStockWines.map((wine) => {
                  const suggestedOrder = Math.max(6, wine.alertThreshold * 3);
                  const currentInputVal = orderQuantityInputs[wine.id] || suggestedOrder;
                  const isAlreadyInCart = orderCart.some(item => item.wineId === wine.id);

                  return (
                    <div 
                      key={wine.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-slate-300"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${COLOR_ACCENTS[wine.color]?.bg} ${COLOR_ACCENTS[wine.color]?.text}`}>
                            {wine.color === 'rouge' ? 'Rouge' : 'Blanc'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">Stock : {wine.quantity} / Seuil : {wine.alertThreshold}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{wine.name}</h4>
                        <p className="text-[11px] text-slate-500 italic font-medium">{wine.domain} • {wine.vintage}</p>
                      </div>

                      {/* Add controls */}
                      <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                          <button
                            onClick={() => handleUpdateOrderInput(wine.id, currentInputVal - 1)}
                            className="w-7 h-7 bg-white border border-slate-200/80 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={currentInputVal}
                            onChange={(e) => handleUpdateOrderInput(wine.id, parseInt(e.target.value) || 1)}
                            className="w-12 h-7 text-center font-mono font-bold text-xs bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="1"
                          />
                          <button
                            onClick={() => handleUpdateOrderInput(wine.id, currentInputVal + 1)}
                            className="w-7 h-7 bg-white border border-slate-200/80 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => addToCart(wine)}
                          disabled={isAlreadyInCart}
                          className={`h-9 px-3 rounded-xl font-mono font-bold text-[10px] uppercase tracking-wide flex items-center gap-1 cursor-pointer transition-colors ${
                            isAlreadyInCart
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                          }`}
                        >
                          {isAlreadyInCart ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Planifié
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Planifier
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {lowStockWines.length === 0 && (
                  <div className="py-12 text-center text-slate-400 font-mono text-xs bg-white border border-slate-200 rounded-2xl">
                    Parfait ! Aucun vin n'est en alerte de réapprovisionnement pour le moment.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Active cart prep and current pending delivery logs */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Draft orders prep card */}
              <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg border border-slate-850 space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4.5 h-4.5 text-premnord-gold" />
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">
                      Bon de Commande Brouillon
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black">
                    {orderCart.length} fiches
                  </span>
                </div>

                {orderCart.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono leading-relaxed py-4 text-center">
                    Votre brouillon est vide. Cliquez sur "Planifier" à gauche pour y ajouter des bouteilles à réapprovisionner.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-64 overflow-y-auto divide-y divide-white/5 pr-1 text-xs">
                      {orderCart.map((item) => (
                        <div key={item.wineId} className="py-2.5 flex justify-between items-center gap-2">
                          <div className="min-w-0 flex-grow">
                            <p className="font-bold text-white truncate">{item.wineName}</p>
                            <p className="text-[10px] text-slate-400 italic truncate">{item.domain} • {item.vintage}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-premnord-gold shrink-0 bg-white/5 px-2 py-0.5 rounded">
                              {item.qtyToOrder} bt
                            </span>
                            <button
                              onClick={() => removeFromCart(item.wineId)}
                              className="text-slate-400 hover:text-red-500 font-bold p-1 cursor-pointer transition-colors"
                              title="Retirer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Group triggers grouped by suppliers */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                        Générer par Domaine / Propriétaire :
                      </p>
                      
                      <div className="space-y-1.5">
                        {(Object.entries(cartGroupedBySupplier) as [string, OrderItem[]][]).map(([supplier, items]) => {
                          const totalQty = items.reduce((acc, it) => acc + it.qtyToOrder, 0);
                          return (
                            <button
                              key={supplier}
                              onClick={() => triggerOrder(supplier, items)}
                              className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-left px-3.5 flex items-center justify-between text-xs font-bold transition-colors cursor-pointer border border-slate-750"
                            >
                              <span className="truncate pr-2">Domaine : {supplier}</span>
                              <span className="font-mono text-premnord-gold shrink-0 flex items-center gap-1 uppercase text-[10px] font-bold">
                                {totalQty} bt &bull; Commander
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pending deliveries orders */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Truck className="w-4.5 h-4.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    Livraisons en Cours d'Acheminement
                  </h3>
                </div>

                {Object.keys(activeSupplierOrders).length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono py-4 text-center leading-relaxed">
                    Aucun camion n'est en transit. Vos commandes d'approvisionnement validées apparaîtront ici.
                  </p>
                ) : (
                  <div className="space-y-4 text-xs">
                    {(Object.entries(activeSupplierOrders) as [string, { items: OrderItem[]; date: string; status: 'pending' | 'received' }][]).map(([supplier, details]) => {
                      const totalQty = details.items.reduce((acc, it) => acc + it.qtyToOrder, 0);
                      
                      return (
                        <div 
                          key={supplier}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 font-sans">Domaine {supplier}</h4>
                              <p className="text-[9px] font-mono text-slate-400 mt-0.5">Émise le {details.date}</p>
                            </div>
                            <span className="bg-amber-100 text-amber-800 text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-spin" />
                              En transit
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-500 divide-y divide-slate-150 bg-white border border-slate-150 p-2.5 rounded-xl">
                            {details.items.map((it) => (
                              <div key={it.wineId} className="py-1 flex justify-between items-center">
                                <span className="truncate pr-2">{it.wineName} ({it.vintage})</span>
                                <span className="font-bold text-slate-900 shrink-0">{it.qtyToOrder} bt</span>
                              </div>
                            ))}
                          </div>

                          {/* Print PDF bon and Confirm receipt buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Simulate elegant printing of the Bon de commande text
                                const win = window.open("", "_blank");
                                if (win) {
                                  win.document.write(`
                                    <html>
                                      <head>
                                        <title>Bon de Commande - Domaine ${supplier}</title>
                                        <style>
                                          body { font-family: monospace; padding: 40px; color: #111; line-height: 1.6; }
                                          h1 { border-bottom: 2px solid #000; padding-bottom: 10px; }
                                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                                          th { bg-color: #f5f5f5; }
                                        </style>
                                      </head>
                                      <body>
                                        <h1>PREMNORD - BON DE COMMANDE OFFICIEL</h1>
                                        <p><strong>Fournisseur :</strong> Domaine ${supplier}</p>
                                        <p><strong>Date :</strong> ${details.date}</p>
                                        <p><strong>Destinataire :</strong> Restaurant Premnord, Sommelerie Générale</p>
                                        <table>
                                          <thead>
                                            <tr>
                                              <th>Article (Vin / Millésime)</th>
                                              <th>Quantité Demandée</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            ${details.items.map(it => `
                                              <tr>
                                                <td>${it.wineName} (${it.vintage})</td>
                                                <td><strong>${it.qtyToOrder} bouteilles</strong></td>
                                              </tr>
                                            `).join('')}
                                          </tbody>
                                        </table>
                                        <p style="margin-top: 40px; text-align: center; font-size: 11px; color: #555;">Document généré automatiquement par le Suivi App Premnord.</p>
                                        <script>window.print();</script>
                                      </body>
                                    </html>
                                  `);
                                  win.document.close();
                                }
                              }}
                              className="flex-1 h-9 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-xl font-mono text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              Imp. Bon
                            </button>

                            <button
                              onClick={() => confirmReceipt(supplier)}
                              className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-mono text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                            >
                              <Check className="w-3.5 h-3.5 text-white" />
                              Livraison Reçue
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
