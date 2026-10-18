import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine } from '../types';
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
  Info
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
          className="text-[#BD6346] fill-none stroke-current" 
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

export const WineMenuDocumentStyle: React.FC = () => {
  const { wines, sites, watermarkLogo, updateWatermarkLogo } = useFirebase();
  const [filterMode, setFilterMode] = useState<'salle' | 'all'>('salle');
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

  // Filter & consolidate wines across Sites 1, 2, 3, 4
  const filteredWines = useMemo(() => {
    const consolidatedMap = new Map<string, Wine>();

    wines.forEach(w => {
      if (w.siteId && !['site-1', 'site-2', 'site-3', 'site-4'].includes(w.siteId)) return;
      if (w.hideFromMenu) return;

      const normDomain = getCanonicalDomain(w.domain).toLowerCase();
      const normName = (w.name || '').trim().toLowerCase();
      const normVintage = (w.vintage || '').toString().trim().toLowerCase();
      const normColor = (w.color || '').toString().trim().toLowerCase();
      const normFormat = (w.format || '').toString().trim().toLowerCase();

      const key = `${normDomain}_${normName}_${normVintage}_${normColor}_${normFormat}`;

      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, { ...w });
      } else {
        const existing = consolidatedMap.get(key)!;
        existing.quantity = (existing.quantity || 0) + (w.quantity || 0);
        if (w.isPreSale) existing.isPreSale = true;
      }
    });

    const list = Array.from(consolidatedMap.values());
    if (filterMode === 'salle') {
      return list.filter(w => w.quantity > 0 || w.isPreSale);
    }
    return list;
  }, [wines, filterMode]);

  // Group wines by canonical classification
  const structuredData = useMemo(() => {
    const data = {
      dpr: {
        blanc: [] as Wine[],
        rose: [] as Wine[],
        rouge: [] as Wine[],
      },
      bulle: {} as { [region: string]: Wine[] },
      blanc: {} as { [region: string]: Wine[] },
      rose: {} as { [region: string]: Wine[] },
      rouge: {} as { [region: string]: Wine[] },
    };

    filteredWines.forEach(wine => {
      const isDPR = getCanonicalDomain(wine.domain) === 'Domaine Prieuré-Roch';
      const color = wine.color || 'blanc';

      if (isDPR) {
        if (color === 'rose') {
          data.dpr.rose.push(wine);
        } else if (color === 'bulle') {
          // Put bubbles under blancs or bubble
          data.dpr.blanc.push(wine);
        } else if (color === 'rouge') {
          data.dpr.rouge.push(wine);
        } else {
          data.dpr.blanc.push(wine);
        }
      } else {
        // General wines
        if (color === 'bulle' || color === 'cidre_biere') {
          const reg = classifyWineRegion(wine, 'bulle');
          if (!data.bulle[reg]) data.bulle[reg] = [];
          data.bulle[reg].push(wine);
        } else if (color === 'rose') {
          const reg = classifyWineRegion(wine, 'rose');
          if (!data.rose[reg]) data.rose[reg] = [];
          data.rose[reg].push(wine);
        } else if (color === 'rouge') {
          const reg = classifyWineRegion(wine, 'rouge');
          if (!data.rouge[reg]) data.rouge[reg] = [];
          data.rouge[reg].push(wine);
        } else {
          // Blancs & orange
          const reg = classifyWineRegion(wine, 'blanc');
          if (!data.blanc[reg]) data.blanc[reg] = [];
          data.blanc[reg].push(wine);
        }
      }
    });

    // Sort wines inside groups (by name and descending vintage)
    const sortWines = (a: Wine, b: Wine) => {
      const nameCompare = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;

      const yearA = parseInt(a.vintage || '0') || 0;
      const yearB = parseInt(b.vintage || '0') || 0;
      if (yearA !== yearB) return yearB - yearA; // Newest vintage first
      return 0;
    };

    data.dpr.blanc.sort(sortWines);
    data.dpr.rose.sort(sortWines);
    data.dpr.rouge.sort(sortWines);

    const sortSubRegions = (obj: { [key: string]: Wine[] }) => {
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

  // Helper to group sub-region wines by Domain
  const getWinesByDomain = (winesList: Wine[]) => {
    const groups: { [domain: string]: Wine[] } = {};
    winesList.forEach(w => {
      const dom = w.domain?.trim() || 'Domaine Inconnu';
      if (!groups[dom]) groups[dom] = [];
      groups[dom].push(w);
    });
    return groups;
  };

  const formatPeressTypeTag = (wine: Wine) => {
    const colorStr = wine.color ? (wine.color.charAt(0).toUpperCase() + wine.color.slice(1).toLowerCase()) : '';
    let formatStr = wine.format || 'Bouteille (75cl)';
    const lowerFormat = formatStr.toLowerCase();
    if (lowerFormat === '75cl' || lowerFormat === '75 cl' || lowerFormat === 'bouteille') {
      formatStr = 'Bouteille (75cl)';
    } else if (lowerFormat === '150cl' || lowerFormat === '150 cl' || lowerFormat === 'magnum') {
      formatStr = 'Magnum (1.5L)';
    } else if (lowerFormat === 'jeroboam' || lowerFormat === 'jéroboam' || lowerFormat === '300cl' || lowerFormat === '3l') {
      formatStr = 'Jéroboam (3L)';
    } else if (lowerFormat === 'demi-bouteille' || lowerFormat === '37.5cl' || lowerFormat === '37,5cl') {
      formatStr = 'Demi-bouteille (37.5cl)';
    }
    if (colorStr && formatStr) {
      return `(${colorStr} - ${formatStr})`;
    }
    return colorStr ? `(${colorStr})` : `(${formatStr})`;
  };

  const renderWineLine = (wine: Wine) => {
    const vintage = wine.vintage || 'S.A.';
    const cleanNote = getCleanSommelierNote(wine.notes);
    const hasAsterisk = vintage.includes('*') || cleanNote.includes('*');
    const cleanVintage = (vintage || '').replace('*', '').trim();
    const typeTag = formatPeressTypeTag(wine);

    return (
      <div key={wine.id} className="py-1 font-serif text-[13px] border-b border-stone-100/30 break-inside-avoid">
        <div className="flex items-baseline w-full justify-between gap-1">
          <div className="flex items-baseline flex-grow min-w-0 pr-1 relative">
            {/* Wine Name */}
            <span className="font-semibold text-stone-900 leading-snug">
              {wine.name}
            </span>
            {/* Format/Color tag in italics matching La Cave des Peress */}
            <span className="ml-1.5 text-[11px] text-stone-500 font-sans italic shrink-0">
              {typeTag}
            </span>
            {cleanNote && (
              <span className="ml-1 text-[10.5px] text-stone-400 font-sans italic">
                {cleanNote.startsWith('Dgt') ? ` – ${cleanNote}` : ` (${cleanNote})`}
              </span>
            )}
          </div>

          {/* Dotted lines */}
          <div className="flex-grow border-b border-dotted border-stone-300 mx-2 self-baseline h-1.5 min-w-6" style={{ transform: 'translateY(-2.5px)' }} />

          {/* Vintage & Price */}
          <div className="flex items-baseline gap-4 shrink-0 text-right font-mono text-[13px]">
            <span className="text-stone-600 font-semibold italic text-[12.5px] min-w-10 text-center">
              {cleanVintage}{hasAsterisk ? '*' : ''}
            </span>
            <span className="font-bold text-stone-900 min-w-16 text-right">
              {wine.priceSell ? `${wine.priceSell.toFixed(2).replace('.', ',')} €` : 'N/C'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render a group of wines with domain titles
  const renderSubRegionGroup = (subRegionName: string, winesList: Wine[]) => {
    if (!winesList || winesList.length === 0) return null;
    const domainGroups = getWinesByDomain(winesList);

    return (
      <div key={subRegionName} className="mb-6 break-inside-avoid">
        <h4 className="text-[#BD6346] font-serif font-bold tracking-[0.15em] text-[12px] uppercase border-b border-stone-200 pb-0.5 mb-3 mt-4 text-center">
          {subRegionName}
        </h4>
        
        {Object.entries(domainGroups).map(([domainName, domainWines]) => (
          <div key={domainName} className="mb-5 pl-0.5">
            {/* Producer Title - Prominent & Bold matching La Cave des Peress */}
            <h5 className="font-sans font-extrabold text-stone-900 text-base sm:text-[17px] mb-0.5 tracking-tight">
              {domainName}
            </h5>
            {domainWines[0]?.appellation && (
              <p className="text-[10px] text-stone-400 uppercase font-sans font-semibold tracking-wider mb-1.5">
                {domainWines[0].appellation}
              </p>
            )}
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
    <div className="flex flex-col justify-between items-center h-full text-center py-[25mm] relative z-10 select-none">
      <div className="mt-10">
        {/* Large Spaced out logo / header */}
        <h1 className="text-[#BD6346] font-sans font-medium tracking-[0.45em] text-4xl sm:text-5xl uppercase ml-[0.45em]">
          PREMNORD
        </h1>
        <div className="w-16 h-[1.5px] bg-[#BD6346]/40 mx-auto mt-6" />
      </div>

      <div className="flex flex-col items-center">
        {/* Subtle decorative centerpiece */}
        <h2 className="text-[#BD6346] font-sans font-light tracking-[0.3em] text-lg sm:text-xl uppercase ml-[0.3em] mt-2">
          LIVRE DE CAVE
        </h2>
      </div>

      <div className="w-full max-w-sm space-y-4 px-6 text-[10px] font-sans tracking-[0.05em] uppercase text-stone-400">
        <p className="font-medium text-stone-500">Prix nets, service compris</p>
        <p className="text-[8.5px] leading-relaxed max-w-xs mx-auto">
          L'abus d'alcool est dangereux pour la santé, à consommer avec modération
        </p>
      </div>
    </div>
  );

  // Page 2: Table of Contents (Index)
  const renderTOCPage = () => {
    const dprCount = structuredData.dpr.blanc.length + structuredData.dpr.rose.length + structuredData.dpr.rouge.length;
    const bulleCount = (Object.values(structuredData.bulle) as Wine[][]).reduce((sum, list) => sum + list.length, 0);
    const blancCount = (Object.values(structuredData.blanc) as Wine[][]).reduce((sum, list) => sum + list.length, 0);
    const roseCount = (Object.values(structuredData.rose) as Wine[][]).reduce((sum, list) => sum + list.length, 0);
    const rougeCount = (Object.values(structuredData.rouge) as Wine[][]).reduce((sum, list) => sum + list.length, 0);

    const indexItems = [
      { title: "Domaine Prieuré Roch", page: 3, count: dprCount, desc: "Monopoles & sélections de prestige" },
      { title: "Effervescences", page: 4, count: bulleCount, desc: "Champagnes de vignerons & grands crémants" },
      { title: "Vins Blancs", page: 5, count: blancCount, desc: "Bourgogne, Loire, Jura & cépages de France et d'ailleurs" },
      { title: "Vins Rosés", page: 6, count: roseCount, desc: "AOP de l'Est parisien aux rives méditerranéennes" },
      { title: "Vins Rouges", page: 7, count: rougeCount, desc: "Grands terroirs, pinot noir et sélections fines" },
    ];

    return (
      <div className="flex flex-col justify-between h-full py-[10mm] relative z-10 px-[5mm]">
        <div>
          <h2 className="text-center text-[#BD6346] font-sans font-light tracking-[0.25em] text-2xl uppercase border-b border-stone-200/60 pb-4 mb-10">
            INDEX DU LIVRE
          </h2>

          <div className="space-y-6 max-w-md mx-auto mt-8">
            {indexItems.map((item) => (
              <div 
                key={item.page}
                onClick={() => viewFormat === 'paginated' && setActivePage(item.page)}
                className={`group flex items-baseline justify-between py-2 border-b border-stone-100 cursor-pointer ${
                  viewFormat === 'paginated' ? 'hover:bg-stone-50/80 rounded px-2 transition-all' : ''
                }`}
              >
                <div className="min-w-0 pr-4">
                  <h3 className="font-sans font-bold text-stone-800 text-[13px] tracking-tight group-hover:text-[#BD6346] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-stone-400 font-sans italic mt-0.5">{item.desc}</p>
                </div>
                <div className="flex-grow border-b border-dotted border-stone-300 mx-2 self-baseline h-2" />
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-stone-500 font-bold">
                  <span className="bg-stone-100 text-[9px] px-1.5 py-0.5 rounded text-stone-500 border border-stone-200">
                    {item.count} réf.
                  </span>
                  <span className="text-[#BD6346] group-hover:translate-x-0.5 transition-transform">
                    p.{item.page}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {viewFormat === 'paginated' && (
            <p className="text-center text-[9px] text-stone-400 font-sans italic mb-3 animate-pulse">💡 Cliquez sur une section pour y accéder directement.</p>
          )}
          <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
            <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
            <span className="font-mono font-bold">p.2</span>
          </div>
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
          {/* Header column size reference */}
          <div className="flex justify-end font-sans uppercase tracking-widest text-[9px] font-bold text-stone-400 border-b border-stone-100 pb-1 mb-4">
            <span className="w-16 text-center">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-[#BD6346] font-sans font-medium tracking-[0.25em] text-xl sm:text-2xl uppercase leading-tight">
              DOMAINE PRIEURE ROCH
            </h2>
            <p className="text-stone-400 font-sans italic text-[11px] mt-1.5 tracking-wide">
              Par Henry-Frédéric Roch depuis 1988
            </p>
            <div className="w-12 h-[1px] bg-[#BD6346]/30 mx-auto mt-4" />
          </div>

          {totalDPRCount === 0 ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence du Domaine Prieuré Roch disponible actuellement.
            </p>
          ) : (
            <div className="space-y-6 max-h-[175mm] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 pr-1">
              {/* Blancs */}
              {bWines.length > 0 && (
                <div>
                  <h3 className="text-[#BD6346] font-sans font-bold tracking-[0.1em] text-[11px] uppercase border-b border-stone-200 pb-0.5 mb-2 italic">
                    Les Blancs
                  </h3>
                  <div className="space-y-0.5">
                    {bWines.map(renderWineLine)}
                  </div>
                </div>
              )}

              {/* Rosés */}
              {rRoseWines.length > 0 && (
                <div>
                  <h3 className="text-[#BD6346] font-sans font-bold tracking-[0.1em] text-[11px] uppercase border-b border-stone-200 pb-0.5 mb-2 italic">
                    Les Rosés
                  </h3>
                  <div className="space-y-0.5">
                    {rRoseWines.map(renderWineLine)}
                  </div>
                </div>
              )}

              {/* Rouges */}
              {rRougeWines.length > 0 && (
                <div>
                  <h3 className="text-[#BD6346] font-sans font-bold tracking-[0.1em] text-[11px] uppercase border-b border-stone-200 pb-0.5 mb-2 italic">
                    Les Rouges
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
          <div className="flex justify-end font-sans uppercase tracking-widest text-[9px] font-bold text-stone-400 border-b border-stone-100 pb-1 mb-4">
            <span className="w-16 text-center">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-[#BD6346] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              EFFERVESCENCES
            </h2>
            <div className="w-10 h-[1px] bg-[#BD6346]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence effervescente disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 max-h-[175mm] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.bulle[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.4</span>
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
          <div className="flex justify-end font-sans uppercase tracking-widest text-[9px] font-bold text-stone-400 border-b border-stone-100 pb-1 mb-4">
            <span className="w-16 text-center">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-[#BD6346] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS BLANCS
            </h2>
            <div className="w-10 h-[1px] bg-[#BD6346]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin blanc disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 max-h-[175mm] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.blanc[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.5</span>
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
          <div className="flex justify-end font-sans uppercase tracking-widest text-[9px] font-bold text-stone-400 border-b border-stone-100 pb-1 mb-4">
            <span className="w-16 text-center">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-[#BD6346] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS ROSÉS
            </h2>
            <div className="w-10 h-[1px] bg-[#BD6346]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin rosé disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 max-h-[175mm] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.rose[catName])
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

  // Page 7: Vins Rouges Page
  const renderRougesPage = () => {
    const categories = Object.keys(structuredData.rouge).sort((a, b) => 
      getRegionOrderIndex(a, ROUGES_ORDER) - getRegionOrderIndex(b, ROUGES_ORDER)
    );
    const hasAny = categories.some(cat => structuredData.rouge[cat].length > 0);

    return (
      <div className="flex flex-col justify-between h-full relative z-10 px-[5mm] py-[5mm]">
        <div>
          <div className="flex justify-end font-sans uppercase tracking-widest text-[9px] font-bold text-stone-400 border-b border-stone-100 pb-1 mb-4">
            <span className="w-16 text-center">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-[#BD6346] font-sans font-medium tracking-[0.25em] text-2xl uppercase">
              VINS ROUGES
            </h2>
            <div className="w-10 h-[1px] bg-[#BD6346]/30 mx-auto mt-3" />
          </div>

          {!hasAny ? (
            <p className="text-center py-12 text-stone-400 italic text-xs font-sans">
              Aucune référence de vin rouge disponible actuellement.
            </p>
          ) : (
            <div className="space-y-4 max-h-[175mm] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 pr-1">
              {categories.map(catName => 
                renderSubRegionGroup(catName, structuredData.rouge[catName])
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-stone-100 pt-2 mt-4 font-sans text-[7.5px] sm:text-[8px] font-medium text-stone-400 uppercase tracking-wider">
          <span className="truncate max-w-[75%]">L'abus d'alcool est dangereux pour la santé, à consommer avec modération • Prix nets</span>
          <span className="font-mono font-bold">p.7</span>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* 1. Left controls sidebar panel */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-6 space-y-6 shadow-sm print:hidden">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#BD6346]" />
            Mise en Page Livre de Cave
          </h3>
          <p className="text-[11px] text-stone-500 mt-1">
            Configurez l'affichage haute fidélité du livre de cave pour la salle ou l'impression PDF.
          </p>
        </div>

        <div className="h-[1px] bg-stone-100" />

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
              Salle (Sites 1 & 2)
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-stone-900 text-white shadow'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Cave Entière (Qté &gt; 0)
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
                showWatermark ? 'bg-[#BD6346]' : 'bg-stone-300'
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
                className="border-2 border-dashed border-stone-200 hover:border-[#BD6346]/40 rounded-lg p-3 text-center bg-white cursor-pointer transition-colors space-y-1"
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
                  className="w-full py-1.5 px-2 border border-stone-200 rounded text-[10px] text-stone-500 hover:text-[#BD6346] hover:bg-stone-100 transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Restaurer le compas d'origine
                </button>
              )}

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>Opacité / Transparence</span>
                  <span className="font-mono font-bold text-[#BD6346]">{Math.round(watermarkOpacity * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.01"
                  max="0.20"
                  step="0.005"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  className="w-full accent-[#BD6346] h-1 bg-stone-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Scale Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>Taille / Échelle</span>
                  <span className="font-mono font-bold text-[#BD6346]">{watermarkScale}%</span>
                </div>
                <input 
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={watermarkScale}
                  onChange={(e) => setWatermarkScale(parseInt(e.target.value))}
                  className="w-full accent-[#BD6346] h-1 bg-stone-200 rounded-lg cursor-pointer"
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
                <li>Cliquez sur le bouton <span className="font-bold text-[#BD6346]">"Ouvrir dans un nouvel onglet"</span> (icône <span className="inline-block scale-95 align-middle">↗️</span> en haut à droite de l'aperçu AI Studio).</li>
                <li>Puis, sur le nouvel onglet, cliquez sur le bouton <span className="font-bold text-stone-800">"Imprimer / Exporter PDF"</span> ci-dessous pour lancer l'impression instantanément !</li>
              </ol>
            </div>
          </div>
        )}

        {/* Action Button: Print PDF */}
        <button
          onClick={() => {
            setViewFormat('printall');
            setTimeout(() => {
              window.print();
            }, 180);
          }}
          className="w-full h-11 bg-[#BD6346] hover:bg-[#BD6346]/90 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-all cursor-pointer uppercase tracking-wider font-sans"
        >
          <Printer className="w-4 h-4" />
          Imprimer / Exporter PDF
        </button>

        <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 text-[10.5px] leading-relaxed text-stone-500 font-sans space-y-1">
          <p className="font-bold text-stone-700">🎨 Recommandations d'exportation :</p>
          <p>1. Cliquez sur "Imprimer / Exporter PDF" (dans un nouvel onglet de préférence).</p>
          <p>2. Cochez l'option <span className="font-semibold text-stone-700">"Graphiques d'arrière-plan"</span> dans les paramètres d'impression pour conserver la couleur de fond crème et le filigrane.</p>
          <p>3. Décochez <span className="font-semibold text-stone-700">"En-têtes et pieds de page"</span> pour une finition pure sans textes système indésirables.</p>
        </div>
      </div>

      {/* 2. Right booklet view area */}
      <div className="lg:col-span-8 flex flex-col items-center">
        {/* Dynamic printer specific style injection */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body * {
              visibility: hidden;
            }
            #printable-word-booklet, #printable-word-booklet * {
              visibility: visible;
            }
            #printable-word-booklet {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm !important;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
            }
            .book-page-print {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-after: page !important;
              break-inside: avoid !important;
              height: 297mm !important;
              width: 210mm !important;
              padding: 12mm 15mm !important;
              background: #FCFBF7 !important;
              position: relative !important;
              box-shadow: none !important;
              border: none !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
          }
        `}</style>

        {viewFormat === 'paginated' ? (
          /* Paginated view */
          <div className="w-full max-w-[700px] flex flex-col items-center gap-6">
            {/* Page Flipper Navigation */}
            <div className="flex items-center justify-between bg-white px-4 py-2 border border-stone-200 rounded-xl w-full max-w-[450px] shadow-sm print:hidden select-none">
              <button
                disabled={activePage === 1}
                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              
              <span className="font-sans font-bold text-[11px] uppercase tracking-wider text-stone-500">
                {activePage === 1 ? 'Couverture' : activePage === 2 ? 'Table des Matières' : `Page ${activePage} sur 7`}
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
              className="bg-[#FCFBF7] text-stone-800 relative shadow-xl border border-stone-200 rounded-xl p-[7mm] sm:p-[16mm] aspect-auto sm:aspect-[1/1.414] min-h-[450px] sm:min-h-0 w-full max-w-[620px] overflow-visible sm:overflow-hidden flex flex-col justify-between"
            >
              {showWatermark && <Watermark logo={watermarkLogo} opacity={watermarkOpacity} scale={watermarkScale} />}
              {renderPageContent(activePage)}
            </div>
          </div>
        ) : (
          /* Continuous All Pages Scroll View for easy desktop reading & perfect paper print breaks */
          <div 
            id="printable-word-booklet" 
            className="w-full max-w-[620px] space-y-8 print:space-y-0"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((pageNum) => (
              <div 
                key={pageNum}
                className="book-page-print bg-[#FCFBF7] text-stone-800 relative shadow-xl border border-stone-200 rounded-xl p-[7mm] sm:p-[16mm] aspect-auto sm:aspect-[1/1.414] min-h-[450px] sm:min-h-0 w-full overflow-visible sm:overflow-hidden flex flex-col justify-between print:rounded-none print:shadow-none print:border-none print:py-[12mm] print:px-[15mm] print:w-[210mm] print:h-[297mm] print:bg-white"
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
