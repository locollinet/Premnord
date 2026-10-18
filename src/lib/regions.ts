import { WineRegion } from '../types';

export const DEFAULT_REGION_GROUPS: string[] = [
  'Vignobles de France',
  'Vignobles d\'Europe & Méditerranée',
  'Nouveau Monde & Autres Pays'
];

export const DEFAULT_WINE_REGIONS: WineRegion[] = [
  // --- Vignobles de France ---
  {
    id: 'france-alsace',
    name: 'Alsace',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: ['Haut-Rhin', 'Bas-Rhin', 'Grands Crus d\'Alsace'],
    orderIndex: 1
  },
  {
    id: 'france-auvergne',
    name: 'Auvergne',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Côtes d\'Auvergne',
      'Saint-Pourçain',
      'Côtes du Forez',
      'Côte Roannaise',
      'Puy-de-Dôme',
      'Chanturgue',
      'Châteaugay',
      'Corent',
      'Madargues',
      'Boudes'
    ],
    orderIndex: 2
  },
  {
    id: 'france-beaujolais',
    name: 'Beaujolais',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Morgon', 'Fleurie', 'Moulin-à-Vent', 'Brouilly', 'Côte de Brouilly',
      'Juliénas', 'Chiroubles', 'Chénas', 'Saint-Amour', 'Régnié'
    ],
    orderIndex: 3
  },
  {
    id: 'france-bordeaux',
    name: 'Bordeaux',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Médoc', 'Pauillac', 'Margaux', 'Saint-Julien', 'Saint-Estèphe',
      'Pomerol', 'Saint-Émilion', 'Graves & Pessac-Léognan', 'Sauternes'
    ],
    orderIndex: 4
  },
  {
    id: 'france-bourgogne',
    name: 'Bourgogne',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Côte de Nuits', 'Côte de Beaune', 'Yonne / Chablisien',
      'Côte Chalonnaise', 'Mâconnais', 'Hautes-Côtes de Beaune', 'Hautes-Côtes de Nuits'
    ],
    orderIndex: 5
  },
  {
    id: 'france-champagne',
    name: 'Champagne',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Montagne de Reims', 'Côte des Blancs', 'Vallée de la Marne', 'Côte des Bar'
    ],
    orderIndex: 6
  },
  {
    id: 'france-corse',
    name: 'Corse',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: ['Patrimonio', 'Ajaccio', 'Calvi', 'Figari', 'Sartène'],
    orderIndex: 7
  },
  {
    id: 'france-jura',
    name: 'Jura',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: ['Arbois', 'Château-Chalon', 'Côtes du Jura', 'L\'Étoile'],
    orderIndex: 8
  },
  {
    id: 'france-languedoc-roussillon',
    name: 'Languedoc-Roussillon',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Pic Saint-Loup', 'Terrasses du Larzac', 'Faugères', 'Minervois',
      'Corbières', 'Saint-Chinian', 'Limoux',
      'Roussillon (Côtes du Roussillon / Aspres)', 'Collioure & Banyuls', 'Maury'
    ],
    orderIndex: 9
  },
  {
    id: 'france-loire',
    name: 'Loire',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Centre-Loire (Sancerre / Pouilly)', 'Touraine', 'Anjou-Saumur', 'Pays Nantais (Muscadet)'
    ],
    orderIndex: 10
  },
  {
    id: 'france-provence',
    name: 'Provence',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: ['Bandol', 'Cassis', 'Côtes de Provence', 'Palette', 'Bellet'],
    orderIndex: 11
  },
  {
    id: 'france-rhone',
    name: 'Rhône',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Rhône Nord (Septentrional)', 'Rhône Sud (Méridional)', 'Côte-Rôtie',
      'Condrieu', 'Saint-Joseph', 'Hermitage', 'Châteauneuf-du-Pape', 'Gigondas'
    ],
    orderIndex: 12
  },
  {
    id: 'france-savoie',
    name: 'Savoie',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: ['Chignin-Bergeron', 'Apremont', 'Mondeuse d\'Arbin', 'Roussette de Savoie'],
    orderIndex: 13
  },
  {
    id: 'france-sud-ouest',
    name: 'Sud-Ouest',
    group: 'Vignobles de France',
    country: 'France',
    subRegions: [
      'Cahors', 'Madiran', 'Jurançon', 'Gaillac', 'Irouléguy',
      'Bergerac & Monbazillac', 'Pécharmant', 'Côtes de Gascogne',
      'Marcillac', 'Fronton', 'Buzet'
    ],
    orderIndex: 14
  },

  // --- Vignobles d'Europe & Méditerranée ---
  {
    id: 'europe-allemagne',
    name: 'Allemagne',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Allemagne',
    subRegions: ['Mosel', 'Rheingau', 'Pfalz', 'Baden', 'Nahe', 'Franken', 'Rheinhessen'],
    orderIndex: 20
  },
  {
    id: 'europe-autriche',
    name: 'Autriche',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Autriche',
    subRegions: ['Wachau', 'Kamptal', 'Kremstal', 'Burgenland', 'Steiermark', 'Weinviertel'],
    orderIndex: 21
  },
  {
    id: 'europe-danemark',
    name: 'Danemark',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Danemark',
    subRegions: ['Jutland', 'Seeland (Sjælland)', 'Fionie'],
    orderIndex: 22
  },
  {
    id: 'europe-espagne',
    name: 'Espagne',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Espagne',
    subRegions: [
      'Rioja (Alta / Alavesa)', 'Ribera del Duero', 'Priorat', 'Rías Baixas',
      'Bierzo', 'Jerez-Xérès-Sherry', 'Toro', 'Penedès (Cava)'
    ],
    orderIndex: 23
  },
  {
    id: 'europe-georgie',
    name: 'Géorgie',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Géorgie',
    subRegions: ['Kakhétie (Kvevri / Qvevri)', 'Imérétie', 'Kartlie'],
    orderIndex: 24
  },
  {
    id: 'europe-grece',
    name: 'Grèce',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Grèce',
    subRegions: ['Santorin', 'Naoussa', 'Némée', 'Goumenissa'],
    orderIndex: 25
  },
  {
    id: 'europe-hongrie',
    name: 'Hongrie',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Hongrie',
    subRegions: ['Tokaj', 'Eger', 'Villány', 'Somló'],
    orderIndex: 26
  },
  {
    id: 'europe-italie',
    name: 'Italie',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Italie',
    subRegions: [
      'Piémont (Barolo / Barbaresco)', 'Toscane (Chianti / Brunello / Bolgheri)',
      'Vénétie (Valpolicella / Amarone)', 'Sicile (Etna)', 'Trentin-Haut-Adige', 'Frioul'
    ],
    orderIndex: 27
  },
  {
    id: 'europe-portugal',
    name: 'Portugal',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Portugal',
    subRegions: ['Douro', 'Dão', 'Bairrada', 'Alentejo', 'Vinho Verde', 'Porto / Madère'],
    orderIndex: 28
  },
  {
    id: 'europe-slovenie',
    name: 'Slovénie',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Slovénie',
    subRegions: ['Goriška Brda', 'Vipava', 'Štajerska'],
    orderIndex: 29
  },
  {
    id: 'europe-suisse',
    name: 'Suisse',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Suisse',
    subRegions: ['Valais', 'Vaud (Lavaux / Dézaley)', 'Genève', 'Neuchâtel', 'Tessin (Ticino)'],
    orderIndex: 30
  },
  {
    id: 'europe-liban',
    name: 'Liban',
    group: 'Vignobles d\'Europe & Méditerranée',
    country: 'Liban',
    subRegions: ['Vallée de la Bekaa', 'Batroun', 'Mont-Liban', 'Jezzine'],
    orderIndex: 31
  },

  // --- Nouveau Monde & Autres Pays ---
  {
    id: 'world-afrique-du-sud',
    name: 'Afrique du Sud',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Afrique du Sud',
    subRegions: ['Stellenbosch', 'Swartland', 'Walker Bay (Hemel-en-Aarde)', 'Franschhoek', 'Elgin'],
    orderIndex: 40
  },
  {
    id: 'world-argentine',
    name: 'Argentine',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Argentine',
    subRegions: ['Mendoza (Uco Valley / Luján de Cuyo)', 'Salta (Cafayate)', 'Patagonie'],
    orderIndex: 41
  },
  {
    id: 'world-australie',
    name: 'Australie',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Australie',
    subRegions: [
      'Barossa Valley', 'McLaren Vale', 'Adelaide Hills', 'Yarra Valley',
      'Hunter Valley', 'Margaret River', 'Clare Valley', 'Tasmanie'
    ],
    orderIndex: 42
  },
  {
    id: 'world-nouvelle-zelande',
    name: 'Nouvelle-Zélande',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Nouvelle-Zélande',
    subRegions: [
      'Marlborough', 'Central Otago', 'Hawke\'s Bay',
      'Martinborough / Wairarapa', 'Gisborne', 'Nelson'
    ],
    orderIndex: 43
  },
  {
    id: 'world-chili',
    name: 'Chili',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Chili',
    subRegions: ['Valle del Maipo', 'Colchagua', 'Casablanca', 'Leyda', 'Aconcagua', 'Itata'],
    orderIndex: 44
  },
  {
    id: 'world-usa',
    name: 'États-Unis',
    group: 'Nouveau Monde & Autres Pays',
    country: 'États-Unis',
    subRegions: [
      'Napa Valley', 'Sonoma County', 'Oregon (Willamette Valley)',
      'Washington State (Columbia Valley)', 'Santa Barbara'
    ],
    orderIndex: 45
  },
  {
    id: 'world-japon',
    name: 'Japon',
    group: 'Nouveau Monde & Autres Pays',
    country: 'Japon',
    subRegions: ['Yamanashi (Koshu)', 'Nagano', 'Hokkaido'],
    orderIndex: 46
  },
  {
    id: 'world-autre',
    name: 'Autre',
    group: 'Nouveau Monde & Autres Pays',
    country: 'International',
    subRegions: [],
    orderIndex: 99
  }
];

