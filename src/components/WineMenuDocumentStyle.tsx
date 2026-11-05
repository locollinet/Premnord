import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine } from '../types';
import { PremnordLogo } from './PremnordLogo';
import { 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Sliders, 
  Eye, 
  EyeOff, 
  Layers, 
  Sparkles,
  RefreshCw,
  FileText,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Info,
  ExternalLink
} from 'lucide-react';

// Get canonical domain helper (matching types or custom implementation)
const getCanonicalDomain = (domain: string | undefined): string => {
  if (!domain) return 'Domaine Inconnu';
  const clean = domain
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  
  if (
    clean === 'dpr' || 
    clean === 'prieureroch' || 
    clean === 'domaineprieureroch' || 
    clean === 'prieure' || 
    clean === 'domaineduprieureroch'
  ) {
    return 'Domaine Prieuré-Roch';
  }
  return (domain || '').trim();
};

// Détection des spiritueux, digestifs, liqueurs, softs et boissons hors-vin
const isSpiritOrSoft = (wine: Wine): boolean => {
  if (wine.color === 'spiritueux' || wine.color === 'soft' || wine.color === 'autre') return true;
  const col = (wine.color || '').toLowerCase();
  if (col.includes('spirit') || col.includes('digestif') || col.includes('liqueur')) return true;
  const name = (wine.name || '').toLowerCase();
  const reg = (wine.region || '').toLowerCase();
  const app = (wine.appellation || '').toLowerCase();
  const text = `${name} ${reg} ${app}`;
  if (['cognac', 'armagnac', 'calvados', 'whisky', 'whiskey', 'chartreuse', 'rhum', 'rum', 'gin', 'vodka', 'marc de bourgogne', 'fine de bourgogne', 'eau-de-vie', 'eau de vie'].some(k => text.includes(k))) {
    return true;
  }
  return false;
};

const isMagnum = (wine: Wine): boolean => {
  const nameLower = (wine.name || '').toLowerCase();
  const cuveeLower = (wine.cuvee || '').toLowerCase();
  const notesLower = (wine.notes || '').toLowerCase();
  const binLower = (wine.bin || '').toLowerCase();
  
  return (
    nameLower.includes('mag') || 
    nameLower.includes('magnum') || 
    nameLower.includes('150cl') || 
    nameLower.includes('150 cl') || 
    nameLower.includes('1.5l') || 
    nameLower.includes('1,5l') || 
    cuveeLower.includes('mag') || 
    cuveeLower.includes('magnum') || 
    notesLower.includes('magnum') ||
    binLower.includes('(mag)') ||
    binLower.includes('mag')
  );
};


