import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine, WineColor, TechnicalSheet, isSameWineReference } from '../types';
import { calculateSellingPrice, getPricingCoefficient } from '../lib/pricing';
import { X, Save, ShieldAlert, Sparkles, Calculator, HelpCircle, ChevronDown, ChevronUp, Search, CheckCircle, Database, RefreshCw, AlertTriangle, Check, Layers, Trash2 } from 'lucide-react';

interface WineFormModalProps {
  wineToEdit?: Wine;
  isDuplicate?: boolean;
  defaultSiteId?: string;
  onClose: () => void;
  onCreated?: (newWineId: string) => void;
}

import { 
  getDynamicRegionGroups, 
  getSubRegionSuggestionsMap, 
  DEFAULT_WINE_REGIONS 
} from '../lib/regions';

export interface RegionGroup {
  group: string;
  regions: string[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    group: 'Vignobles de France',
    regions: [
      'Alsace', 'Auvergne', 'Beaujolais', 'Bordeaux', 'Bourgogne', 'Champagne', 
      'Corse', 'Jura', 'Languedoc-Roussillon', 'Loire', 'Provence', 
      'Rhône', 'Savoie', 'Sud-Ouest'
    ]
  },
  {
    group: 'Vignobles d\'Europe & Méditerranée',
    regions: [
      'Allemagne', 'Autriche', 'Danemark', 'Espagne', 'Géorgie', 
      'Grèce', 'Hongrie', 'Italie', 'Liban', 'Portugal', 'Slovénie', 'Suisse'
    ]
  },
  {
    group: 'Nouveau Monde & Autres Pays',
    regions: [
      'Afrique du Sud', 'Argentine', 'Australie', 'Nouvelle-Zélande', 
      'Chili', 'États-Unis', 'Japon', 'Autre'
    ]
  }
];

export const SUB_REGION_SUGGESTIONS: Record<string, string[]> = {
  'Auvergne': ['Côtes d\'Auvergne', 'Saint-Pourçain', 'Côte Roannaise', 'Côtes du Forez', 'Puy-de-Dôme', 'Chanturgue', 'Châteaugay', 'Corent', 'Boudes', 'Madargues'],
  'Bourgogne': ['Côte de Nuits', 'Côte de Beaune', 'Yonne / Chablisien', 'Côte Chalonnaise', 'Mâconnais', 'Hautes-Côtes de Beaune', 'Hautes-Côtes de Nuits'],
  'Bordeaux': ['Médoc', 'Pauillac', 'Margaux', 'Saint-Julien', 'Saint-Estèphe', 'Pomerol', 'Saint-Émilion', 'Graves & Pessac-Léognan', 'Sauternes'],
  'Loire': ['Centre-Loire (Sancerre / Pouilly)', 'Touraine', 'Anjou-Saumur', 'Pays Nantais (Muscadet)'],
  'Rhône': ['Rhône Nord (Septentrional)', 'Rhône Sud (Méridional)', 'Côte-Rôtie', 'Condrieu', 'Saint-Joseph', 'Hermitage', 'Châteauneuf-du-Pape', 'Gigondas'],
  'Champagne': ['Montagne de Reims', 'Côte des Blancs', 'Vallée de la Marne', 'Côte des Bar'],
  'Beaujolais': ['Morgon', 'Fleurie', 'Moulin-à-Vent', 'Brouilly', 'Côte de Brouilly', 'Juliénas', 'Chiroubles', 'Chénas', 'Saint-Amour', 'Régnié'],
  'Alsace': ['Haut-Rhin', 'Bas-Rhin', 'Grands Crus d\'Alsace'],
  'Jura': ['Arbois', 'Château-Chalon', 'Côtes du Jura', 'L\'Étoile'],
  'Savoie': ['Chignin-Bergeron', 'Apremont', 'Mondeuse d\'Arbin', 'Roussette de Savoie'],
  'Languedoc-Roussillon': ['Pic Saint-Loup', 'Terrasses du Larzac', 'Faugères', 'Minervois', 'Corbières', 'Saint-Chinian', 'Limoux', 'Roussillon (Côtes du Roussillon / Aspres)', 'Collioure & Banyuls', 'Maury'],
  'Provence': ['Bandol', 'Cassis', 'Côtes de Provence', 'Palette', 'Bellet'],
  'Corse': ['Patrimonio', 'Ajaccio', 'Calvi', 'Figari', 'Sartène'],
  'Sud-Ouest': ['Cahors', 'Madiran', 'Jurançon', 'Gaillac', 'Irouléguy', 'Bergerac & Monbazillac', 'Pécharmant', 'Côtes de Gascogne', 'Marcillac', 'Fronton', 'Buzet'],
  'Italie': ['Piémont (Barolo / Barbaresco)', 'Toscane (Chianti / Brunello / Bolgheri)', 'Vénétie (Valpolicella / Amarone)', 'Sicile (Etna)', 'Trentin-Haut-Adige', 'Frioul'],
  'Espagne': ['Rioja (Alta / Alavesa)', 'Ribera del Duero', 'Priorat', 'Rías Baixas', 'Bierzo', 'Jerez-Xérès-Sherry', 'Toro', 'Penedès (Cava)'],
  'Allemagne': ['Mosel', 'Rheingau', 'Pfalz', 'Baden', 'Nahe', 'Franken', 'Rheinhessen'],
  'Autriche': ['Wachau', 'Kamptal', 'Kremstal', 'Burgenland', 'Steiermark', 'Weinviertel'],
  'Suisse': ['Valais', 'Vaud (Lavaux / Dézaley)', 'Genève', 'Neuchâtel', 'Tessin (Ticino)'],
  'Liban': ['Vallée de la Bekaa', 'Batroun', 'Mont-Liban', 'Jezzine'],
  'Portugal': ['Douro', 'Dão', 'Bairrada', 'Alentejo', 'Vinho Verde', 'Porto / Madère'],
  'États-Unis': ['Napa Valley', 'Sonoma County', 'Oregon (Willamette Valley)', 'Washington State (Columbia Valley)', 'Santa Barbara'],
  'Chili': ['Valle del Maipo', 'Colchagua', 'Casablanca', 'Leyda', 'Aconcagua', 'Itata'],
  'Argentine': ['Mendoza (Uco Valley / Luján de Cuyo)', 'Salta (Cafayate)', 'Patagonie'],
  'Afrique du Sud': ['Stellenbosch', 'Swartland', 'Walker Bay (Hemel-en-Aarde)', 'Franschhoek', 'Elgin'],
  'Australie': ['Barossa Valley', 'McLaren Vale', 'Adelaide Hills', 'Yarra Valley', 'Hunter Valley', 'Margaret River', 'Clare Valley', 'Tasmanie'],
  'Nouvelle-Zélande': ['Marlborough', 'Central Otago', 'Hawke\'s Bay', 'Martinborough / Wairarapa', 'Gisborne', 'Nelson'],
  'Australie & Nouvelle-Zélande': ['Barossa Valley', 'Adelaide Hills', 'Yarra Valley', 'Marlborough', 'Central Otago', 'Hawke\'s Bay'],
  'Grèce': ['Santorin', 'Naoussa', 'Némée', 'Goumenissa'],
  'Hongrie': ['Tokaj', 'Eger', 'Villány', 'Somló'],
  'Géorgie': ['Kakhétie (Kvevri / Qvevri)', 'Imérétie', 'Kartlie'],
  'Slovénie': ['Goriška Brda', 'Vipava', 'Štajerska']
};