export interface RegionGroupFormatted {
  group: string;
  regions: string[];
}

/**
 * Transforms a list of WineRegion items into the grouped format for selects & dropdowns
 */
export function formatRegionGroups(regions: WineRegion[]): RegionGroupFormatted[] {
  const groupMap = new Map<string, string[]>();

  // Ensure default groups maintain standard sommelier display order
  DEFAULT_REGION_GROUPS.forEach(grp => {
    groupMap.set(grp, []);
  });

  regions.forEach(r => {
    const grp = r.group || 'Vignobles de France';
    if (!groupMap.has(grp)) {
      groupMap.set(grp, []);
    }
    const list = groupMap.get(grp)!;
    if (!list.includes(r.name)) {
      list.push(r.name);
    }
  });

  const result: RegionGroupFormatted[] = [];
  groupMap.forEach((regList, groupName) => {
    if (regList.length > 0) {
      result.push({ group: groupName, regions: regList });
    }
  });

  return result;
}

/**
 * Builds a dictionary of RegionName -> SubRegions list from dynamic regions
 */
export function buildSubRegionSuggestions(regions: WineRegion[]): Record<string, string[]> {
  const dict: Record<string, string[]> = {};
  regions.forEach(r => {
    if (r.name) {
      dict[r.name] = Array.isArray(r.subRegions) ? r.subRegions : [];
    }
  });
  return dict;
}

/**
 * Generates a clean URL/database-safe ID from a region name
 */
export function generateRegionId(name: string, country?: string): string {
  const cleanStr = (s: string) => s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const cPrefix = country ? cleanStr(country) : 'custom';
  const nSlug = cleanStr(name);
  return `${cPrefix}-${nSlug || Date.now().toString(36)}`;
}

// Backward-compatible exports for existing static usages
export const REGION_GROUPS = formatRegionGroups(DEFAULT_WINE_REGIONS);
export const SUB_REGION_SUGGESTIONS = buildSubRegionSuggestions(DEFAULT_WINE_REGIONS);
export const REGIONS = DEFAULT_WINE_REGIONS.map(r => r.name);

// Functional alias exports
export const getDynamicRegionGroups = formatRegionGroups;
export const getSubRegionSuggestionsMap = buildSubRegionSuggestions;