// Formatage haute fidélité des prix (conforme au document Word : pas de décimales nulles, espace insécable milliers)
const formatDocPrice = (price?: number | null): string => {
  if (price === undefined || price === null || isNaN(price) || price <= 0) return '';
  const isInt = Number.isInteger(price);
  const numStr = isInt ? Math.round(price).toString() : price.toFixed(2).replace('.', ',');
  return `${numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
};

// Formatage de l'appellation et de la cuvée entre guillemets doubles conformes au document Word
const formatWineDisplayTitle = (name: string, cuvee?: string): string => {
  let cleanName = (name || '').trim();
  let cleanCuvee = (cuvee || '').trim();
  
  if (cleanCuvee) {
    const cleanCuveeUnquoted = cleanCuvee.replace(/^["«]|["»]$/g, '').trim();
    if (cleanName.toLowerCase().includes(cleanCuveeUnquoted.toLowerCase())) {
      if (!cleanName.includes('"') && !cleanName.includes('«')) {
        const regex = new RegExp(cleanCuveeUnquoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        return cleanName.replace(regex, `"${cleanCuveeUnquoted}"`);
      }
      return cleanName;
    }
    return `${cleanName} "${cleanCuveeUnquoted}"`;
  }
  return cleanName;
};

// Sommaire officiel exhaustif extrait du document Word original (42 pages)
interface TocSection {
  title: string;
  page: number;
  targetPage: number;
  subItems?: { name: string; page: number }[];
}

const OFFICIAL_TOC: TocSection[] = [
  {
    title: "Domaine Prieuré Roch",
    page: 3,
    targetPage: 3,
    subItems: []
  },
  {
    title: "Effervescences",
    page: 6,
    targetPage: 4,
    subItems: [
      { name: "Champagne", page: 6 },
      { name: "Bourgogne", page: 7 },
      { name: "Loire – Jura", page: 7 },
      { name: "Savoie – Bugey", page: 8 },
      { name: "Alsace – Moselle", page: 8 },
      { name: "Sud-ouest", page: 8 },
      { name: "Corse", page: 8 },
      { name: "Espagne", page: 8 },
      { name: "Portugal", page: 8 },
      { name: "Italie", page: 9 },
      { name: "Etats-Unis", page: 9 },
      { name: "Co-fermentations", page: 9 },
      { name: "Cidres et Poirés", page: 9 }
    ]
  },
  {
    title: "Vins Blancs",
    page: 10,
    targetPage: 5,
    subItems: [
      { name: "Bourgogne", page: 10 },
      { name: "Beaujolais – Champagne – Jura", page: 15 },
      { name: "Savoie et vignobles alpins", page: 16 },
      { name: "Alsace", page: 17 },
      { name: "Moselle – Auvergne – Loire", page: 18 },
      { name: "Bordelais et Sud-Ouest", page: 20 },
      { name: "Rhône", page: 20 },
      { name: "Provence – Corse", page: 21 },
      { name: "Languedoc et Roussillon", page: 22 },
      { name: "Allemagne", page: 23 },
      { name: "Suisse", page: 23 },
      { name: "Autriche", page: 23 },
      { name: "Italie", page: 23 },
      { name: "Hongrie", page: 24 },
      { name: "Espagne", page: 24 },
      { name: "Portugal", page: 25 },
      { name: "Slovénie", page: 25 },
      { name: "Grèce", page: 25 },
      { name: "Géorgie", page: 26 },
      { name: "Etats-Unis", page: 26 },
      { name: "Chili", page: 26 },
      { name: "Argentine", page: 26 },
      { name: "Afrique du Sud", page: 26 },
      { name: "Australie – Nouvelle-Zélande", page: 27 },
      { name: "Japon", page: 27 }
    ]
  },
  {
    title: "Vins Rosés",
    page: 25,
    targetPage: 6,
    subItems: [
      { name: "Bourgogne", page: 25 },
      { name: "Rhône sud – Provence - Corse", page: 25 },
      { name: "Espagne", page: 25 },
      { name: "Bordelais", page: 25 },
      { name: "Afrique du Sud", page: 25 }
    ]
  },
  {
    title: "Vins Rouges",
    page: 26,
    targetPage: 7,
    subItems: [
      { name: "Bourgogne", page: 26 },
      { name: "Beaujolais", page: 30 },
      { name: "Alsace – Moselle – Jura", page: 32 },
      { name: "Bugey – Savoie – Isère", page: 33 },
      { name: "Auvergne – Loire", page: 33 },
      { name: "Sud-ouest et Bordelais", page: 35 },
      { name: "Rhône nord", page: 36 },
      { name: "Rhône sud", page: 37 },
      { name: "Provence", page: 37 },
      { name: "Corse – Languedoc – Roussillon", page: 38 },
      { name: "Allemagne", page: 39 },
      { name: "Danemark", page: 39 },
      { name: "Suisse", page: 39 },
      { name: "Autriche", page: 39 },
      { name: "Italie", page: 39 },
      { name: "Espagne", page: 40 },
      { name: "Portugal", page: 40 },
      { name: "Grèce", page: 41 },
      { name: "Géorgie", page: 41 },
      { name: "Etats-Unis", page: 41 },
      { name: "Argentine", page: 41 },
      { name: "Chili", page: 41 },
      { name: "Afrique du Sud", page: 42 },
      { name: "Australie – Nouvelle-Zélande", page: 42 },
      { name: "Japon", page: 42 }
    ]
  }
];

// Canonical region order matching Premnord Livre de Cave PDF table of contents
const EFFERVESCENCES_ORDER = [
  'Champagne',
  'Bourgogne',
  'Loire',
  'Jura',
  'Savoie',
  'Bugey',
  'Jura – Savoie – Bugey',
  'Alsace',
  'Moselle',
  'Alsace et Moselle',
  'Alsace – Moselle',
  'Sud-ouest',
  'Corse',
  'Espagne',
  'Portugal',
  'Italie',
  'Etats-Unis',
  'Co-fermentations',
  'Cidres et Poirés'
];

const BLANCS_ORDER = [
  'Bourgogne – Yonne',
  'Bourgogne – Côte de Nuits',
  'Bourgogne – Côte de Beaune',
  'Bourgogne – Côte Chalonnaise',
  'Bourgogne Mâconnais',
  'Bourgogne – Mâconnais',
  'Bourgogne',
  'Beaujolais',
  'Beaujolais – Champagne',
  'Champagne',
  'Jura',
  'Bugey',
  'Jura – Bugey',
  'Savoie',
  'Isère',
  'Savoie – Isère',
  'Alsace',
  'Moselle',
  'Auvergne',
  'Alsace – Moselle – Auvergne',
  'Loire – Centre Loire',
  'Loire – Touraine',
  'Loire – Anjou',
  'Loire – Pays Nantais',
  'Loire',
  'Bordelais et Sud-Ouest',
  'Rhône Septentrional',
  'Rhône Méridional',
  'Rhône nord et sud',
  'Rhône',
  'Provence',
  'Corse',
  'Languedoc et Roussillon',
  'Corse – Languedoc – Roussillon',
  'Allemagne',
  'Suisse',
  'Autriche',
  'Italie',
  'Hongrie',
  'Espagne',
  'Portugal',
  'Slovénie',
  'Grèce',
  'Géorgie',
  'Etats-Unis',
  'Chili',
  'Argentine',
  'Afrique du Sud',
  'Australie',
  'Nouvelle-Zélande',
  'Australie – Nouvelle-Zélande',
  'Japon'
];

const ROSES_ORDER = [
  'Bourgogne – Côte d\'Or',
  'Bourgogne',
  'Rhône Méridional',
  'Rhône sud – Provence - Corse',
  'Provence',
  'Corse',
  'Provence – Corse',
  'Bordelais',
  'Espagne',
  'Afrique du Sud'
];

const ROUGES_ORDER = [
  'Bourgogne – Yonne',
  'Bourgogne – Côte de Nuits',
  'Bourgogne – Côte de Beaune',
  'Bourgogne – Côte Chalonnaise',
  'Bourgogne – Mâconnais',
  'Bourgogne Mâconnais',
  'Bourgogne',
  'Beaujolais',
  'Alsace',
  'Moselle',
  'Jura',
  'Alsace – Moselle – Jura',
  'Bugey',
  'Savoie',
  'Isère',
  'Bugey – Savoie – Isère',
  'Auvergne',
  'Loire – Centre Loire',
  'Loire – Touraine',
  'Loire – Anjou',
  'Loire – Pays Nantais',
  'Loire',
  'Auvergne – Loire',
  'Sud-ouest et Bordelais',
  'Bordelais et Sud-Ouest',
  'Rhône nord',
  'Rhône Septentrional',
  'Rhône sud',
  'Rhône Méridional',
  'Rhône',
  'Provence',
  'Corse',
  'Languedoc et Roussillon',
  'Corse – Languedoc – Roussillon',
  'Allemagne',
  'Danemark',
  'Suisse',
  'Autriche',
  'Italie',
  'Espagne',
  'Portugal',
  'Grèce',
  'Géorgie',
  'Etats-Unis',
  'Argentine',
  'Chili',
  'Afrique du Sud',
  'Australie',
  'Nouvelle-Zélande',
  'Australie – Nouvelle-Zélande',
  'Japon'
];

const getRegionOrderIndex = (regionName: string, orderArray: string[]): number => {
  const norm = (regionName || '').toLowerCase().trim();
  for (let i = 0; i < orderArray.length; i++) {
    if ((orderArray[i] || '').toLowerCase().trim() === norm) return i;
  }
  for (let i = 0; i < orderArray.length; i++) {
    const itemNorm = (orderArray[i] || '').toLowerCase().trim();
    if (norm.includes(itemNorm) || itemNorm.includes(norm)) return i;
  }
  return 999;
};

// Clean note helper to avoid printing internal stock notes, tasting sheets, or long descriptions on the wine menu
const getCleanSommelierNote = (notes?: string): string => {
  if (!notes) return '';
  const trimmed = notes.trim();
  const lower = trimmed.toLowerCase();
  
  // Exclude tasting sheets, organoleptic descriptions (Visuel, Nez, Bouche, Robe, etc.) and long internal notes
  if (
    trimmed.length > 35 ||
    lower.includes('visuel') ||
    lower.includes('nez') ||
    lower.includes('bouche') ||
    lower.includes('robe') ||
    lower.includes('attaque') ||
    lower.includes('finale') ||
    lower.includes('degustation') ||
    lower.includes('dégustation') ||
    lower.includes('importation') || 
    lower.includes('stock') || 
    lower.includes('site-') || 
    lower.includes('restaurant') ||
    lower.includes('depot') ||
    lower.includes('dépôt')
  ) {
    return '';
  }
  return trimmed;
};

// Detailed sub-region and region classifier mirroring the original Word structure
const classifyWineRegion = (wine: Wine, color: 'blanc' | 'rouge' | 'rose' | 'bulle'): string => {
  const region = (wine.region || '').toLowerCase();
  const subRegion = (wine.subRegion || '').toLowerCase();
  const appellation = (wine.appellation || '').toLowerCase();
  const name = (wine.name || '').toLowerCase();

  const textCombined = `${region} ${subRegion} ${appellation} ${name}`;
  const has = (text: string, keywords: string[]) => keywords.some(k => text.includes(k));

  const fallbackRegion = wine.region?.trim() || wine.appellation?.trim() || 'Bourgogne';

  if (color === 'bulle') {
    if (has(region, ['champagne']) || has(appellation, ['champagne']) || has(subRegion, ['champagne'])) return 'Champagne';
    if (has(region, ['bourgogne', 'burgundy']) || has(appellation, ['cremant', 'bourgogne']) || has(subRegion, ['bourgogne', 'crémant'])) return 'Bourgogne';
    if (has(region, ['loire']) || has(appellation, ['vouvray', 'montlouis', 'cremant de loire']) || has(subRegion, ['loire'])) return 'Loire';
    if (has(region, ['jura', 'savoie', 'bugey']) || has(appellation, ['jura', 'savoie', 'bugey']) || has(subRegion, ['jura', 'savoie', 'bugey'])) return 'Jura – Savoie – Bugey';
    if (has(region, ['alsace', 'moselle']) || has(subRegion, ['alsace', 'moselle'])) return 'Alsace – Moselle';
    if (has(region, ['sud-ouest', 'south-west', 'gaillac']) || has(subRegion, ['sud-ouest'])) return 'Sud-ouest';
    if (has(region, ['corse']) || has(subRegion, ['corse'])) return 'Corse';
    if (has(region, ['espagne', 'spain']) || has(appellation, ['cava']) || has(subRegion, ['espagne', 'cava'])) return 'Espagne';
    if (has(region, ['portugal']) || has(subRegion, ['portugal'])) return 'Portugal';
    if (has(region, ['italie', 'italy']) || has(appellation, ['prosecco', 'asti']) || has(subRegion, ['italie', 'prosecco'])) return 'Italie';
    if (has(region, ['etats-unis', 'usa', 'united states']) || has(subRegion, ['etats-unis', 'usa'])) return 'Etats-Unis';
    if (has(name, ['co-fermentation', 'cofermentation', 'mousses sauvages'])) return 'Co-fermentations';
    if (has(name, ['cidre', 'poire', 'biere', 'beer', 'poiré'])) return 'Cidres et Poirés';
    return fallbackRegion;
  }

  if (color === 'blanc') {
    if (has(region, ['bourgogne', 'burgundy']) || has(subRegion, ['bourgogne', 'nuits', 'beaune', 'chablis', 'chalonnaise', 'macon', 'mâcon'])) {
      if (has(appellation, ['chablis', 'yonne', 'saint-bris', 'beru', 'petit chablis']) || has(subRegion, ['chablis', 'yonne', 'auxerrois'])) return 'Bourgogne – Yonne';
      if (has(appellation, ['marsannay', 'nuits', 'morey', 'chambolle', 'gevrey', 'vosne', 'vougeot', 'hautes cotes de nuits']) || has(subRegion, ['nuits', 'côte de nuits'])) return 'Bourgogne – Côte de Nuits';
      if (has(appellation, ['meursault', 'puligny', 'chassagne', 'saint-aubin', 'beaune', 'volnay', 'pommard', 'corton', 'auxey', 'ladoix', 'savigny', 'santenay', 'maranges', 'cotes de beaune', 'romain']) || has(subRegion, ['beaune', 'côte de beaune'])) return 'Bourgogne – Côte de Beaune';
      if (has(appellation, ['rully', 'mercurey', 'givry', 'montagny', 'chalonnaise']) || has(subRegion, ['chalonnaise'])) return 'Bourgogne – Côte de Chalonnaise';
      if (has(appellation, ['macon', 'pouilly', 'vire', 'clessé', 'saint-veran', 'fuisse', 'mâcon']) || has(subRegion, ['macon', 'mâcon', 'mâconnais'])) return 'Bourgogne Mâconnais';
      return 'Bourgogne';
    }
    if (has(region, ['beaujolais']) || has(appellation, ['beaujolais']) || has(subRegion, ['beaujolais'])) return 'Beaujolais – Champagne';
    if (has(region, ['jura', 'bugey']) || has(appellation, ['arbois', 'chateau-chalon']) || has(subRegion, ['jura', 'bugey'])) return 'Jura – Bugey';
    if (has(region, ['savoie', 'isere']) || has(appellation, ['savoie', 'isere']) || has(subRegion, ['savoie', 'isere', 'isère'])) return 'Savoie – Isère';
    if (has(region, ['alsace', 'moselle', 'auvergne']) || has(appellation, ['alsace', 'moselle', 'auvergne']) || has(subRegion, ['alsace', 'moselle', 'auvergne'])) return 'Alsace – Moselle – Auvergne';
    
    if (has(region, ['loire']) || has(subRegion, ['loire', 'centre-loire', 'touraine', 'anjou', 'nantais'])) {
      if (has(appellation, ['sancerre', 'pouilly-fume', 'pouilly fume', 'menetou']) || has(subRegion, ['centre', 'sancerre'])) return 'Loire – Centre Loire';
      if (has(appellation, ['vouvray', 'cheverny', 'chinon', 'bourgueil', 'cour-cheverny']) || has(subRegion, ['touraine'])) return 'Loire – Touraine';
      if (has(appellation, ['savennieres', 'saumur', 'anjou', 'coteaux du layon']) || has(subRegion, ['anjou', 'saumur'])) return 'Loire – Anjou';
      if (has(appellation, ['muscadet', 'nantais']) || has(subRegion, ['nantais', 'muscadet'])) return 'Loire – Pays Nantais';
      return 'Loire';
    }

    if (has(region, ['bordeaux', 'bordelais', 'sud-ouest', 'south-west']) || has(appellation, ['sauternes', 'gaillac', 'tarn', 'marmandais', 'irouleguy']) || has(subRegion, ['bordeaux', 'sud-ouest'])) return 'Bordelais et Sud-Ouest';
    if (has(region, ['rhone']) || has(appellation, ['condrieu', 'joseph', 'crozes', 'hermitage', 'chateauneuf', 'vaucluse']) || has(subRegion, ['rhône', 'rhone'])) return 'Rhône nord et sud';
    if (has(region, ['provence']) || has(appellation, ['bandol', 'cassis']) || has(subRegion, ['provence'])) return 'Provence';
    if (has(region, ['corse', 'languedoc', 'roussillon']) || has(subRegion, ['corse', 'languedoc', 'roussillon'])) return 'Corse – Languedoc – Roussillon';
    if (has(textCombined, ['allemagne', 'germany', 'rheingau', 'mosel', 'pfalz', 'breuer'])) return 'Allemagne';
    if (has(region, ['suisse', 'switzerland']) || has(subRegion, ['suisse', 'valais', 'vaud'])) return 'Suisse';
    if (has(region, ['autriche', 'austria']) || has(subRegion, ['autriche', 'wachau', 'burgenland'])) return 'Autriche';
    if (has(region, ['italie', 'italy']) || has(subRegion, ['italie', 'piémont', 'piemont', 'toscane', 'sicile'])) return 'Italie';
    if (has(region, ['hongrie', 'hungary']) || has(subRegion, ['hongrie', 'tokaj'])) return 'Hongrie';
    if (has(region, ['espagne', 'spain']) || has(subRegion, ['espagne', 'rioja', 'priorat'])) return 'Espagne';
    if (has(region, ['portugal']) || has(subRegion, ['portugal', 'douro', 'dão'])) return 'Portugal';
    if (has(region, ['slovenie', 'slovenia']) || has(subRegion, ['slovénie', 'slovenie'])) return 'Slovénie';
    if (has(region, ['grece', 'greece']) || has(subRegion, ['grèce', 'grece'])) return 'Grèce';
    if (has(region, ['georgie', 'georgia']) || has(subRegion, ['géorgie', 'georgie'])) return 'Géorgie';
    if (has(region, ['etats-unis', 'usa', 'united states', 'california', 'oregon']) || has(subRegion, ['napa', 'sonoma', 'oregon', 'californie'])) return 'Etats-Unis';
    if (has(region, ['chili', 'chile']) || has(subRegion, ['chili'])) return 'Chili';
    if (has(region, ['argentine', 'argentina']) || has(subRegion, ['argentine', 'mendoza'])) return 'Argentine';
    if (has(region, ['afrique du sud', 'south africa']) || has(subRegion, ['afrique du sud', 'stellenbosch'])) return 'Afrique du Sud';
    if (has(region, ['australie', 'australia', 'nouvelle-zelande', 'new zealand']) || has(subRegion, ['australie', 'nouvelle-zélande'])) return 'Australie – Nouvelle-Zélande';
    if (has(region, ['japon', 'japan']) || has(subRegion, ['japon', 'yamanashi'])) return 'Japon';
    return fallbackRegion;
  }

  if (color === 'rose') {
    if (has(region, ['bourgogne', 'burgundy']) || has(subRegion, ['bourgogne'])) return 'Bourgogne';
    if (has(region, ['rhone', 'provence', 'corse']) || has(appellation, ['bandol', 'rhone']) || has(subRegion, ['rhône', 'provence', 'corse'])) return 'Rhône sud – Provence - Corse';
    if (has(region, ['espagne', 'spain']) || has(subRegion, ['espagne'])) return 'Espagne';
    if (has(region, ['bordeaux', 'bordelais']) || has(subRegion, ['bordeaux'])) return 'Bordelais';
    if (has(region, ['afrique du sud', 'south africa']) || has(subRegion, ['afrique du sud'])) return 'Afrique du Sud';
    return fallbackRegion;
  }

  if (color === 'rouge') {
    if (has(region, ['bourgogne', 'burgundy']) || has(subRegion, ['bourgogne', 'nuits', 'beaune', 'chablis', 'chalonnaise', 'macon', 'mâcon'])) {
      if (has(appellation, ['irancy', 'yonne']) || has(subRegion, ['yonne', 'chablis'])) return 'Bourgogne – Yonne';
      if (has(appellation, ['marsannay', 'nuits', 'morey', 'chambolle', 'gevrey', 'vosne', 'vougeot', 'echezeaux', 'romanee', 'hautes cotes de nuits']) || has(subRegion, ['nuits', 'côte de nuits'])) return 'Bourgogne – Côte de Nuits';
      if (has(appellation, ['meursault', 'puligny', 'chassagne', 'saint-aubin', 'beaune', 'volnay', 'pommard', 'corton', 'auxey', 'ladoix', 'savigny', 'santenay', 'maranges', 'cotes de beaune', 'romain']) || has(subRegion, ['beaune', 'côte de beaune'])) return 'Bourgogne – Côte de Beaune';
      if (has(appellation, ['rully', 'mercurey', 'givry', 'montagny', 'chalonnaise']) || has(subRegion, ['chalonnaise'])) return 'Bourgogne – Côte de Chalonnaise';
      if (has(appellation, ['macon', 'pouilly', 'vire', 'clessé', 'saint-veran', 'fuisse', 'mâcon']) || has(subRegion, ['macon', 'mâconnais'])) return 'Bourgogne – Mâconnais';
      return 'Bourgogne';
    }
    if (has(region, ['beaujolais']) || has(appellation, ['beaujolais', 'morgon', 'fleurie', 'brouilly', 'chiroubles', 'julienas', 'saint-amour']) || has(subRegion, ['beaujolais'])) return 'Beaujolais';
    if (has(region, ['alsace', 'moselle', 'jura']) || has(appellation, ['alsace', 'moselle', 'jura', 'arbois']) || has(subRegion, ['alsace', 'moselle', 'jura'])) return 'Alsace – Moselle – Jura';
    if (has(region, ['bugey', 'savoie', 'isere']) || has(appellation, ['bugey', 'savoie', 'isere']) || has(subRegion, ['bugey', 'savoie', 'isere', 'isère'])) return 'Bugey – Savoie – Isère';
    if (has(region, ['auvergne', 'loire']) || has(subRegion, ['auvergne', 'loire'])) return 'Auvergne – Loire';
    if (has(region, ['bordeaux', 'bordelais', 'sud-ouest', 'south-west']) || has(appellation, ['sauternes', 'gaillac', 'tarn', 'marmandais', 'irouleguy', 'pomerol', 'margaux', 'saint-emilion', 'fronsac']) || has(subRegion, ['bordeaux', 'sud-ouest'])) return 'Sud-ouest et Bordelais';
    
    if (has(region, ['rhone']) || has(subRegion, ['rhône', 'rhone'])) {
      if (has(appellation, ['joseph', 'crozes', 'hermitage', 'cornas', 'cote-rotie', 'roti']) || has(subRegion, ['nord', 'septentrional'])) return 'Rhône nord';
      return 'Rhône sud';
    }

    if (has(region, ['provence']) || has(appellation, ['bandol', 'cassis']) || has(subRegion, ['provence'])) return 'Provence';
    if (has(region, ['corse', 'languedoc', 'roussillon']) || has(subRegion, ['corse', 'languedoc', 'roussillon'])) return 'Corse – Languedoc – Roussillon';
    if (has(textCombined, ['allemagne', 'germany', 'rheingau', 'mosel', 'pfalz', 'breuer'])) return 'Allemagne';
    if (has(region, ['danemark', 'denmark']) || has(subRegion, ['danemark'])) return 'Danemark';
    if (has(region, ['suisse', 'switzerland']) || has(subRegion, ['suisse'])) return 'Suisse';
    if (has(region, ['autriche', 'austria']) || has(subRegion, ['autriche'])) return 'Autriche';
    if (has(region, ['italie', 'italy']) || has(subRegion, ['italie', 'piémont', 'toscane'])) return 'Italie';
    if (has(region, ['espagne', 'spain']) || has(subRegion, ['espagne', 'rioja'])) return 'Espagne';
    if (has(region, ['portugal']) || has(subRegion, ['portugal'])) return 'Portugal';
    if (has(region, ['grece', 'greece']) || has(subRegion, ['grèce'])) return 'Grèce';
    if (has(region, ['georgie', 'georgia']) || has(subRegion, ['géorgie'])) return 'Géorgie';
    if (has(region, ['etats-unis', 'usa', 'united states', 'california', 'oregon']) || has(subRegion, ['californie', 'oregon', 'napa'])) return 'Etats-Unis';
    if (has(region, ['argentine', 'argentina']) || has(subRegion, ['argentine'])) return 'Argentine';
    if (has(region, ['chili', 'chile']) || has(subRegion, ['chili'])) return 'Chili';
    if (has(region, ['afrique du sud', 'south africa']) || has(subRegion, ['afrique du sud'])) return 'Afrique du Sud';
    if (has(region, ['australie', 'australia', 'nouvelle-zelande', 'new zealand']) || has(subRegion, ['australie', 'nouvelle-zélande'])) return 'Australie – Nouvelle-Zélande';
    if (has(region, ['japon', 'japan']) || has(subRegion, ['japon'])) return 'Japon';
    return fallbackRegion;
  }

  return fallbackRegion;
};

// Watermark Component supporting both default compass vector and custom uploaded image
const Watermark: React.FC<{ 
  logo: string | null; 
  opacity: number; 
  scale: number; 
}> = ({ logo, opacity, scale }) => {
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none transition-all duration-300"
      style={{ opacity: opacity }}
    >
      {logo ? (
        <img 
          src={logo} 
          alt="Filigrane personnalisé" 
          className="object-contain"
          style={{ width: `${scale}%`, height: `${scale}%`, maxWidth: '550px', maxHeight: '550px' }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <svg 
          viewBox="0 0 400 400" 
          className="text-[#A4513C] fill-none stroke-current" 
          strokeWidth="1.2"
          style={{ width: `${scale}%`, height: `${scale}%`, maxWidth: '500px', maxHeight: '500px' }}
        >
          <circle cx="200" cy="200" r="140" strokeDasharray="3 3" />
          <circle cx="200" cy="200" r="110" />
          <circle cx="200" cy="200" r="50" />
          <circle cx="200" cy="200" r="20" />
          
          {/* Radial Compasses */}
          <line x1="200" y1="30" x2="200" y2="370" strokeDasharray="2 2" />
          <line x1="30" y1="200" x2="370" y2="200" strokeDasharray="2 2" />
          <line x1="80" y1="80" x2="320" y2="320" strokeDasharray="2 2" />
          <line x1="80" y1="320" x2="320" y2="80" strokeDasharray="2 2" />
          
          {/* Wine Glasses */}
          <g transform="translate(200, 52) scale(0.65)" strokeWidth="2.2">
            <path d="M-12,-15 C-12,5 12,5 12,-15 Z" />
            <line x1="0" y1="0" x2="0" y2="25" />
            <line x1="-8" y1="25" x2="8" y2="25" />
          </g>
          <g transform="translate(200, 348) rotate(180) scale(0.65)" strokeWidth="2.2">
            <path d="M-12,-15 C-12,5 12,5 12,-15 Z" />
            <line x1="0" y1="0" x2="0" y2="25" />
            <line x1="-8" y1="25" x2="8" y2="25" />
          </g>
          <g transform="translate(348, 200) rotate(90) scale(0.65)" strokeWidth="2.2">
            <path d="M-12,-15 C-12,5 12,5 12,-15 Z" />
            <line x1="0" y1="0" x2="0" y2="25" />
            <line x1="-8" y1="25" x2="8" y2="25" />
          </g>
          <g transform="translate(52, 200) rotate(-90) scale(0.65)" strokeWidth="2.2">
            <path d="M-12,-15 C-12,5 12,5 12,-15 Z" />
            <line x1="0" y1="0" x2="0" y2="25" />
            <line x1="-8" y1="25" x2="8" y2="25" />
          </g>
          
          {/* Forks */}
          <g transform="translate(304, 96) rotate(45) scale(0.6)" strokeWidth="2.2">
            <path d="M-6,-20 L-6,0 C-6,6 6,6 6,0 L6,-20 M-2,-20 L-2,0 M2,-20 L2,0" />
            <line x1="0" y1="4" x2="0" y2="28" />
          </g>
          <g transform="translate(304, 304) rotate(135) scale(0.6)" strokeWidth="2.2">
            <path d="M-6,-20 L-6,0 C-6,6 6,6 6,0 L6,-20 M-2,-20 L-2,0 M2,-20 L2,0" />
            <line x1="0" y1="4" x2="0" y2="28" />
          </g>
          <g transform="translate(96, 304) rotate(225) scale(0.6)" strokeWidth="2.2">
            <path d="M-6,-20 L-6,0 C-6,6 6,6 6,0 L6,-20 M-2,-20 L-2,0 M2,-20 L2,0" />
            <line x1="0" y1="4" x2="0" y2="28" />
          </g>
          <g transform="translate(96, 96) rotate(315) scale(0.6)" strokeWidth="2.2">
            <path d="M-6,-20 L-6,0 C-6,6 6,6 6,0 L6,-20 M-2,-20 L-2,0 M2,-20 L2,0" />
            <line x1="0" y1="4" x2="0" y2="28" />
          </g>
        </svg>
      )}
    </div>
  );
};

export interface WineMenuDocumentStyleProps {
  onSelectWine?: (wine: Wine) => void;
}

export const WineMenuDocumentStyle: React.FC<WineMenuDocumentStyleProps> = ({ onSelectWine }) => {
  const { wines, sites, watermarkLogo, updateWatermarkLogo, updateWine } = useFirebase();
  const [filterMode, setFilterMode] = useState<'salle' | 'all'>('salle');
  const [stockFilterMode, setStockFilterMode] = useState<'in_stock' | 'all'>('in_stock');
  const [editVisibilityMode, setEditVisibilityMode] = useState<boolean>(false);
  const [showStockBadges, setShowStockBadges] = useState<boolean>(false);
  const [excludeSpirits, setExcludeSpirits] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFormat, setViewFormat] = useState<'paginated' | 'printall'>('paginated');
  const [activePage, setActivePage] = useState<number>(1);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.045);
  const [watermarkScale, setWatermarkScale] = useState<number>(75);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [showIframePrintHelp, setShowIframePrintHelp] = useState<boolean>(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const handleWatermarkUpload = (file: File) => {
    setUploadError(null);
    setSuccessMsg(null);

    if (!file.type.match('image/.*')) {
      setUploadError("Le fichier doit être une image (PNG, JPG, SVG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError("Erreur lors de la lecture du fichier.");
    };

    reader.onload = (event) => {
      const resultStr = event.target?.result as string;

      if (file.type === 'image/svg+xml') {
        if (resultStr.length > 300000) {
          setUploadError("Le fichier SVG est trop volumineux (max 300 Ko).");
          return;
        }
        updateWatermarkLogo(resultStr)
          .then(() => {
            setSuccessMsg("Filigrane SVG importé avec succès !");
            setTimeout(() => setSuccessMsg(null), 3000);
          })
          .catch(() => {
            setUploadError("Échec de la sauvegarde sur le serveur.");
          });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        setUploadError("Fichier image corrompu.");
      };

      img.onload = () => {
        const maxDim = 500;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            updateWatermarkLogo(resultStr);
            setSuccessMsg("Filigrane mis à jour.");
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/png');

          updateWatermarkLogo(compressedBase64)
            .then(() => {
              setSuccessMsg("Filigrane mis à jour avec succès !");
              setTimeout(() => setSuccessMsg(null), 3000);
            })
            .catch(() => {
              setUploadError("Impossible de synchroniser avec le serveur.");
            });
        } catch (e) {
          setUploadError("Erreur de compression.");
        }
      };
      img.src = resultStr;
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleWatermarkUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleWatermarkUpload(file);
    }
  };

  const handleResetWatermark = async () => {
    if (window.confirm("Voulez-vous supprimer le filigrane personnalisé et restaurer le compas d'origine ?")) {
      try {
        await updateWatermarkLogo(null);
        setSuccessMsg("Filigrane d'origine restauré.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (e) {
        setUploadError("Erreur lors de la réinitialisation.");
      }
    }
  };

  // 1. Structure d'une référence couplée 75cl / 150cl (Magnum) conforme au Livre de Cave fait main
  interface CoupledWineReference {
    id: string;
    name: string;
    domain: string;
    appellation?: string;
    cuvee?: string;
    vintage: string;
    color: string;
    notes?: string;
    wine75?: Wine;
    wine150?: Wine;
    price75?: number;
    price150?: number;
    stock75: number;
    stock150: number;
    totalStock: number;
    hideFromMenu: boolean;
    isPreSale: boolean;
    region: string;
    subRegion?: string;
  }

  // 2. Consolidation & Couplage 75cl / 150cl depuis l'inventaire en direct
  const coupledWines = useMemo<CoupledWineReference[]>(() => {
    const map = new Map<string, CoupledWineReference>();

    wines.forEach(w => {
      // Périmètre de site : Salle (Sites 1 à 4) ou Cave Entière
      if (filterMode === 'salle' && w.siteId && !['site-1', 'site-2', 'site-3', 'site-4'].includes(w.siteId)) {
        return;
      }

      // Exclusion explicite des spiritueux, digestifs, softs et boissons hors-vin (demandé par l'oncle)
      if (excludeSpirits && isSpiritOrSoft(w)) {
        return;
      }

      const domain = getCanonicalDomain(w.domain);
      const color = w.color || 'blanc';
      const vintage = (w.vintage || 'S.A.').toString().trim();
      const isMag = isMagnum(w) || (w.format || '').toLowerCase().includes('150') || (w.format || '').toLowerCase().includes('mag');

      // Nettoie la mention (Magnum) ou (150cl) dans le nom pour coupler avec la bouteille 75cl
      const cleanName = (w.name || '')
        .replace(/\s*\((?:150cl|150\s*cl|magnum|mag|1\.5l|1,5l)\)/gi, '')
        .replace(/\s*–\s*magnum/gi, '')
        .replace(/\s*-\s*magnum/gi, '')
        .trim();

      const key = `${domain.toLowerCase()}_${cleanName.toLowerCase()}_${vintage.toLowerCase()}_${color}`;

      if (!map.has(key)) {
        map.set(key, {
          id: w.id,
          name: cleanName || w.name,
          domain,
          appellation: w.appellation,
          cuvee: w.cuvee,
          vintage,
          color,
          notes: w.notes,
          wine75: isMag ? undefined : w,
          wine150: isMag ? w : undefined,
          price75: isMag ? undefined : w.priceSell,
          price150: isMag ? w.priceSell : undefined,
          stock75: isMag ? 0 : (w.quantity || 0),
          stock150: isMag ? (w.quantity || 0) : 0,
          totalStock: w.quantity || 0,
          hideFromMenu: !!w.hideFromMenu,
          isPreSale: !!w.isPreSale,
          region: w.region || '',
          subRegion: w.subRegion || ''
        });
      } else {
        const entry = map.get(key)!;
        if (isMag) {
          if (!entry.wine150) {
            entry.wine150 = w;
            entry.price150 = w.priceSell;
          } else if (w.priceSell && !entry.price150) {
            entry.price150 = w.priceSell;
          }
          entry.stock150 += (w.quantity || 0);
        } else {
          if (!entry.wine75) {
            entry.wine75 = w;
            entry.price75 = w.priceSell;
          } else if (w.priceSell && !entry.price75) {
            entry.price75 = w.priceSell;
          }
          entry.stock75 += (w.quantity || 0);
        }
        entry.totalStock += (w.quantity || 0);
        if (w.isPreSale) entry.isPreSale = true;
        // Si l'un des formats est affiché, la référence est considérée active
        if (!w.hideFromMenu) entry.hideFromMenu = false;
      }
    });

    return Array.from(map.values());
  }, [wines, filterMode, excludeSpirits]);

  // 3. Filtrage dynamique selon le stock et les préférences Sommelier (Afficher / Masquer)
  const filteredWines = useMemo<CoupledWineReference[]>(() => {
    return coupledWines.filter(cw => {
      // Masquer les références désactivées (sauf en mode édition où le sommelier peut les réactiver)
      if (cw.hideFromMenu && !editVisibilityMode) return false;

      // Filtre de stock
      if (stockFilterMode === 'in_stock') {
        if (cw.totalStock <= 0 && !cw.isPreSale) return false;
      }

      // Recherche libre si saisie dans le menu
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          cw.name.toLowerCase().includes(q) ||
          cw.domain.toLowerCase().includes(q) ||
          (cw.appellation || '').toLowerCase().includes(q) ||
          cw.vintage.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [coupledWines, editVisibilityMode, stockFilterMode, searchQuery]);

  // 4. Regroupement par classification canonique pour le Livre de Cave
  const structuredData = useMemo(() => {
    const data = {
      dpr: {
        blanc: [] as CoupledWineReference[],
        rose: [] as CoupledWineReference[],
        rouge: [] as CoupledWineReference[],
      },
      bulle: {} as { [region: string]: CoupledWineReference[] },
      blanc: {} as { [region: string]: CoupledWineReference[] },
      rose: {} as { [region: string]: CoupledWineReference[] },
      rouge: {} as { [region: string]: CoupledWineReference[] },
    };

    filteredWines.forEach(cw => {
      const isDPR = getCanonicalDomain(cw.domain) === 'Domaine Prieuré-Roch';
      const color = cw.color || 'blanc';
      // Objet vin simplifié pour classification régionale
      const wineForClass = (cw.wine75 || cw.wine150 || {
        name: cw.name,
        domain: cw.domain,
        appellation: cw.appellation,
        region: cw.region,
        subRegion: cw.subRegion,
        color: cw.color
      }) as Wine;

      if (isDPR) {
        if (color === 'rose') {
          data.dpr.rose.push(cw);
        } else if (color === 'rouge') {
          data.dpr.rouge.push(cw);
        } else {
          data.dpr.blanc.push(cw);
        }
      } else {
        if (color === 'bulle' || color === 'cidre_biere') {
          const reg = classifyWineRegion(wineForClass, 'bulle');
          if (!data.bulle[reg]) data.bulle[reg] = [];
          data.bulle[reg].push(cw);
        } else if (color === 'rose') {
          const reg = classifyWineRegion(wineForClass, 'rose');
          if (!data.rose[reg]) data.rose[reg] = [];
          data.rose[reg].push(cw);
        } else if (color === 'rouge') {
          const reg = classifyWineRegion(wineForClass, 'rouge');
          if (!data.rouge[reg]) data.rouge[reg] = [];
          data.rouge[reg].push(cw);
        } else if (!isSpiritOrSoft(wineForClass)) {
          const reg = classifyWineRegion(wineForClass, 'blanc');
          if (!data.blanc[reg]) data.blanc[reg] = [];
          data.blanc[reg].push(cw);
        }
      }
    });

    const sortWines = (a: CoupledWineReference, b: CoupledWineReference) => {
      const yearA = parseInt(a.vintage || '0') || 0;
      const yearB = parseInt(b.vintage || '0') || 0;
      if (yearA !== yearB) return yearB - yearA;
      return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
    };

    data.dpr.blanc.sort(sortWines);
    data.dpr.rose.sort(sortWines);
    data.dpr.rouge.sort(sortWines);

    const sortSubRegions = (obj: { [key: string]: CoupledWineReference[] }) => {
      Object.keys(obj).forEach(key => {
        obj[key].sort(sortWines);
      });
    };

    sortSubRegions(data.bulle);
    sortSubRegions(data.blanc);
    sortSubRegions(data.rose);
    sortSubRegions(data.rouge);

    return data;
  }, [filteredWines]);

  // Regroupement des références couplées par Domaine
  const getWinesByDomain = (winesList: CoupledWineReference[]) => {
    const groups: { [domain: string]: CoupledWineReference[] } = {};
    winesList.forEach(cw => {
      const dom = cw.domain?.trim() || 'Domaine Inconnu';
      if (!groups[dom]) groups[dom] = [];
      groups[dom].push(cw);
    });
    return groups;
  };

  // Rendu exact d'une ligne de vin conforme au Livre de Cave de l'Oncle :
  // [Millésime à gauche] [Appellation & "Cuvée"] [Prix 75cl] [Prix 150cl (Magnum)]
  const renderWineLine = (cw: CoupledWineReference) => {
    const vintage = cw.vintage || 'S.A.';
    const cleanNote = getCleanSommelierNote(cw.notes);
    const hasAsterisk = vintage.includes('*') || cleanNote.includes('*');
    const cleanVintage = (vintage || '').replace('*', '').trim();

    const p75Str = formatDocPrice(cw.price75);
    const p150Str = formatDocPrice(cw.price150);
    const displayTitle = formatWineDisplayTitle(cw.name, cw.cuvee);

    return (
      <div 
        key={cw.id} 
        onClick={() => {
          const target = cw.wine75 || cw.wine150;
          if (target && onSelectWine && !editVisibilityMode) {
            onSelectWine(target);
          }
        }}
        className={`py-0.5 font-sans text-[12.5px] sm:text-[13px] text-[#334552] border-b border-stone-100/20 break-inside-avoid transition-all ${
          onSelectWine && !editVisibilityMode ? 'cursor-pointer hover:bg-stone-50/80 rounded px-1 -mx-1' : ''
        } ${
          cw.hideFromMenu ? 'opacity-40 bg-stone-100/60 rounded px-1' : ''
        }`}
        title={onSelectWine && !editVisibilityMode ? "Cliquer pour voir la fiche détaillée du vin" : undefined}
      >
        <div className="flex items-baseline w-full justify-between gap-1">
          {/* Bouton œil Sommelier pour afficher/masquer en 1 clic (Écran uniquement) */}
          {editVisibilityMode && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                const newHidden = !cw.hideFromMenu;
                if (cw.wine75) await updateWine(cw.wine75.id, { hideFromMenu: newHidden }, 'edit');
                if (cw.wine150) await updateWine(cw.wine150.id, { hideFromMenu: newHidden }, 'edit');
              }}
              className="mr-2 p-1 text-stone-400 hover:text-stone-900 rounded print:hidden transition-colors cursor-pointer shrink-0"
              title={cw.hideFromMenu ? "Afficher sur la carte" : "Masquer de la carte"}
            >
              {cw.hideFromMenu ? (
                <EyeOff className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </button>
          )}

          {/* 1. Colonne de Gauche : Millésime (ex: 2023, N.M, 2015*, S.A.) */}
          <div className="w-14 sm:w-16 shrink-0 font-mono text-[12px] sm:text-[12.5px] font-semibold text-[#334552]/85 italic">
            {cleanVintage}{hasAsterisk ? '*' : ''}
          </div>

          {/* 2. Colonne Centrale : Appellation & Cuvée (entre guillemets) */}
          <div className="flex items-baseline flex-grow min-w-0 pr-2 relative">
            <span className="font-semibold text-[#334552] leading-snug">
              {displayTitle}
            </span>
            {cleanNote && (
              <span className="ml-1.5 text-[10.5px] text-stone-400 font-sans italic">
                {cleanNote.startsWith('Dgt') ? ` – ${cleanNote}` : ` (${cleanNote})`}
              </span>
            )}
            {/* Badge de stock direct à l'écran si activé (masqué à l'impression PDF) */}
            {showStockBadges && (
              <span className="ml-2 px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-mono font-bold print:hidden">
                {cw.stock75 > 0 ? `${cw.stock75} bt (75)` : ''}
                {cw.stock75 > 0 && cw.stock150 > 0 ? ' • ' : ''}
                {cw.stock150 > 0 ? `${cw.stock150} mag (150)` : ''}
                {cw.totalStock === 0 ? '0 bt (Rupture)' : ''}
              </span>
            )}
          </div>

          {/* 3. Double colonne de prix alignée à droite avec espacement naturel Word (zéro pointillés) */}
          <div className="flex items-baseline gap-3 shrink-0 font-mono text-[13px] ml-auto">
            <span className="font-bold text-[#334552] w-16 text-right pr-1">
              {p75Str}
            </span>
            <span className="font-bold text-[#334552] w-16 text-right pr-1">
              {p150Str}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper pour afficher un groupe de sous-région avec les titres de Domaines
  const renderSubRegionGroup = (subRegionName: string, winesList: CoupledWineReference[]) => {
    if (!winesList || winesList.length === 0) return null;
    const domainGroups = getWinesByDomain(winesList);

    return (
      <div key={subRegionName} className="mb-6 break-inside-avoid">
        <h4 className="text-[#A4513C] font-sans font-bold tracking-[0.12em] text-[13px] uppercase border-b border-[#A4513C]/20 pb-0.5 mb-3 mt-4 text-left">
          {subRegionName}
        </h4>
        
        {Object.entries(domainGroups).map(([domainName, domainWines]) => (
          <div key={domainName} className="mb-4 pl-0.5 break-inside-avoid">
            <div className="flex items-center justify-between mb-1">
              <h5 className="font-sans font-bold text-[#554039] text-[14.5px] sm:text-[15px] tracking-tight">
                {domainName}
              </h5>
              {editVisibilityMode && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const allHidden = domainWines.every(cw => cw.hideFromMenu);
                    const newHidden = !allHidden;
                    for (const cw of domainWines) {
                      if (cw.wine75) await updateWine(cw.wine75.id, { hideFromMenu: newHidden }, 'edit');
                      if (cw.wine150) await updateWine(cw.wine150.id, { hideFromMenu: newHidden }, 'edit');
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-sans font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 print:hidden transition-colors cursor-pointer flex items-center gap-1 border border-stone-200"
                  title="Afficher ou masquer toutes les bouteilles de ce domaine en un clic"
                >
                  {domainWines.every(cw => cw.hideFromMenu) ? (
                    <>
                      <EyeOff className="w-3 h-3 text-rose-500" />
                      <span className="text-rose-600 font-semibold">Tout masqué</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-emerald-600" />
                      <span>Tout masquer</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {domainWines.map(renderWineLine)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- PAGE RENDERING MODULES ---

  // Page 1: Couverture (Cover Page)
  const renderCoverPage = () => (
    <div className="flex flex-col justify-between items-center h-full text-center py-[22mm] relative z-10 select-none">
      <div className="mt-6 flex flex-col items-center">
        {/* Blason / Logo officiel Premnord */}
        <div className="mb-6">
          <PremnordLogo size={56} color="#A4513C" />
        </div>
        <h1 className="text-[#A4513C] font-sans font-black tracking-[0.25em] text-4xl sm:text-5xl uppercase">
          PREMNORD
        </h1>
        <div className="w-16 h-[2px] bg-[#A4513C]/40 mx-auto mt-4" />
        <h2 className="text-[#A4513C] font-sans font-semibold tracking-[0.25em] text-lg sm:text-xl uppercase mt-4">
          LIVRE DE CAVE
        </h2>
      </div>

      <div className="flex flex-col items-center my-6">
        <div className="w-12 h-[1px] bg-[#A4513C]/30 my-3" />
        <p className="font-sans italic text-stone-400 text-xs tracking-wider">
          Restaurant Premnord &bull; Bourgogne
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 px-6 text-[10px] font-sans tracking-[0.05em] uppercase text-stone-400">
        <p className="font-medium text-stone-500">Prix nets, service compris</p>
        <p className="text-[8.5px] leading-relaxed max-w-xs mx-auto">
          L'abus d'alcool est dangereux pour la santé, à consommer avec modération
        </p>
      </div>
    </div>
  );

  // Page 2: Table des Matières (Index officiel fidèle au document Word de l'oncle)
  const renderTOCPage = () => {
    const col1 = [OFFICIAL_TOC[0], OFFICIAL_TOC[1], OFFICIAL_TOC[2]];
    const col2 = [OFFICIAL_TOC[3], OFFICIAL_TOC[4]];

    return (
      <div className="flex flex-col justify-between h-full py-[6mm] relative z-10 px-[3mm] sm:px-[5mm]">
        <div>
          <h2 className="text-center text-[#A4513C] font-sans font-black tracking-[0.25em] text-xl sm:text-2xl uppercase border-b border-[#A4513C]/20 pb-3 mb-5">
            SOMMAIRE DU LIVRE DE CAVE
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-w-2xl mx-auto">
            {/* Colonne 1 : Domaine Prieuré Roch, Effervescences, Vins Blancs */}
            <div className="space-y-4">
              {col1.map((sec) => (
                <div key={sec.title} className="space-y-1">
                  <div
                    onClick={() => viewFormat === 'paginated' && setActivePage(sec.targetPage)}
                    className="flex items-baseline justify-between border-b border-[#A4513C]/20 pb-0.5 cursor-pointer group"
                  >
                    <h3 className="font-sans font-black text-[#A4513C] text-[12px] sm:text-[12.5px] uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                      {sec.title}
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-[#A4513C]">
                      p.{sec.page}
                    </span>
                  </div>
                  {sec.subItems && sec.subItems.length > 0 && (
                    <div className="space-y-0.5 pl-1.5 pt-0.5">
                      {sec.subItems.map((sub) => (
                        <div
                          key={sub.name}
                          onClick={() => viewFormat === 'paginated' && setActivePage(sec.targetPage)}
                          className="flex items-baseline justify-between py-0.2 text-[10.5px] text-[#334552] hover:text-[#A4513C] cursor-pointer group transition-colors"
                        >
                          <span className="truncate pr-1 group-hover:font-medium">{sub.name}</span>
                          <span className="flex-grow border-b border-dotted border-stone-300 mx-1 self-baseline h-1" />
                          <span className="font-mono text-[9.5px] text-stone-500 font-semibold shrink-0">
                            p.{sub.page}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Colonne 2 : Vins Rosés, Vins Rouges */}
            <div className="space-y-4">
              {col2.map((sec) => (
                <div key={sec.title} className="space-y-1">
                  <div
                    onClick={() => viewFormat === 'paginated' && setActivePage(sec.targetPage)}
                    className="flex items-baseline justify-between border-b border-[#A4513C]/20 pb-0.5 cursor-pointer group"
                  >
                    <h3 className="font-sans font-black text-[#A4513C] text-[12px] sm:text-[12.5px] uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                      {sec.title}
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-[#A4513C]">
                      p.{sec.page}
                    </span>
                  </div>
                  {sec.subItems && sec.subItems.length > 0 && (
                    <div className="space-y-0.5 pl-1.5 pt-0.5">
                      {sec.subItems.map((sub) => (
                        <div
                          key={sub.name}
                          onClick={() => viewFormat === 'paginated' && setActivePage(sec.targetPage)}
                          className="flex items-baseline justify-between py-0.2 text-[10.5px] text-[#334552] hover:text-[#A4513C] cursor-pointer group transition-colors"
                        >
                          <span className="truncate pr-1 group-hover:font-medium">{sub.name}</span>
                          <span className="flex-grow border-b border-dotted border-stone-300 mx-1 self-baseline h-1" />
                          <span className="font-mono text-[9.5px] text-stone-500 font-semibold shrink-0">
                            p.{sub.page}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-stone-100 flex justify-between items-baseline font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.2</span>
        </div>
      </div>
    );
  };

  // Page 3: Domaine Prieuré Roch Page
  const renderDPRPage = () => {
    const bWines = structuredData.dpr.blanc;
    const rRoseWines = structuredData.dpr.rose;
    const rRougeWines = structuredData.dpr.rouge;
    const totalDPRCount = bWines.length + rRoseWines.length + rRougeWines.length;

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="text-center mb-8">
            <h2 className="text-[#A4513C] font-sans font-medium tracking-[0.25em] text-xl sm:text-2xl uppercase leading-tight">
              DOMAINE PRIEURE ROCH
            </h2>
            <p className="text-stone-400 font-sans italic text-[11px] mt-1.5 tracking-wide">
              Par Henry-Frédéric Roch depuis 1988
            </p>
            <div className="w-12 h-[1px] bg-[#A4513C]/30 mx-auto mt-4" />
          </div>

          {totalDPRCount === 0 ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence du Domaine Prieuré Roch disponible actuellement.
            </p>
          ) : (
            <div className="space-y-6 pr-1">
              {/* Blancs */}
              {bWines.length > 0 && (
                <div>
                  <h3 className="text-[#A4513C] font-sans font-bold tracking-[0.1em] text-[12px] uppercase border-b border-[#A4513C]/20 pb-0.5 mb-2 italic">
                    Blancs
                  </h3>
                  <div className="space-y-0.5">
                    {bWines.map(renderWineLine)}
                  </div>
                </div>
              )}

              {/* Rosés */}
              {rRoseWines.length > 0 && (
                <div>
                  <h3 className="text-[#A4513C] font-sans font-bold tracking-[0.1em] text-[12px] uppercase border-b border-[#A4513C]/20 pb-0.5 mb-2 italic">
                    Rosés
                  </h3>
                  <div className="space-y-0.5">
                    {rRoseWines.map(renderWineLine)}
                  </div>
                </div>
              )}

              {/* Rouges */}
              {rRougeWines.length > 0 && (
                <div>
                  <h3 className="text-[#A4513C] font-sans font-bold tracking-[0.1em] text-[12px] uppercase border-b border-[#A4513C]/20 pb-0.5 mb-2 italic">
                    Rouges
                  </h3>
                  <div className="space-y-0.5">
                    {rRougeWines.map(renderWineLine)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend footnotes typical of great cellars */}
        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé • * Limité à 1 flacon / table</span>
          <span className="font-mono font-bold">p.3</span>
        </div>
      </div>
    );
  };

  // Page 4: Effervescences Page
  const renderEffervescencesPage = () => {
    const categories = Object.keys(structuredData.bulle).sort((a, b) => 
      getRegionOrderIndex(a, EFFERVESCENCES_ORDER) - getRegionOrderIndex(b, EFFERVESCENCES_ORDER)
    );
    const hasAny = categories.some(cat => structuredData.bulle[cat].length > 0);

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="text-center mb-6">
            <h2 className="text-[#A4513C] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              EFFERVESCENCES
            </h2>
            <div className="w-10 h-[1px] bg-[#A4513C]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence effervescente disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.bulle[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.6</span>
        </div>
      </div>
    );
  };

  // Page 5: Vins Blancs Page
  const renderBlancsPage = () => {
    const categories = Object.keys(structuredData.blanc).sort((a, b) => 
      getRegionOrderIndex(a, BLANCS_ORDER) - getRegionOrderIndex(b, BLANCS_ORDER)
    );
    const hasAny = categories.some(cat => structuredData.blanc[cat].length > 0);

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="text-center mb-6">
            <h2 className="text-[#A4513C] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS BLANCS
            </h2>
            <div className="w-10 h-[1px] bg-[#A4513C]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin blanc disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.blanc[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.10</span>
        </div>
      </div>
    );
  };

  // Page 6: Vins Rosés Page
  const renderRosesPage = () => {
    const categories = Object.keys(structuredData.rose).sort((a, b) => 
      getRegionOrderIndex(a, ROSES_ORDER) - getRegionOrderIndex(b, ROSES_ORDER)
    );
    const hasAny = categories.some(cat => structuredData.rose[cat].length > 0);

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="text-center mb-6">
            <h2 className="text-[#A4513C] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS ROSÉS
            </h2>
            <div className="w-10 h-[1px] bg-[#A4513C]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin rosé disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.rose[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.25</span>
        </div>
      </div>
    );
  };

  // Page 7: Vins Rouges Page
  const renderRougesPage = () => {
    const categories = Object.keys(structuredData.rouge).sort((a, b) => 
      getRegionOrderIndex(a, ROUGES_ORDER) - getRegionOrderIndex(b, ROUGES_ORDER)
    );
    const hasAny = categories.some(cat => structuredData.rouge[cat].length > 0);

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="text-center mb-6">
            <h2 className="text-[#A4513C] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS ROUGES
            </h2>
            <div className="w-10 h-[1px] bg-[#A4513C]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin rouge disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.rouge[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.26</span>
        </div>
      </div>
    );
  };

  // Dispatch appropriate active page view
  const renderPageContent = (pageNum: number) => {
    switch (pageNum) {
      case 1: return renderCoverPage();
      case 2: return renderTOCPage();
      case 3: return renderDPRPage();
      case 4: return renderEffervescencesPage();
      case 5: return renderBlancsPage();
      case 6: return renderRosesPage();
      case 7: return renderRougesPage();
      default: return renderCoverPage();
    }
  };

  // Génération du document HTML complet autonome pour un export PDF / impression 100% fidèle au document Word
  const generatePrintHtml = (): string => {
    const watermarkSvg = watermarkLogo ? `
      <img src="${watermarkLogo}" alt="Filigrane" style="width: ${watermarkScale * 5}px; max-width: 80vw; max-height: 80vh; object-fit: contain;" />
    ` : `
      <svg viewBox="0 0 400 400" fill="none" stroke="#A4513C" stroke-width="1.2" style="width: ${watermarkScale * 5}px; max-width: 500px; max-height: 500px;">
        <circle cx="200" cy="200" r="140" stroke-dasharray="3 3" />
        <circle cx="200" cy="200" r="110" />
        <circle cx="200" cy="200" r="50" />
        <circle cx="200" cy="200" r="20" />
        <line x1="200" y1="30" x2="200" y2="370" stroke-dasharray="2 2" />
        <line x1="30" y1="200" x2="370" y2="200" stroke-dasharray="2 2" />
        <line x1="80" y1="80" x2="320" y2="320" stroke-dasharray="2 2" />
        <line x1="80" y1="320" x2="320" y2="80" stroke-dasharray="2 2" />
      </svg>
    `;

    const renderWineLineHtml = (cw: CoupledWineReference) => {
      const vintage = cw.vintage || 'S.A.';
      const cleanNote = getCleanSommelierNote(cw.notes);
      const hasAsterisk = vintage.includes('*') || cleanNote.includes('*');
      const cleanVintage = (vintage || '').replace('*', '').trim();
      const p75Str = formatDocPrice(cw.price75);
      const p150Str = formatDocPrice(cw.price150);
      const displayTitle = formatWineDisplayTitle(cw.name, cw.cuvee);

      return `
        <div class="wine-line">
          <div class="wine-vintage">${cleanVintage}${hasAsterisk ? '*' : ''}</div>
          <div class="wine-title">
            <span>${displayTitle}</span>
            ${cleanNote ? `<span class="wine-note">${cleanNote.startsWith('Dgt') ? ` – ${cleanNote}` : ` (${cleanNote})`}</span>` : ''}
          </div>
          <div class="wine-prices">
            <span class="price-col">${p75Str}</span>
            <span class="price-col">${p150Str}</span>
          </div>
        </div>
      `;
    };

    const renderSubRegionGroupHtml = (subRegionName: string, winesList: CoupledWineReference[]) => {
      const visibleWines = winesList.filter(w => !w.hideFromMenu);
      if (!visibleWines || visibleWines.length === 0) return '';
      const domainGroups = getWinesByDomain(visibleWines);

      let groupHtml = `
        <div class="subregion-block">
          <h4 class="subregion-title">${subRegionName}</h4>
      `;

      Object.entries(domainGroups).forEach(([domainName, domainWines]) => {
        const visibleDomainWines = domainWines.filter(w => !w.hideFromMenu);
        if (visibleDomainWines.length === 0) return;
        groupHtml += `
          <div class="domain-block">
            <h5 class="domain-title">${domainName}</h5>
            <div class="wine-lines-list">
              ${visibleDomainWines.map(renderWineLineHtml).join('')}
            </div>
          </div>
        `;
      });

      groupHtml += `</div>`;
      return groupHtml;
    };

    const bWines = structuredData.dpr.blanc.filter(w => !w.hideFromMenu);
    const rRoseWines = structuredData.dpr.rose.filter(w => !w.hideFromMenu);
    const rRougeWines = structuredData.dpr.rouge.filter(w => !w.hideFromMenu);

    const effCategories = Object.keys(structuredData.bulle).sort((a, b) => 
      getRegionOrderIndex(a, EFFERVESCENCES_ORDER) - getRegionOrderIndex(b, EFFERVESCENCES_ORDER)
    );
    const blancCategories = Object.keys(structuredData.blanc).sort((a, b) => 
      getRegionOrderIndex(a, BLANCS_ORDER) - getRegionOrderIndex(b, BLANCS_ORDER)
    );
    const roseCategories = Object.keys(structuredData.rose).sort((a, b) => 
      getRegionOrderIndex(a, ROSES_ORDER) - getRegionOrderIndex(b, ROSES_ORDER)
    );
    const rougeCategories = Object.keys(structuredData.rouge).sort((a, b) => 
      getRegionOrderIndex(a, ROUGES_ORDER) - getRegionOrderIndex(b, ROUGES_ORDER)
    );

    const col1 = [OFFICIAL_TOC[0], OFFICIAL_TOC[1], OFFICIAL_TOC[2]];
    const col2 = [OFFICIAL_TOC[3], OFFICIAL_TOC[4]];

    const renderTocColHtml = (sections: TocSection[]) => {
      return sections.map(sec => `
        <div style="margin-bottom: 16px;">
          <div class="toc-section-head">
            <span class="toc-title">${sec.title}</span>
            <span class="toc-pnum">p.${sec.page}</span>
          </div>
          ${sec.subItems && sec.subItems.length > 0 ? `
            <div style="padding-left: 6px;">
              ${sec.subItems.map(sub => `
                <div class="toc-item">
                  <span>${sub.name}</span>
                  <span class="toc-dots"></span>
                  <span class="toc-item-pnum">p.${sub.page}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('');
    };

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Premnord — Livre de Cave</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #334552;
      background-color: #FAF9F5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen {
      .print-toolbar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        background: #1c1917;
        color: white;
        padding: 14px 28px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10000;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      }
      .btn-print {
        background: #A4513C;
        color: white;
        font-weight: 700;
        font-size: 13px;
        padding: 9px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 6px rgba(164, 81, 60, 0.4);
        transition: background 0.15s;
      }
      .btn-print:hover { background: #8e4331; }
      .btn-close {
        background: transparent;
        color: #a8a29e;
        border: 1px solid #57534e;
        padding: 7px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }
      .btn-close:hover { color: white; border-color: #78716c; }
      .tip-text { font-size: 11px; color: #d6d3d1; }
      .book-container {
        max-width: 820px;
        margin: 30px auto;
        background: white;
        box-shadow: 0 8px 30px rgba(0,0,0,0.08);
        border-radius: 12px;
        padding: 50px 60px;
        position: relative;
      }
      .page-break {
        border-bottom: 2px dashed #e7e5e4;
        margin: 45px 0;
        position: relative;
      }
      .page-break::after {
        content: 'Saut de page';
        position: absolute;
        right: 0;
        top: -10px;
        background: #f5f5f4;
        color: #a8a29e;
        font-size: 10px;
        padding: 1px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 15mm 20mm 15mm 20mm;
      }
      body { background: #FFFFFF !important; }
      .no-print { display: none !important; }
      .book-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
        height: 0 !important;
        margin: 0 !important;
        border: none !important;
        visibility: hidden !important;
      }
    }
    .watermark-layer {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: ${watermarkOpacity};
      pointer-events: none;
      z-index: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .book-content { position: relative; z-index: 1; }
    .cover-page {
      min-height: 250mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      padding: 30mm 0 15mm 0;
    }
    .cover-brand {
      color: #A4513C;
      font-size: 44px;
      font-weight: 900;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      margin-top: 18px;
    }
    .cover-divider {
      width: 60px;
      height: 2px;
      background-color: rgba(164, 81, 60, 0.4);
      margin: 16px auto;
    }
    .cover-doc {
      color: #A4513C;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.25em;
      text-transform: uppercase;
    }
    .cover-subline {
      width: 48px;
      height: 1px;
      background-color: rgba(164, 81, 60, 0.3);
      margin: 12px auto;
    }
    .cover-location {
      font-style: italic;
      color: #a8a29e;
      font-size: 13px;
      letter-spacing: 0.05em;
    }
    .cover-footer {
      max-width: 360px;
      font-size: 10px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #a8a29e;
    }
    .cover-tax {
      font-weight: 600;
      color: #78716c;
      margin-bottom: 6px;
    }
    .cover-warning { font-size: 8.5px; line-height: 1.4; }
    .section-title {
      color: #A4513C;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 22px;
      break-after: avoid;
      page-break-after: avoid;
    }
    .section-subtitle {
      color: #a8a29e;
      font-style: italic;
      font-size: 12px;
      text-align: center;
      margin-top: -14px;
      margin-bottom: 24px;
    }
    .category-title {
      color: #A4513C;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border-bottom: 1px solid rgba(164, 81, 60, 0.25);
      padding-bottom: 3px;
      margin-bottom: 8px;
      font-style: italic;
      break-after: avoid;
      page-break-after: avoid;
    }
    .subregion-block { margin-top: 20px; margin-bottom: 8px; }
    .subregion-title {
      color: #A4513C;
      font-size: 13.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      border-bottom: 1px solid rgba(164, 81, 60, 0.25);
      padding-bottom: 3px;
      margin-bottom: 10px;
      break-after: avoid;
      page-break-after: avoid;
    }
    .domain-block {
      margin-bottom: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .domain-title {
      color: #554039;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
      break-after: avoid;
      page-break-after: avoid;
    }
    .wine-line {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      font-size: 12.5px;
      color: #334552;
      padding: 1.5px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .wine-vintage {
      width: 58px;
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      font-weight: 600;
      font-style: italic;
      color: #334552;
    }
    .wine-title {
      flex-grow: 1;
      font-weight: 600;
      padding-right: 12px;
      line-height: 1.35;
    }
    .wine-note {
      font-size: 10px;
      color: #78716c;
      font-style: italic;
      font-weight: normal;
      margin-left: 6px;
    }
    .wine-prices {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      margin-left: auto;
    }
    .price-col {
      width: 65px;
      text-align: right;
      color: #334552;
    }
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-top: 1px solid #f5f5f4;
      padding-top: 8px;
      margin-top: 16px;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #a8a29e;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .page-num {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-weight: 700;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 20px;
      margin-bottom: 24px;
    }
    .toc-section-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid rgba(164, 81, 60, 0.25);
      padding-bottom: 3px;
      margin-top: 12px;
      margin-bottom: 6px;
    }
    .toc-title {
      color: #A4513C;
      font-size: 12.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .toc-pnum {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 11px;
      font-weight: 700;
      color: #A4513C;
    }
    .toc-item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      font-size: 10.5px;
      color: #334552;
      padding: 1.5px 0 1.5px 6px;
    }
    .toc-dots {
      flex-grow: 1;
      border-bottom: 1px dotted #d6d3d1;
      margin: 0 6px;
      transform: translateY(-2px);
    }
    .toc-item-pnum {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 9.5px;
      font-weight: 600;
      color: #78716c;
    }
  </style>
</head>
<body>
  <div class="no-print print-toolbar">
    <div style="display: flex; align-items: center; gap: 14px;">
      <button onclick="window.print()" class="btn-print">
        🖨️ Lancer l'impression / Enregistrer en PDF
      </button>
      <span class="tip-text">
        💡 Conseil d'export : cochez <strong>"Graphiques d'arrière-plan"</strong> et décochez <strong>"En-têtes et pieds de page"</strong> dans la boîte d'impression.
      </span>
    </div>
    <button onclick="window.close()" class="btn-close">
      Fermer l'onglet
    </button>
  </div>

  <div class="book-container">
    ${showWatermark ? `<div class="watermark-layer">${watermarkSvg}</div>` : ''}
    <div class="book-content">
      <!-- 1. Couverture -->
      <div class="cover-page">
        <div>
          <div>
            <svg viewBox="0 0 100 100" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="40" r="28" fill="#A4513C" />
              <circle cx="62" cy="28" r="3" fill="#FAF8F5" />
              <circle cx="38" cy="35" r="3" fill="#FAF8F5" />
              <circle cx="50" cy="43" r="3" fill="#A4513C" opacity="0.3" />
              <circle cx="65" cy="48" r="3" fill="#FAF8F5" />
              <circle cx="56" cy="58" r="3" fill="#FAF8F5" />
              <circle cx="38" cy="50" r="3" fill="#FAF8F5" />
              <rect x="48" y="65" width="4" height="12" fill="#A4513C" />
              <path d="M26 77H74L71 93H29L26 77Z" fill="#A4513C" />
            </svg>
          </div>
          <h1 class="cover-brand">PREMNORD</h1>
          <div class="cover-divider"></div>
          <h2 class="cover-doc">LIVRE DE CAVE</h2>
        </div>
        <div>
          <div class="cover-subline"></div>
          <p class="cover-location">Restaurant Premnord &bull; Bourgogne</p>
        </div>
        <div class="cover-footer">
          <p class="cover-tax">Prix nets, service compris</p>
          <p class="cover-warning">L'abus d'alcool est dangereux pour la santé, à consommer avec modération</p>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 2. Sommaire -->
      <div>
        <h2 class="section-title">SOMMAIRE DU LIVRE DE CAVE</h2>
        <div class="toc-grid">
          <div>${renderTocColHtml(col1)}</div>
          <div>${renderTocColHtml(col2)}</div>
        </div>
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span class="page-num">p.2</span>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 3. Domaine Prieuré Roch -->
      <div>
        <div class="section-header">
          <h2 class="section-title">DOMAINE PRIEURE ROCH</h2>
          <p class="section-subtitle">Par Henry-Frédéric Roch depuis 1988</p>
        </div>
        ${bWines.length > 0 ? `
          <h3 class="category-title">Blancs</h3>
          <div style="margin-bottom: 14px;">${bWines.map(renderWineLineHtml).join('')}</div>
        ` : ''}
        ${rRoseWines.length > 0 ? `
          <h3 class="category-title" style="margin-top: 18px;">Rosés</h3>
          <div style="margin-bottom: 14px;">${rRoseWines.map(renderWineLineHtml).join('')}</div>
        ` : ''}
        ${rRougeWines.length > 0 ? `
          <h3 class="category-title" style="margin-top: 18px;">Rouges</h3>
          <div style="margin-bottom: 14px;">${rRougeWines.map(renderWineLineHtml).join('')}</div>
        ` : ''}
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé • * Limité à 1 flacon / table</span>
          <span class="page-num">p.3</span>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 4. Effervescences -->
      <div>
        <h2 class="section-title">EFFERVESCENCES</h2>
        ${effCategories.map(cat => renderSubRegionGroupHtml(cat, structuredData.bulle[cat])).join('')}
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span class="page-num">p.6</span>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 5. Vins Blancs -->
      <div>
        <h2 class="section-title">VINS BLANCS</h2>
        ${blancCategories.map(cat => renderSubRegionGroupHtml(cat, structuredData.blanc[cat])).join('')}
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span class="page-num">p.10</span>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 6. Vins Rosés -->
      <div>
        <h2 class="section-title">VINS ROSÉS</h2>
        ${roseCategories.map(cat => renderSubRegionGroupHtml(cat, structuredData.rose[cat])).join('')}
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span class="page-num">p.25</span>
        </div>
      </div>
      <div class="page-break"></div>

      <!-- 7. Vins Rouges -->
      <div>
        <h2 class="section-title">VINS ROUGES</h2>
        ${rougeCategories.map(cat => renderSubRegionGroupHtml(cat, structuredData.rouge[cat])).join('')}
        <div class="page-footer">
          <span>L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span class="page-num">p.26</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 450);
    });
  </script>