export const REGIONS = REGION_GROUPS.flatMap(g => g.regions);

const COLOR_LABELS: Record<WineColor, string> = {
  rouge: 'Rouge',
  blanc: 'Blanc',
  rose: 'Rosé',
  bulle: 'Bulle / Champ.',
  orange: 'Orange',
  spiritueux: 'Spiritueux',
  cidre_biere: 'Bières & Cidres',
  soft: 'Softs & Soda',
  autre: 'Autre'
};

export const parseNumberVal = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const WineFormModal: React.FC<WineFormModalProps> = ({ wineToEdit, isDuplicate, defaultSiteId, onClose, onCreated }) => {
  const { 
    wines, 
    sites, 
    addWine, 
    updateWine, 
    deleteWine,
    addMovement,
    regions: dynamicRegions,
    addRegion: addDynamicRegion
  } = useFirebase();

  // Dynamic Region Groups and Sub-Region Suggestions computed from master data
  const activeRegionGroups = React.useMemo(() => {
    if (dynamicRegions && dynamicRegions.length > 0) {
      return getDynamicRegionGroups(dynamicRegions);
    }
    return REGION_GROUPS;
  }, [dynamicRegions]);

  const activeSubRegionSuggestions = React.useMemo(() => {
    if (dynamicRegions && dynamicRegions.length > 0) {
      return getSubRegionSuggestionsMap(dynamicRegions);
    }
    return SUB_REGION_SUGGESTIONS;
  }, [dynamicRegions]);

  // Quick Add Region inline state
  const [isQuickAddRegionOpen, setIsQuickAddRegionOpen] = useState(false);
  const [quickRegionName, setQuickRegionName] = useState('');
  const [quickRegionGroup, setQuickRegionGroup] = useState('Vignobles de France');
  const [quickRegionSub, setQuickRegionSub] = useState('');
  const [isSavingQuickRegion, setIsSavingQuickRegion] = useState(false);

  // Reference search & auto-complete states
  const [refSearchTerm, setRefSearchTerm] = useState('');
  const [selectedRefNotice, setSelectedRefNotice] = useState<string | null>(null);

  // Compute matching references from global wine database
  const matchingReferences = React.useMemo(() => {
    if (!refSearchTerm.trim() || refSearchTerm.trim().length < 2) return [];
    
    // Split the search query into individual lowercase, accent-free words
    const queryWords = refSearchTerm
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 0);

    if (queryWords.length === 0) return [];
    
    // Group unique references by name, domain, vintage, color
    const map = new Map<string, Wine>();
    
    wines.forEach(w => {
      const wName = (w.name || '').toString();
      const wDomain = (w.domain || '').toString();
      const wAppellation = (w.appellation || '').toString();
      const wCuvee = (w.cuvee || '').toString();
      const wRegion = (w.region || '').toString();
      const wVintage = (w.vintage || '').toString();
      const wColor = (w.color || '').toString();

      const key = `${wName.trim().toLowerCase()}_${wDomain.trim().toLowerCase()}_${wVintage.trim().toLowerCase()}_${wColor.trim().toLowerCase()}`;
      
      if (!map.has(key)) {
        // Build a single search target for the wine containing all search-relevant fields, lowercased and stripped of accents
        const searchTarget = `${wName} ${wDomain} ${wAppellation} ${wCuvee} ${wRegion} ${wVintage} ${wColor}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        const searchTargetCompact = searchTarget.replace(/[^a-z0-9]/g, "");

        // Check if all query words are present in the searchTarget (either as substring or compact match)
        const allWordsMatch = queryWords.every(word => {
          if (searchTarget.includes(word)) return true;
          const compactWord = word.replace(/[^a-z0-9]/g, "");
          return compactWord && searchTargetCompact.includes(compactWord);
        });

        if (allWordsMatch) {
          map.set(key, w);
        }
      }
    });
    
    return Array.from(map.values()).slice(0, 8);
  }, [wines, refSearchTerm]);

  const handleSelectReference = (refWine: Wine) => {
    let initialAppellation = refWine.appellation || '';
    let initialCuvee = refWine.cuvee || '';
    if (!initialAppellation && !initialCuvee) {
      if (refWine.name.includes(' - ')) {
        const parts = refWine.name.split(' - ');
        initialAppellation = parts[0].trim();
        initialCuvee = parts.slice(1).join(' - ').trim();
      } else {
        initialAppellation = refWine.name;
      }
    }
    setAppellation(initialAppellation);
    setCuvee(initialCuvee);
    setName(refWine.name);
    setDomain(refWine.domain);
    setVintage(refWine.vintage || 'N.V.');
    setColor(refWine.color || 'rouge');
    setRegion(refWine.region || '');
    setSubRegion(refWine.subRegion || '');
    setCountry(refWine.country || '');

    const refHt = refWine.priceBuyHt !== undefined ? String(refWine.priceBuyHt) : '';
    const refPort = refWine.shippingCost !== undefined ? String(refWine.shippingCost) : '';
    let refBuy = refWine.priceBuy !== undefined ? String(refWine.priceBuy) : '';

    const htNum = parseNumberVal(refHt);
    const portNum = parseNumberVal(refPort);
    if (!refBuy && (htNum > 0 || portNum > 0)) {
      refBuy = String(Math.round((htNum + portNum) * 100) / 100);
    } else if (portNum > 0 && Math.abs(parseNumberVal(refBuy) - (htNum + portNum)) > 0.01) {
      refBuy = String(Math.round((htNum + portNum) * 100) / 100);
    }

    setPriceBuy(refBuy);
    setPriceBuyHt(refHt);
    setShippingCost(refPort);
    setPriceSell(refWine.priceSell !== undefined ? String(refWine.priceSell) : '');
    setAutoCalculate(false);

    setNotes(refWine.notes || '');

    if (refWine.technicalSheet) {
      setAop(refWine.technicalSheet.aop || '');
      setLieuDit(refWine.technicalSheet.lieuDit || '');
      setSol(refWine.technicalSheet.sol || '');
      setCepage(refWine.technicalSheet.cepage || '');
      setAgeVignes(refWine.technicalSheet.ageVignes || '');
      setRendement(refWine.technicalSheet.rendement || '');
      setDensite(refWine.technicalSheet.densite || '');
      setSurface(refWine.technicalSheet.surface || '');
      setCulture(refWine.technicalSheet.culture || '');
      setVinification(refWine.technicalSheet.vinification || '');
      setElevage(refWine.technicalSheet.elevage || '');
      
      if (refWine.technicalSheet.degustation) {
        setOeil(refWine.technicalSheet.degustation.oeil || '');
        setNez(refWine.technicalSheet.degustation.nez || '');
        setBouche(refWine.technicalSheet.degustation.bouche || '');
      }
      if (refWine.technicalSheet.service) {
        setTemperature(refWine.technicalSheet.service.temperature || '');
        setGarde(refWine.technicalSheet.service.garde || '');
        setAccords(refWine.technicalSheet.service.accords || '');
      }
      setShowTechSheetForm(true);
    }

    setSelectedRefNotice(`Fiche récupérée depuis "${refWine.domain} - ${refWine.name} (${refWine.vintage})". Choisissez le site et l'emplacement pour la ranger.`);
    setRefSearchTerm('');
  };

  // Form states
  const [name, setName] = useState('');
  const [appellation, setAppellation] = useState('');
  const [cuvee, setCuvee] = useState('');
  const [domain, setDomain] = useState('');
  const [vintage, setVintage] = useState('N.V.');
  const [color, setColor] = useState<WineColor>('rouge');
  const [region, setRegion] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [country, setCountry] = useState('');
  const [quantity, setQuantity] = useState(6);
  const [alertThreshold, setAlertThreshold] = useState(3);
  const [siteId, setSiteId] = useState('');

  // Determine effective wine to edit:
  // If wineToEdit has 0 stock but this same reference exists on another site with stock > 0,
  // automatically prefer the site with real physical stock to avoid editing an empty ghost record.
  const effectiveWineToEdit = React.useMemo(() => {
    if (!wineToEdit || isDuplicate) return wineToEdit;
    if (wineToEdit.quantity === 0) {
      const matchWithStock = wines.find(w => w.id !== wineToEdit.id && isSameWineReference(w, wineToEdit) && w.quantity > 0);
      if (matchWithStock) return matchWithStock;
    }
    return wineToEdit;
  }, [wineToEdit, isDuplicate, wines]);

  // Multi-site reference detection & calculations
  const matchingRefWines = React.useMemo(() => {
    const target = effectiveWineToEdit || wineToEdit;
    if (!target) return [];
    return wines.filter(w => isSameWineReference(w, target));
  }, [wines, effectiveWineToEdit, wineToEdit]);

  const totalRefStock = React.useMemo(() => {
    return matchingRefWines.reduce((sum, w) => sum + (w.quantity || 0), 0);
  }, [matchingRefWines]);

  const [isCleaningSites, setIsCleaningSites] = useState(false);

  // Directly delete an empty residual site record (0 bottles)
  const handleDeleteSingleSite = async (targetWineId: string, siteName: string) => {
    if (!confirm(`Supprimer définitivement l'enregistrement sans stock (0 bouteille) sur "${siteName}" ? L'historique des mouvements passés reste intégralement conservé.`)) {
      return;
    }
    try {
      await deleteWine(targetWineId);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression de ce site.");
    }
  };

  // Directly clean all empty residual site records (0 bottles) for this reference
  const handleCleanAllEmptySites = async () => {
    const emptyWines = matchingRefWines.filter(w => w.quantity === 0);
    if (emptyWines.length === 0) return;
    if (!confirm(`Supprimer les ${emptyWines.length} site(s) où le stock est à 0 pour cette référence ? La traçabilité reste intacte dans le journal des mouvements.`)) {
      return;
    }
    setIsCleaningSites(true);
    try {
      for (const w of emptyWines) {
        await deleteWine(w.id);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors du nettoyage des sites vides.");
    } finally {
      setIsCleaningSites(false);
    }
  };

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    if (!newRegion) return;

    // First check dynamic regions repository
    const found = dynamicRegions?.find(r => r.name.toLowerCase() === newRegion.toLowerCase());
    if (found) {
      setCountry(found.country || (found.group.includes('France') ? 'France' : found.name));
      return;
    }

    // Automatically set country from groups
    const frenchGroup = activeRegionGroups.find(g => g.group === 'Vignobles de France');
    if (frenchGroup && frenchGroup.regions.includes(newRegion)) {
      setCountry('France');
    } else if (newRegion && newRegion !== 'Autre') {
      setCountry(newRegion);
    }
  };

  const handleQuickCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickRegionName.trim();
    if (!trimmed) return;
    setIsSavingQuickRegion(true);
    try {
      const subs = quickRegionSub.split(',').map(s => s.trim()).filter(Boolean);
      await addDynamicRegion({
        name: trimmed,
        group: quickRegionGroup,
        country: quickRegionGroup.includes('France') ? 'France' : 'International',
        subRegions: subs,
        description: 'Ajouté rapidement depuis la fiche vin'
      });
      setRegion(trimmed);
      if (subs.length > 0 && !subRegion) {
        setSubRegion(subs[0]);
      }
      setIsQuickAddRegionOpen(false);
      setQuickRegionName('');
      setQuickRegionSub('');
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout de la région");
    } finally {
      setIsSavingQuickRegion(false);
    }
  };
  
  // Guided position inputs (e.g., "D" and "4" -> "D4")
  const [colLetter, setColLetter] = useState('');
  const [levelNumber, setLevelNumber] = useState('');
  
  // Pricing & Formula states
  const [priceBuyHt, setPriceBuyHt] = useState<string>('');
  const [shippingCost, setShippingCost] = useState<string>('');
  const [priceBuy, setPriceBuy] = useState<string>('');
  const [priceSell, setPriceSell] = useState<string>('');
  const [pricingCoeff, setPricingCoeff] = useState<number>(3.0); // Default restaurateur coeff: 3x HT
  const [autoCalculate, setAutoCalculate] = useState(true);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Technical Sheet states
  const [aop, setAop] = useState('');
  const [lieuDit, setLieuDit] = useState('');
  const [sol, setSol] = useState('');
  const [cepage, setCepage] = useState('');
  const [ageVignes, setAgeVignes] = useState('');
  const [rendement, setRendement] = useState('');
  const [densite, setDensite] = useState('');
  const [surface, setSurface] = useState('');
  const [culture, setCulture] = useState('');
  const [vinification, setVinification] = useState('');
  const [elevage, setElevage] = useState('');
  
  // Degustation & Service
  const [oeil, setOeil] = useState('');
  const [nez, setNez] = useState('');
  const [bouche, setBouche] = useState('');
  const [temperature, setTemperature] = useState('');
  const [garde, setGarde] = useState('');
  const [accords, setAccords] = useState('');
  
  const [showTechSheetForm, setShowTechSheetForm] = useState(false);
  const [isGeneratingTechSheet, setIsGeneratingTechSheet] = useState(false);
  const [techSheetAiError, setTechSheetAiError] = useState<string | null>(null);
  const [techSheetAiSuccess, setTechSheetAiSuccess] = useState<string | null>(null);

  const handleGenerateAiTechSheet = async () => {
    const mainName = appellation.trim() || name.trim();
    if (!mainName && !domain.trim()) {
      setTechSheetAiError("Veuillez renseigner au moins l'Appellation ou le Domaine avant de lancer la génération.");
      return;
    }

    setIsGeneratingTechSheet(true);
    setTechSheetAiError(null);
    setTechSheetAiSuccess(null);
    try {
      const response = await fetch('/api/gemini/generate-technical-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wineName: mainName || domain.trim(),
          cuvee: cuvee.trim(),
          domain: domain.trim(),
          vintage: vintage.trim(),
          color: color,
          region: region.trim()
        })
      });

      if (!response.ok) {
        let errorMsg = `Erreur serveur (${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.aop) setAop(data.aop);
      if (data.lieuDit) setLieuDit(data.lieuDit);
      if (data.sol) setSol(data.sol);
      if (data.cepage) setCepage(data.cepage);
      if (data.ageVignes) setAgeVignes(data.ageVignes);
      if (data.rendement) setRendement(data.rendement);
      if (data.densite) setDensite(data.densite);
      if (data.surface) setSurface(data.surface);
      if (data.culture) setCulture(data.culture);
      if (data.vinification) setVinification(data.vinification);
      if (data.elevage) setElevage(data.elevage);

      if (data.degustation?.oeil) setOeil(data.degustation.oeil);
      if (data.degustation?.nez) setNez(data.degustation.nez);
      if (data.degustation?.bouche) setBouche(data.degustation.bouche);

      if (data.service?.temperature) setTemperature(data.service.temperature);
      if (data.service?.garde) setGarde(data.service.garde);
      if (data.service?.accords) setAccords(data.service.accords);

      setTechSheetAiSuccess("Fiche technique complétée automatiquement par l'IA !");
      setTimeout(() => setTechSheetAiSuccess(null), 5000);
    } catch (err: any) {
      console.error("Erreur lors de la génération de la fiche technique :", err);
      setTechSheetAiError(err.message || "Impossible de générer la fiche technique.");
    } finally {
      setIsGeneratingTechSheet(false);
    }
  };

  const handleGenerateAiNotes = async () => {
    const mainName = appellation.trim() || name.trim();
    if (!mainName) {
      setAiError("Veuillez saisir au moins l'Appellation ou le Nom du vin pour pouvoir générer des notes.");
      return;
    }
    setIsGeneratingNotes(true);
    setAiError(null);
    try {
      const response = await fetch('/api/gemini/generate-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wineName: mainName,
          domain: domain.trim(),
          vintage: vintage.trim(),
          color: color,
          region: region.trim()
        })
      });

      let errorMsg = `Erreur serveur (${response.status}) lors de l'appel à l'API de génération.`;
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

      setNotes(data.text || '');
    } catch (err: any) {
      console.error("Crash ou erreur de génération asynchrone :", err);
      setAiError(err.message || "Impossible de joindre le service de génération IA. Vérifiez votre connexion.");
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  useEffect(() => {
    // Select defaultSiteId if provided, or first site by default
    if (sites.length > 0 && !siteId) {
      if (defaultSiteId && sites.some(s => s.id === defaultSiteId)) {
        setSiteId(defaultSiteId);
      } else {
        setSiteId(sites[0].id);
      }
    }
  }, [sites, siteId, defaultSiteId]);

  // Set initial state on edit
  useEffect(() => {
    const targetWine = effectiveWineToEdit || wineToEdit;
    if (targetWine) {
      setName(targetWine.name);
      
      let initialAppellation = targetWine.appellation || '';
      let initialCuvee = targetWine.cuvee || '';
      if (!initialAppellation && !initialCuvee) {
        if (targetWine.name.includes(' - ')) {
          const parts = targetWine.name.split(' - ');
          initialAppellation = parts[0].trim();
          initialCuvee = parts.slice(1).join(' - ').trim();
        } else {
          initialAppellation = targetWine.name;
        }
      }
      setAppellation(initialAppellation);
      setCuvee(initialCuvee);

      setDomain(targetWine.domain);
      setVintage(targetWine.vintage);
      setColor(targetWine.color);
      setRegion(targetWine.region || '');
      setSubRegion(targetWine.subRegion || '');
      setCountry(targetWine.country || '');
      setQuantity(targetWine.quantity);
      setAlertThreshold(targetWine.alertThreshold);
      setSiteId(targetWine.siteId);
      
      // Parse bin into Column and Level if possible (e.g., "D4", "12B", "A-2")
      const binVal = (targetWine.bin || '').trim();
      const matchClassic = binVal.match(/^([A-Za-z]+)(\d+)$/);
      const matchReverse = binVal.match(/^(\d+)([A-Za-z]+)$/);
      const matchSeparated = binVal.match(/^([A-Za-z0-9]+)[-\s/]+([A-Za-z0-9]+)$/);
      if (matchClassic) {
        setColLetter(matchClassic[1].toUpperCase());
        setLevelNumber(matchClassic[2]);
      } else if (matchReverse) {
        setColLetter(matchReverse[1]);
        setLevelNumber(matchReverse[2].toUpperCase());
      } else if (matchSeparated) {
        setColLetter(matchSeparated[1].toUpperCase());
        setLevelNumber(matchSeparated[2].toUpperCase());
      } else {
        // Fallback for custom labels
        setColLetter(binVal);
        setLevelNumber('');
      }

      const initHt = targetWine.priceBuyHt !== undefined ? String(targetWine.priceBuyHt) : '';
      const initPort = targetWine.shippingCost !== undefined ? String(targetWine.shippingCost) : '';
      let initBuy = targetWine.priceBuy !== undefined ? String(targetWine.priceBuy) : '';

      const htVal = parseNumberVal(initHt);
      const portVal = parseNumberVal(initPort);
      // If priceBuy was missing or equals HT despite port being present, calculate the real addition:
      if (!initBuy && (htVal > 0 || portVal > 0)) {
        initBuy = String(Math.round((htVal + portVal) * 100) / 100);
      } else if (portVal > 0 && Math.abs(parseNumberVal(initBuy) - (htVal + portVal)) > 0.01) {
        initBuy = String(Math.round((htVal + portVal) * 100) / 100);
      }

      setPriceBuy(initBuy);
      setPriceBuyHt(initHt);
      setShippingCost(initPort);
      setPriceSell(targetWine.priceSell !== undefined ? String(targetWine.priceSell) : '');
      setAutoCalculate(false); // Do not overwrite existing price during edit unless user explicitly wants to
      setNotes(targetWine.notes || '');

      // Load structured technical sheet if existing
      if (targetWine.technicalSheet) {
        setAop(targetWine.technicalSheet.aop || '');
        setLieuDit(targetWine.technicalSheet.lieuDit || '');
        setSol(targetWine.technicalSheet.sol || '');
        setCepage(targetWine.technicalSheet.cepage || '');
        setAgeVignes(targetWine.technicalSheet.ageVignes || '');
        setRendement(targetWine.technicalSheet.rendement || '');
        setDensite(targetWine.technicalSheet.densite || '');
        setSurface(targetWine.technicalSheet.surface || '');
        setCulture(targetWine.technicalSheet.culture || '');
        setVinification(targetWine.technicalSheet.vinification || '');
        setElevage(targetWine.technicalSheet.elevage || '');
        
        if (targetWine.technicalSheet.degustation) {
          setOeil(targetWine.technicalSheet.degustation.oeil || '');
          setNez(targetWine.technicalSheet.degustation.nez || '');
          setBouche(targetWine.technicalSheet.degustation.bouche || '');
        } else {
          setOeil('');
          setNez('');
          setBouche('');
        }

        if (targetWine.technicalSheet.service) {
          setTemperature(targetWine.technicalSheet.service.temperature || '');
          setGarde(targetWine.technicalSheet.service.garde || '');
          setAccords(targetWine.technicalSheet.service.accords || '');
        } else {
          setTemperature('');
          setGarde('');
          setAccords('');
        }
      } else {
        setAop('');
        setLieuDit('');
        setSol('');
        setCepage('');
        setAgeVignes('');
        setRendement('');
        setDensite('');
        setSurface('');
        setCulture('');
        setVinification('');
        setElevage('');
        setOeil('');
        setNez('');
        setBouche('');
        setTemperature('');
        setGarde('');
        setAccords('');
      }
    }
  }, [wineToEdit]);

  // Computed live numbers and helpers
  const htNum = parseNumberVal(priceBuyHt);
  const portNum = parseNumberVal(shippingCost);
  const buyNum = parseNumberVal(priceBuy) || ((htNum > 0 || portNum > 0) ? Math.round((htNum + portNum) * 100) / 100 : 0);
  const sellNum = parseNumberVal(priceSell);
  const activeCoeff = getPricingCoefficient(buyNum);
  const suggestedSell = buyNum > 0 ? calculateSellingPrice(buyNum) : 0;
  const margin = sellNum > 0 && buyNum > 0 ? sellNum - buyNum : 0;
  const marginPercent = sellNum > 0 ? (margin / sellNum) * 100 : 0;
  const computedCoeff = buyNum > 0 ? sellNum / buyNum : 0;

  // Handle automatic purchase price (HT + Port) and selling price calculation
  const syncBuyPrice = (newHtStr: string, newPortStr: string) => {
    const h = parseNumberVal(newHtStr);
    const p = parseNumberVal(newPortStr);
    const total = (h > 0 || p > 0) ? Math.round((h + p) * 100) / 100 : 0;
    setPriceBuy(total > 0 ? String(total) : '');

    if (autoCalculate && total > 0) {
      const suggested = calculateSellingPrice(total);
      setPriceSell(suggested > 0 ? String(suggested) : '');
    }
  };

  // Compute final combined Bin string (supports letters, numbers, or combined codes)
  const computedBin = (() => {
    const col = colLetter.trim().toUpperCase();
    const lvl = levelNumber.trim().toUpperCase();
    if (col && lvl) {
      return `${col}${lvl}`;
    }
    return col || lvl || '';
  })();

  // Get current site details
  const selectedSiteObj = sites.find(s => s.id === siteId);
  const locationPreview = computedBin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appellation.trim() || !domain.trim() || !siteId) {
      setFormError("Veuillez remplir les champs obligatoires (Appellation, Domaine, Site).");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const finalAppellation = appellation.trim();
    const finalCuvee = cuvee.trim();
    const finalName = finalAppellation && finalCuvee
      ? `${finalAppellation} - ${finalCuvee}`
      : (finalAppellation || finalCuvee);

    const hasAnySheetValue = !!(
      aop.trim() || lieuDit.trim() || sol.trim() || cepage.trim() || 
      ageVignes.trim() || rendement.trim() || densite.trim() || 
      surface.trim() || culture.trim() || vinification.trim() || 
      elevage.trim() || oeil.trim() || nez.trim() || bouche.trim() || 
      temperature.trim() || garde.trim() || accords.trim()
    );

    const updatedSheet: TechnicalSheet | undefined = hasAnySheetValue ? {
      ...(wineToEdit?.technicalSheet || {}),
      aop: aop.trim() || undefined,
      lieuDit: lieuDit.trim() || undefined,
      sol: sol.trim() || undefined,
      cepage: cepage.trim() || undefined,
      ageVignes: ageVignes.trim() || undefined,
      rendement: rendement.trim() || undefined,
      densite: densite.trim() || undefined,
      surface: surface.trim() || undefined,
      culture: culture.trim() || undefined,
      vinification: vinification.trim() || undefined,
      elevage: elevage.trim() || undefined,
      degustation: (oeil.trim() || nez.trim() || bouche.trim()) ? {
        oeil: oeil.trim() || undefined,
        nez: nez.trim() || undefined,
        bouche: bouche.trim() || undefined,
      } : undefined,
      service: (temperature.trim() || garde.trim() || accords.trim()) ? {
        temperature: temperature.trim() || undefined,
        garde: garde.trim() || undefined,
        accords: accords.trim() || undefined,
      } : undefined,
    } : wineToEdit?.technicalSheet;

    const parsedHt = parseNumberVal(priceBuyHt);
    const parsedPort = parseNumberVal(shippingCost);
    let parsedBuy = parseNumberVal(priceBuy);
    if (parsedBuy <= 0 && (parsedHt > 0 || parsedPort > 0)) {
      parsedBuy = Math.round((parsedHt + parsedPort) * 100) / 100;
    }
    const parsedSell = parseNumberVal(priceSell);

    const wineData = {
      name: finalName,
      domain: domain.trim(),
      vintage: vintage.trim() || 'N.V.',
      color,
      region: region.trim() || undefined,
      subRegion: subRegion.trim() || undefined,
      country: country.trim() || undefined,
      quantity: Number(quantity) || 0,
      alertThreshold: Number(alertThreshold) || 0,
      siteId,
      bin: computedBin || undefined,
      priceBuy: parsedBuy > 0 ? parsedBuy : undefined,
      priceBuyHt: parsedHt > 0 ? parsedHt : undefined,
      shippingCost: parsedPort > 0 ? parsedPort : undefined,
      priceSell: parsedSell > 0 ? parsedSell : undefined,
      notes: notes.trim() || undefined,
      appellation: finalAppellation || undefined,
      cuvee: finalCuvee || undefined,
      technicalSheet: updatedSheet
    };

    try {
      const targetWineToUpdate = effectiveWineToEdit || wineToEdit;
      if (targetWineToUpdate && !isDuplicate) {
        // Calculate stock difference if quantity changed
        const qtyDiff = wineData.quantity - targetWineToUpdate.quantity;
        
        await updateWine(targetWineToUpdate.id, wineData, 'edit');
        
        if (qtyDiff !== 0) {
          await addMovement({
            wineId: targetWineToUpdate.id,
            wineName: `${wineData.name} (${wineData.vintage})`,
            type: qtyDiff > 0 ? 'in' : 'out',
            quantity: Math.abs(qtyDiff),
            reason: 'correction',
            notes: `Correction manuelle de stock lors de la mise à jour de la fiche produit.`,
            fromSiteId: qtyDiff < 0 ? targetWineToUpdate.siteId : '',
            toSiteId: qtyDiff > 0 ? wineData.siteId : ''
          });
        }
      } else {
        // Adding new Wine
        const newWineId = await addWine(wineData);
        
        // Log automatic initial delivery movement
        if (wineData.quantity > 0) {
          await addMovement({
            wineId: newWineId,
            wineName: `${wineData.name} (${wineData.vintage})`,
            type: 'in',
            quantity: wineData.quantity,
            reason: 'livraison',
            notes: isDuplicate 
              ? `Mise en stock initiale lors de la duplication du produit.`
              : `Mise en stock initiale lors de la création du produit.`,
            toSiteId: wineData.siteId
          });
        }
        
        if (onCreated) {
          onCreated(newWineId);
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setFormError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col my-8 animate-fade-in text-slate-800">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-sans">
              {isDuplicate ? 'Dupliquer la référence' : wineToEdit ? 'Modifier la référence' : 'Ajouter une nouvelle référence'}
            </h2>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Saisie conforme pour stocks et carte.</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[75vh] divide-y divide-slate-100">
          
          {/* Main Attributes */}
          <div className="p-5 space-y-4">
            {/* Search Engine for Existing Reference */}
            {(!wineToEdit || isDuplicate) && (
              <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-red-400" />
                    Moteur de Recherche Référence Base
                  </label>
                  <span className="text-[9px] font-mono text-slate-400">
                    Saisie automatique sans tout re-taper
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tapez nom, domaine, cuvée ou appellation (ex: Prieuré Roch, Chablis, Clos Vougeot)..."
                    value={refSearchTerm}
                    onChange={(e) => setRefSearchTerm(e.target.value)}
                    className="w-full h-10 bg-slate-800 border border-slate-700 focus:border-red-500 rounded-lg pl-3 pr-8 text-xs text-white placeholder-slate-400 outline-none transition-all font-sans"
                  />
                  {refSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setRefSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {matchingReferences.length > 0 && (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-700/60 mt-1">
                    {matchingReferences.map((refWine) => (
                      <div
                        key={refWine.id}
                        onClick={() => handleSelectReference(refWine)}
                        className="p-2.5 hover:bg-slate-700/80 cursor-pointer transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">{refWine.name}</span>
                            <span className="text-[10px] font-mono text-amber-300 shrink-0">({refWine.vintage})</span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                              refWine.color === 'blanc' 
                                ? 'bg-amber-100/20 text-amber-300 border border-amber-300/40' 
                                : refWine.color === 'rouge' 
                                ? 'bg-rose-900/60 text-rose-300 border border-rose-600/40' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {COLOR_LABELS[refWine.color] || refWine.color}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 truncate font-mono">
                            {refWine.domain} {refWine.region ? `• ${refWine.region}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold font-mono shrink-0 cursor-pointer"
                        >
                          Récupérer
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {refSearchTerm.trim().length >= 2 && matchingReferences.length === 0 && (
                  <div className="p-2 text-center text-[10px] font-mono text-slate-400">
                    Aucune référence correspondante dans la base. Remplissez le formulaire ci-dessous.
                  </div>
                )}

                {selectedRefNotice && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-mono font-medium flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{selectedRefNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRefNotice(null)}
                      className="text-emerald-400 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2 items-center">
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-600" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {/* Multi-site synchronization banner when editing a reference present on multiple sites */}
            {(effectiveWineToEdit || wineToEdit) && !isDuplicate && matchingRefWines.length > 1 && (
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200/80 rounded-xl text-xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-amber-950 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Référence multi-sites ({matchingRefWines.length} sites &bull; Total : {totalRefStock} bouteille{totalRefStock > 1 ? 's' : ''})
                  </span>
                  <div className="flex items-center gap-2">
                    {matchingRefWines.some(w => w.quantity === 0) && (
                      <button
                        type="button"
                        onClick={handleCleanAllEmptySites}
                        disabled={isCleaningSites}
                        className="text-[10px] font-mono font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Supprimer définitivement tous les enregistrements à 0 bouteille de cette référence"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        Nettoyer les sites à 0 bt
                      </button>
                    )}
                    <span className="text-[10px] font-mono bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Synchronisation globale
                    </span>
                  </div>
                </div>

                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Toute modification des informations du vin (appellation, cuvée, domaine, millésime, notes, prix, fiche technique) est automatiquement appliquée à <strong>tous les sites</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Répartition :
                  </span>
                  {matchingRefWines.map(mw => {
                    const s = sites.find(item => item.id === mw.siteId);
                    const sName = s?.name?.split(' - ')[0] || 'Site';
                    const isSelectedSite = mw.siteId === siteId;
                    const isEmptyStock = mw.quantity === 0;

                    return (
                      <div
                        key={mw.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                          isEmptyStock
                            ? 'bg-slate-100 text-slate-500 border-dashed border-slate-300'
                            : isSelectedSite
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs ring-1 ring-emerald-300'
                              : 'bg-white text-slate-700 border-amber-200'
                        }`}
                      >
                        <span>
                          {sName} : {mw.quantity} bt{mw.quantity > 1 ? 's' : ''} {mw.bin ? `[${mw.bin}]` : ''}
                        </span>

                        {isEmptyStock && (
                          <span className="text-[9px] text-rose-600 bg-rose-50 px-1 rounded border border-rose-200">
                            (épuisé sur ce site)
                          </span>
                        )}

                        {isSelectedSite && !isEmptyStock && (
                          <span className="text-[9px] text-emerald-700 bg-emerald-100/70 px-1 rounded">
                            (site actif)
                          </span>
                        )}

                        {/* Action directe pour supprimer ce site vide */}
                        {isEmptyStock && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSite(mw.id, sName);
                            }}
                            className="ml-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 p-0.5 rounded cursor-pointer transition-colors"
                            title={`Supprimer l'enregistrement vide de ${sName}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wine Name & Domain */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Appellation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Chablis, Rioja, Maipo"
                  value={appellation}
                  onChange={(e) => setAppellation(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Nom de la cuvée / Référence
                </label>
                <input
                  type="text"
                  placeholder="Ex: Les Clos, Reserva"
                  value={cuvee}
                  onChange={(e) => setCuvee(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Domaine / Producteur */}
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                Domaine / Producteur *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Domaine Raveneau, Errazuriz"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
              />
            </div>

            {/* Vintage, Region & Sub-region */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Millésime *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2020 ou N.V."
                  value={vintage}
                  onChange={(e) => setVintage(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500 font-mono uppercase tracking-wider font-bold">
                    Région / Pays
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddRegionOpen(prev => !prev)}
                    className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                  >
                    {isQuickAddRegionOpen ? 'Fermer' : '+ Nouvelle région'}
                  </button>
                </div>
                <select
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 text-slate-700 text-sm rounded-xl px-3 outline-none cursor-pointer"
                >
                  <option value="">Sélectionner la région</option>
                  {activeRegionGroups.map((grp) => (
                    <optgroup key={grp.group} label={grp.group}>
                      {grp.regions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Sous-Région / Terroir
                </label>
                <input
                  type="text"
                  list="subregion-suggestions-list"
                  placeholder={region && activeSubRegionSuggestions[region] ? `Ex: ${activeSubRegionSuggestions[region][0]}` : "Ex: Côte de Nuits, Chablis, Saint-Pourçain..."}
                  value={subRegion}
                  onChange={(e) => setSubRegion(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all"
                />
                <datalist id="subregion-suggestions-list">
                  {(region && activeSubRegionSuggestions[region] ? activeSubRegionSuggestions[region] : []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Quick Add Region Inline Form */}
            {isQuickAddRegionOpen && (
              <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-900">
                    Ajouter une région au référentiel sommelier
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddRegionOpen(false)}
                    className="text-red-400 hover:text-red-700 text-xs font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nom (ex: Auvergne)"
                    value={quickRegionName}
                    onChange={(e) => setQuickRegionName(e.target.value)}
                    className="h-9 px-2.5 bg-white border border-red-200 rounded-lg text-xs outline-none text-slate-900"
                  />
                  <select
                    value={quickRegionGroup}
                    onChange={(e) => setQuickRegionGroup(e.target.value)}
                    className="h-9 px-2 bg-white border border-red-200 rounded-lg text-xs outline-none text-slate-800"
                  >
                    {activeRegionGroups.map(g => (
                      <option key={g.group} value={g.group}>{g.group}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Terroirs séparés par virgules"
                    value={quickRegionSub}
                    onChange={(e) => setQuickRegionSub(e.target.value)}
                    className="h-9 px-2.5 bg-white border border-red-200 rounded-lg text-xs outline-none text-slate-900"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingQuickRegion || !quickRegionName.trim()}
                    onClick={handleQuickCreateRegion}
                    className="h-8 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    {isSavingQuickRegion ? 'Ajout...' : 'Créer et appliquer'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Sub-region Suggestion Pills for Sommeliers */}
            {region && activeSubRegionSuggestions[region] && activeSubRegionSuggestions[region].length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Suggestions terroirs :</span>
                {activeSubRegionSuggestions[region].slice(0, 6).map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => setSubRegion(sugg)}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-all cursor-pointer ${
                      subRegion === sugg
                        ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            )}

            {/* Category / Color Selection */}
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5 font-mono uppercase tracking-wider font-bold">
                Catégorie de produit *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(Object.keys(COLOR_LABELS) as WineColor[]).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={`h-9 rounded-xl font-mono text-[10px] uppercase font-bold border transition-all cursor-pointer ${
                      color === col
                        ? 'bg-red-600 border-red-700 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {COLOR_LABELS[col]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Guided Storage & Positioning */}
          <div className="p-5 space-y-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-mono">Stockage & Emplacement</h3>
              {locationPreview && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl shadow-sm">
                  <span>Code :</span>
                  <span className="text-sm font-black">{locationPreview}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Site Selection */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Sélection du Site *
                </label>
                {sites.length === 0 ? (
                  <p className="text-xs text-rose-500 font-mono py-2">Créez un site d'abord !</p>
                ) : (
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    required
                    className="w-full h-11 bg-white border border-slate-200 focus:border-red-500 text-slate-800 text-xs rounded-xl px-2.5 outline-none cursor-pointer"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name.split(' - ')[0]}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Column / Zone */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Colonne / Allée
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="Ex: D, 12, A-1"
                  value={colLetter}
                  onChange={(e) => setColLetter(e.target.value.toUpperCase())}
                  className="w-full h-11 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono uppercase text-center font-bold"
                />
              </div>

              {/* Level / Shelf */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Étage / Niveau
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="Ex: 4, B, N2"
                  value={levelNumber}
                  onChange={(e) => setLevelNumber(e.target.value.toUpperCase())}
                  className="w-full h-11 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono uppercase text-center font-bold"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-serif italic">
              * Aide : Emplacement composé = {computedBin || 'D4'} (Colonne/Allée : {colLetter || '—'}, Étage/Niveau : {levelNumber || '—'}) dans {selectedSiteObj?.name?.split(' - ')[0] || 'le site sélectionné'}.
            </p>

            {/* Quantities */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  {wineToEdit && !isDuplicate 
                    ? (matchingRefWines.length > 1 
                        ? `Quantité sur ${selectedSiteObj?.name?.split(' - ')[0] || 'ce site'} *`
                        : 'Quantité Actuelle *')
                    : 'Stock Initial *'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-11 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                  Seuil Alerte (Rupture) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-11 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Pricing with automatic commercial margin */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-slate-500" />
                Marge Commerciale & Tarifs
              </h3>
              
              <button
                type="button"
                onClick={() => {
                  const next = !autoCalculate;
                  setAutoCalculate(next);
                  if (next && buyNum > 0) {
                    const suggested = calculateSellingPrice(buyNum);
                    setPriceSell(suggested > 0 ? String(suggested) : '');
                  }
                }}
                className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                  autoCalculate 
                    ? 'bg-red-50 border-red-200 text-red-600' 
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
              >
                Calcul automatique {autoCalculate ? 'Actif' : 'Désactivé'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Purchase Price HT */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    Prix HT (Achat net) (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 15.00"
                    value={priceBuyHt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPriceBuyHt(val);
                      syncBuyPrice(val, shippingCost);
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono"
                  />
                </div>

                {/* Shipping Cost */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    Frais de Port (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 0.50"
                    value={shippingCost}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShippingCost(val);
                      syncBuyPrice(priceBuyHt, val);
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono"
                  />
                </div>

                {/* Purchase Price (HT + Port) */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    Prix d'achat (HT + Port) (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 15.50"
                    value={priceBuy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPriceBuy(val);
                      if (autoCalculate) {
                        const b = parseNumberVal(val);
                        if (b > 0) {
                          const suggested = calculateSellingPrice(b);
                          setPriceSell(suggested > 0 ? String(suggested) : '');
                        }
                      }
                    }}
                    className="w-full h-11 bg-slate-100/80 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono font-bold"
                  />
                  <div className="mt-1">
                    {htNum > 0 || portNum > 0 ? (
                      <p className="text-[10px] text-slate-500 font-mono">
                        Addition : <span className="font-semibold text-slate-700">{htNum.toFixed(2)} €</span> + <span className="font-semibold text-amber-800">{portNum.toFixed(2)} €</span> = <span className="font-bold text-slate-900">{buyNum.toFixed(2)} €</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-mono italic">
                        Calcul automatique : HT + Frais de port
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 4-Tier Coefficient Info */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold flex items-center justify-between">
                    <span>Grille Tarifaire (Coeff.)</span>
                    <span className="text-red-600 font-extrabold">{activeCoeff}x</span>
                  </label>
                  <div className="w-full h-11 bg-red-50/60 border border-red-200/80 rounded-xl px-3 flex items-center justify-between text-xs font-mono font-bold text-red-900">
                    <span className="truncate">
                      {buyNum <= 0 ? (
                        '2.7x (≤50€) | 2.5x (≤100€) | 2.2x (<200€) | 2.0x (≥200€)'
                      ) : buyNum >= 200 ? (
                        'Tranche 4 (≥ 200€) : Coeff 2,0x'
                      ) : buyNum > 100 ? (
                        'Tranche 3 (100€ - 200€) : Coeff 2,2x'
                      ) : buyNum > 50 ? (
                        'Tranche 2 (50€ - 100€) : Coeff 2,5x'
                      ) : (
                        'Tranche 1 (≤ 50€) : Coeff 2,7x'
                      )}
                    </span>
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-md shrink-0 ml-1">
                      {activeCoeff}x
                    </span>
                  </div>
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 font-mono uppercase tracking-wider font-bold flex items-center justify-between">
                    <span>Prix de Vente TTC (€)</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal lowercase">(arrondi € sup.)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 45.00"
                    value={priceSell}
                    onChange={(e) => {
                      setPriceSell(e.target.value);
                      if (autoCalculate) setAutoCalculate(false); // Disable auto calculations if user writes manually
                    }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 text-slate-900 text-sm outline-none transition-all font-mono font-bold text-slate-900"
                  />
                  {suggestedSell > 0 && sellNum !== suggestedSell && (
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPriceSell(String(suggestedSell))}
                        className="text-[10px] font-mono font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        Appliquer formule ({suggestedSell} € TTC)
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {buyNum.toFixed(2)}€ × {activeCoeff}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Margin Summary Panel */}
            {buyNum > 0 && sellNum > 0 && (
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Marge brute HT/TTC</p>
                  <p className="font-bold text-emerald-800">+{margin.toFixed(2)} €</p>
                </div>
                <div className="border-x border-emerald-100">
                  <p className="text-[10px] text-slate-400 uppercase">Taux de marque</p>
                  <p className="font-bold text-emerald-800">{marginPercent.toFixed(1)} %</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Coeff Réel</p>
                  <p className="font-bold text-emerald-800">{computedCoeff.toFixed(2)}x</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes and Comments */}
          <div className="p-5 bg-slate-50/30">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] text-slate-500 font-mono uppercase tracking-wider font-bold">
                Notes de dégustation / Commentaires
              </label>
              <button
                type="button"
                onClick={handleGenerateAiNotes}
                disabled={isGeneratingNotes}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingNotes ? 'animate-spin text-amber-600' : 'text-amber-500'}`} />
                {isGeneratingNotes ? 'Génération...' : 'Suggérer (IA)'}
              </button>
            </div>
            
            {aiError && (
              <p className="text-[10px] text-red-650 bg-red-50 border border-red-100 p-2 rounded-xl font-mono mb-2">
                {aiError}
              </p>
            )}

            <textarea
              placeholder="Cépage, vieillissement optimal, accords plats..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2.5}
              className="w-full bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl p-3 text-slate-800 text-xs outline-none transition-all"
            />
          </div>

          {/* Collapsible Technical Sheet Details */}
          <div className="border-t border-slate-150">
            <button
              type="button"
              onClick={() => setShowTechSheetForm(!showTechSheetForm)}
              className="w-full flex justify-between items-center px-5 py-4 bg-slate-50 hover:bg-slate-100/70 transition-colors font-semibold text-xs text-slate-800 uppercase tracking-wider font-mono cursor-pointer border-b border-slate-100"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-650 animate-pulse" />
                Fiche Technique Œnologique détaillée {wineToEdit?.technicalSheet && "(Déjà configurée)"}
              </span>
              {showTechSheetForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTechSheetForm && (
              <div className="p-5 space-y-4 bg-white divide-y divide-slate-100">
                {/* AI Tech Sheet Auto-Generator Header */}
                <div className="bg-gradient-to-r from-red-50 to-amber-50/60 border border-red-200/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Génération automatique par l'IA Sommelier
                      </span>
                      <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                        Remplissez automatiquement l'AOP, le sol, les cépages, l'élevage et la dégustation à partir du nom et du domaine.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAiTechSheet}
                      disabled={isGeneratingTechSheet || (!appellation.trim() && !name.trim() && !domain.trim())}
                      className="h-8.5 px-3.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm shrink-0 transition-all cursor-pointer"
                    >
                      {isGeneratingTechSheet ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                          Générer la Fiche IA
                        </>
                      )}
                    </button>
                  </div>

                  {techSheetAiSuccess && (
                    <div className="p-2 bg-emerald-100/70 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-sans font-medium flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{techSheetAiSuccess}</span>
                    </div>
                  )}

                  {techSheetAiError && (
                    <div className="p-2 bg-rose-100/70 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-sans flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{techSheetAiError}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3.5 pt-3">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5 mb-1">
                    Terroir & Caractéristiques de la Cuvée
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        AOP / Appellation
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Chassagne-Montrachet"
                        value={aop}
                        onChange={(e) => setAop(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Lieu-dit / Climat
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Blanchots"
                        value={lieuDit}
                        onChange={(e) => setLieuDit(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Type de Sol
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Argilo-calcaire"
                        value={sol}
                        onChange={(e) => setSol(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Cépage(s)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 100% Chardonnay"
                        value={cepage}
                        onChange={(e) => setCepage(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Âge des vignes
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 40 ans"
                        value={ageVignes}
                        onChange={(e) => setAgeVignes(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Rendement (hl/ha)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 50 hl/ha"
                        value={rendement}
                        onChange={(e) => setRendement(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Mode de culture
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Biologique / Biodynamie"
                        value={culture}
                        onChange={(e) => setCulture(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Densité de plantation
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 10 000 pieds/ha"
                        value={densite}
                        onChange={(e) => setDensite(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Surface de la cuvée
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 0,60 ha"
                        value={surface}
                        onChange={(e) => setSurface(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-3.5">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5 mb-1">
                    Vinification, Élevage & Dégustation
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Méthode de Vinification
                      </label>
                      <textarea
                        placeholder="Pressurage direct, levures indigènes..."
                        value={vinification}
                        onChange={(e) => setVinification(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl p-3 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">
                        Méthode d'Élevage
                      </label>
                      <textarea
                        placeholder="12 mois en fûts de chêne français..."
                        value={elevage}
                        onChange={(e) => setElevage(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl p-3 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="block text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400">Notes Sommelier</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Œil / Robe</label>
                        <input
                          type="text"
                          placeholder="Or clair brillant..."
                          value={oeil}
                          onChange={(e) => setOeil(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Nez / Arômes</label>
                        <input
                          type="text"
                          placeholder="Fleurs blanches, silex..."
                          value={nez}
                          onChange={(e) => setNez(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Bouche / Finale</label>
                        <input
                          type="text"
                          placeholder="Tension saline, gras..."
                          value={bouche}
                          onChange={(e) => setBouche(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Température de service</label>
                      <input
                        type="text"
                        placeholder="Ex: 12-14°C"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Potentiel de Garde</label>
                      <input
                        type="text"
                        placeholder="Ex: 5 à 10 ans"
                        value={garde}
                        onChange={(e) => setGarde(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Accords Mets-Vins</label>
                      <input
                        type="text"
                        placeholder="Ex: Saint-Jacques, crustacés"
                        value={accords}
                        onChange={(e) => setAccords(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 text-slate-900 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-5 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="h-11 border border-slate-200 hover:bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center gap-2 font-semibold transition-colors cursor-pointer text-xs font-sans"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting || sites.length === 0}
              className="h-11 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 text-white px-5 rounded-xl flex items-center gap-2 font-bold transition-all cursor-pointer text-xs font-sans shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Enregistrement...' : isDuplicate ? 'Dupliquer la référence' : 'Enregistrer la fiche'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