</body>
</html>`;
  };

  const handleExportPrint = () => {
    const html = generatePrintHtml();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le navigateur a bloqué l'ouverture du nouvel onglet d'export. Veuillez autoriser les fenêtres pop-up pour cette page, ou utiliser le bouton d'impression directe.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* 1. Left controls sidebar panel */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-6 space-y-6 shadow-sm print:hidden">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#A4513C]" />
            Mise en Page Livre de Cave
          </h3>
          <p className="text-[11px] text-stone-500 mt-1">
            Configurez l'affichage haute fidélité du livre de cave pour la salle ou l'impression PDF.
          </p>
        </div>

        <div className="h-[1px] bg-stone-100" />

        {/* Contrôles Sommelier : Afficher / Masquer & Stock en direct */}
        <div className="space-y-3 p-4 bg-stone-50 border border-stone-200/90 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#A4513C]" />
                Mode Personnalisation
              </p>
              <p className="text-[10px] text-stone-500">Affiche l'œil pour masquer/afficher chaque vin</p>
            </div>
            <button
              type="button"
              onClick={() => setEditVisibilityMode(!editVisibilityMode)}
              className={`w-11 h-6 rounded-full transition-all cursor-pointer relative p-1 ${
                editVisibilityMode ? 'bg-[#A4513C]' : 'bg-stone-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                editVisibilityMode ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-stone-200/60">
            <div>
              <p className="font-bold text-stone-900 text-xs">Badges de Stock (Écran)</p>
              <p className="text-[10px] text-stone-500">Voir les bouteilles & magnums restants (masqué au PDF)</p>
            </div>
            <button
              type="button"
              onClick={() => setShowStockBadges(!showStockBadges)}
              className={`w-11 h-6 rounded-full transition-all cursor-pointer relative p-1 ${
                showStockBadges ? 'bg-amber-600' : 'bg-stone-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                showStockBadges ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-stone-200/60">
            <div>
              <p className="font-bold text-stone-900 text-xs">Exclure Spiritueux & Softs</p>
              <p className="text-[10px] text-stone-500">Masque alcools forts et digestifs de la carte des vins</p>
            </div>
            <button
              type="button"
              onClick={() => setExcludeSpirits(!excludeSpirits)}
              className={`w-11 h-6 rounded-full transition-all cursor-pointer relative p-1 ${
                excludeSpirits ? 'bg-[#A4513C]' : 'bg-stone-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                excludeSpirits ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Recherche rapide dans la carte */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
            Recherche dans le livre
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer vin, cuvée, domaine..."
            className="w-full h-10 bg-stone-50 border border-stone-200 focus:border-[#A4513C] rounded-xl px-3 text-xs text-stone-900 outline-none transition-all font-sans"
          />
        </div>

        {/* Filtre Bouteilles en Stock (dynamique) */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
            Filtre Bouteilles en Stock
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-50 rounded-xl border border-stone-150 text-xs">
            <button
              onClick={() => setStockFilterMode('in_stock')}
              className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                stockFilterMode === 'in_stock'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              En stock (&gt; 0 bt)
            </button>
            <button
              onClick={() => setStockFilterMode('all')}
              className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                stockFilterMode === 'all'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Toutes réf. (ruptures)
            </button>
          </div>
        </div>

        {/* Filter site toggle */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
            Périmètre de Stock
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-50 rounded-xl border border-stone-150 text-xs">
            <button
              onClick={() => setFilterMode('salle')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterMode === 'salle'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Salle (Sites 1 à 4)
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Cave Entière (1 à 7)
            </button>
          </div>
        </div>

        {/* Viewing layout style toggle */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
            Mode d'Affichage
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-50 rounded-xl border border-stone-150 text-xs">
            <button
              onClick={() => {
                setViewFormat('paginated');
                setActivePage(1);
              }}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewFormat === 'paginated'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Feuilleter (Fidèle)
            </button>
            <button
              onClick={() => setViewFormat('printall')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                viewFormat === 'printall'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Tout défiler (Impression)
            </button>
          </div>
        </div>

        {/* Watermark Section */}
        <div className="space-y-4 p-4 bg-stone-50 border border-stone-150 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-stone-800 text-xs">Filigrane d'Arrière-Plan</p>
              <p className="text-[10px] text-stone-500">Affiche un logo ou dessin en fond de page</p>
            </div>
            <button
              onClick={() => setShowWatermark(!showWatermark)}
              className={`w-11 h-6 rounded-full transition-all cursor-pointer relative p-1 ${
                showWatermark ? 'bg-[#A4513C]' : 'bg-stone-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                showWatermark ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {showWatermark && (
            <div className="space-y-3.5 pt-2 border-t border-stone-200/60 text-[11px]">
              {/* Drag & Drop Upload Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => watermarkInputRef.current?.click()}
                className="border-2 border-dashed border-stone-200 hover:border-[#A4513C]/40 rounded-lg p-3 text-center bg-white cursor-pointer transition-colors space-y-1"
              >
                <input 
                  type="file" 
                  ref={watermarkInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <UploadCloud className="w-5 h-5 mx-auto text-stone-400" />
                <p className="font-medium text-stone-600">Glissez-déposez un logo</p>
                <p className="text-[9px] text-stone-400">ou cliquez pour choisir un fichier (PNG/SVG/JPG)</p>
              </div>

              {uploadError && (
                <p className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded text-center">{uploadError}</p>
              )}
              {successMsg && (
                <p className="text-[10px] text-emerald-600 bg-emerald-50 p-1.5 rounded text-center font-medium">{successMsg}</p>
              )}

              {/* Reset to Default Button */}
              {watermarkLogo && (
                <button
                  onClick={handleResetWatermark}
                  className="w-full py-1.5 px-2 border border-stone-200 rounded text-[10px] text-stone-500 hover:text-[#A4513C] hover:bg-stone-100 transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Restaurer le compas d'origine
                </button>
              )}

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>Opacité / Transparence</span>
                  <span className="font-mono font-bold text-[#A4513C]">{Math.round(watermarkOpacity * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.01"
                  max="0.20"
                  step="0.005"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  className="w-full accent-[#A4513C] h-1 bg-stone-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Scale Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>Taille / Échelle</span>
                  <span className="font-mono font-bold text-[#A4513C]">{watermarkScale}%</span>
                </div>
                <input 
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={watermarkScale}
                  onChange={(e) => setWatermarkScale(parseInt(e.target.value))}
                  className="w-full accent-[#A4513C] h-1 bg-stone-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        <div className="h-[1px] bg-stone-100" />

        {/* Iframe Restriction Alert */}
        {isInIframe && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2 text-[11px] leading-relaxed text-amber-900 print:hidden shadow-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-650 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Aperçu dans l'Iframe</p>
                <p className="text-amber-850">Les navigateurs bloquent souvent la commande d'impression (`window.print()`) de l'iframe de développement.</p>
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 border border-amber-100 text-[10.5px] text-stone-700 space-y-1">
              <p className="font-semibold text-stone-850">Pour imprimer ou exporter en PDF sans aucun blocage :</p>
              <ol className="list-decimal list-inside pl-1 space-y-1 text-stone-600">
                <li>Cliquez sur le bouton <span className="font-bold text-[#A4513C]">"Ouvrir dans un nouvel onglet"</span> (icône <span className="inline-block scale-95 align-middle">↗️</span> en haut à droite de l'aperçu AI Studio).</li>
                <li>Puis, sur le nouvel onglet, cliquez sur le bouton <span className="font-bold text-stone-800">"Imprimer / Exporter PDF"</span> ci-dessous pour lancer l'impression instantanément !</li>
              </ol>
            </div>
          </div>
        )}

        {/* Action Buttons: Bulletproof Standalone Export & Print */}
        <div className="space-y-2.5">
          <button
            onClick={handleExportPrint}
            className="w-full h-12 bg-[#A4513C] hover:bg-[#8e4331] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider font-sans"
            title="Ouvre un export haute fidélité dans un nouvel onglet et lance l'impression/PDF"
          >
            <Printer className="w-4 h-4" />
            Imprimer / Exporter PDF
          </button>

          <button
            onClick={handleExportPrint}
            className="w-full h-9 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans"
          >
            <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
            Ouvrir l'export dans un nouvel onglet
          </button>
        </div>

        <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 text-[10.5px] leading-relaxed text-stone-500 font-sans space-y-1.5">
          <p className="font-bold text-stone-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#A4513C]" />
            Export Haute Fidélité (Conforme Word) :
          </p>
          <p>• Le bouton ci-dessus ouvre un nouvel onglet indépendant avec le livre complet.</p>
          <p>• Dans la boîte d'impression, cochez <span className="font-semibold text-stone-700">"Graphiques d'arrière-plan"</span> (pour le filigrane) et décochez <span className="font-semibold text-stone-700">"En-têtes et pieds de page"</span>.</p>
        </div>
      </div>

      {/* 2. Right booklet view area */}
      <div className="lg:col-span-8 flex flex-col items-center">
        {/* Dynamic printer specific style injection */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm 20mm;
            }
            body {
              background: #FFFFFF !important;
              color: #334552 !important;
            }
            header, nav, aside, .print\\:hidden {
              display: none !important;
            }
            #printable-word-booklet {
              display: block !important;
              position: static !important;
              width: 100% !important;
              max-width: none !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
            }
            .book-page-print {
              page-break-after: always !important;
              break-after: page !important;
              min-height: 260mm !important;
              width: 100% !important;
              padding: 0 0 10mm 0 !important;
              background: transparent !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
            }
          }
        `}</style>

        {viewFormat === 'paginated' ? (
          /* Paginated view */
          <div className="w-full max-w-[720px] flex flex-col items-center gap-6">
            {/* Page Flipper Navigation */}
            <div className="flex items-center justify-between bg-white px-4 py-2 border border-stone-200 rounded-xl w-full max-w-[450px] shadow-sm print:hidden select-none">
              <button
                disabled={activePage === 1}
                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              
              <span className="font-sans font-bold text-[11px] uppercase tracking-wider text-stone-600">
                {activePage === 1 ? '1 • Couverture' : activePage === 2 ? '2 • Sommaire du Livre' : activePage === 3 ? '3 • Domaine Prieuré Roch' : activePage === 4 ? '6 • Effervescences' : activePage === 5 ? '10 • Vins Blancs' : activePage === 6 ? '25 • Vins Rosés' : '26 • Vins Rouges'}
              </span>

              <button
                disabled={activePage === 7}
                onClick={() => setActivePage(prev => Math.min(7, prev + 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Simulated A4 card container */}
            <div 
              id="printable-word-booklet"
              className="bg-[#FCFBF7] text-stone-800 relative shadow-xl border border-stone-200 rounded-xl p-[7mm] sm:p-[14mm] min-h-[480px] w-full max-w-[680px] overflow-visible flex flex-col justify-between"
            >
              {showWatermark && <Watermark logo={watermarkLogo} opacity={watermarkOpacity} scale={watermarkScale} />}
              {renderPageContent(activePage)}
            </div>
          </div>
        ) : (
          /* Continuous All Pages Scroll View for easy desktop reading & perfect paper print breaks */
          <div 
            id="printable-word-booklet" 
            className="w-full max-w-[680px] space-y-8 print:space-y-0"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((pageNum) => (
              <div 
                key={pageNum}
                className="book-page-print bg-[#FCFBF7] text-stone-800 relative shadow-xl border border-stone-200 rounded-xl p-[7mm] sm:p-[14mm] min-h-[480px] w-full overflow-visible flex flex-col justify-between print:rounded-none print:shadow-none print:border-none print:py-[12mm] print:px-[15mm] print:w-full print:min-h-[260mm] print:h-auto print:overflow-visible print:break-after-page print:bg-white"
              >
                {showWatermark && <Watermark logo={watermarkLogo} opacity={watermarkOpacity} scale={watermarkScale} />}
                {renderPageContent(pageNum)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
