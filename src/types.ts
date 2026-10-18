export type WineColor = 'rouge' | 'blanc' | 'rose' | 'bulle' | 'orange' | 'spiritueux' | 'cidre_biere' | 'soft' | 'autre';

export const getCanonicalDomain = (domain: string | undefined | null): string => {
  if (!domain || typeof domain !== 'string') return 'Domaine Inconnu';
  const clean = domain
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Supprime les caractères spéciaux
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
  return domain.trim();
};

export const isDPRWine = (wine: { domain?: string; name?: string } | null | undefined): boolean => {
  if (!wine) return false;
  const d = (wine.domain || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (d.includes('prieure') || d.includes('roch') || d.includes('dpr')) return true;
  if (getCanonicalDomain(wine.domain) === 'Domaine Prieuré-Roch') return true;
  return false;
};

export const normalizeWineString = (str: string | undefined | null): string => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents, tildes, cédilles, etc.
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "o")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Supprime les espaces, tirets et caractères non-alphanumériques
    .trim();
};

export const extractWineFormat = (w: any): string => {
  if (w && w.format && typeof w.format === 'string' && w.format.trim()) {
    const rawF = w.format.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(jeroboams?|j[eé]ro\.?)\b/i.test(rawF) || rawF.includes('300cl') || rawF.includes('3l')) return 'jeroboam';
    if (/\b(magnums?|mag\.?)\b/i.test(rawF) || /\(mag\)/i.test(rawF) || rawF.includes('150cl') || rawF.includes('1.5l') || rawF.includes('1,5l')) return 'magnum';
    if (/\b(demies?|demis?|fillettes?)\b/i.test(rawF) || /\(demi\)/i.test(rawF) || rawF.includes('37.5') || rawF.includes('37,5')) return 'demie';
    if (rawF.includes('bouteille') || rawF.includes('75cl') || rawF.includes('0.75') || rawF.includes('0,75')) return 'bouteille';
  }

  // Check name, cuvee, appellation
  const text = `${w?.name || ''} ${w?.cuvee || ''} ${w?.appellation || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(jeroboams?|j[eé]ro\.?)\b/i.test(text) || /\(j[eé]ro\)/i.test(text) || text.includes('300cl') || text.includes('3l')) return 'jeroboam';
  if (/\b(magnums?|mag\.?)\b/i.test(text) || /\(mag\)/i.test(text) || text.includes('150cl') || text.includes('1.5l') || text.includes('1,5l')) return 'magnum';
  if (/\b(demies?|demis?|fillettes?)\b/i.test(text) || /\(demi\)/i.test(text) || text.includes('37.5') || text.includes('37,5') || text.includes('375ml')) return 'demie';

  // Check notes as fallback
  const notes = `${w?.notes || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(jeroboams?)\b/i.test(notes) || notes.includes('300cl')) return 'jeroboam';
  if (/\b(magnums?)\b/i.test(notes) || notes.includes('150cl')) return 'magnum';
  if (/\b(demies?|fillettes?)\b/i.test(notes) || notes.includes('37.5cl')) return 'demie';

  return 'bouteille';
};

export const cleanWineName = (raw: string | undefined | null): string => {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\b(magnums?|mag\.?|jeroboams?|j[eé]ro\.?|fillettes?|demie?s?|bouteilles?|bt|cl|ml)\b/gi, ' ')
    .replace(/\((mag|demi|jero|bte)\)/gi, ' ')
    .replace(/\b(150\s*cl|1[.,]5\s*l|75\s*cl|0[.,]75\s*l|37[.,]5\s*cl|300\s*cl|3\s*l)\b/gi, ' ')
    .replace(/[-–—/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getWineReferenceKey = (w: any): string => {
  if (!w) return '';
  const d = normalizeWineString(getCanonicalDomain(w.domain));
  const appel = cleanWineName(w.appellation || '');
  const cuvee = cleanWineName(w.cuvee || '');
  const rawClean = cleanWineName(w.name || '');

  let n = normalizeWineString(rawClean);
  if (appel || cuvee) {
    const syn = normalizeWineString(`${appel}${cuvee}`);
    if (syn) n = syn;
  }

  const v = (w.vintage || '').toString().trim().toLowerCase();
  const c = (w.color || '').toString().trim().toLowerCase();
  const f = extractWineFormat(w);
  return `${d}__${n}__${v}__${c}__${f}`;
};

export const isSameWineReference = (
  w1: any,
  w2: any
): boolean => {
  if (!w1 || !w2) return false;
  
  // Early bailout on vintage
  const v1 = (w1.vintage || '').toString().trim().toLowerCase();
  const v2 = (w2.vintage || '').toString().trim().toLowerCase();
  if (v1 !== v2) return false;

  // Early bailout on normalized domain
  const d1 = normalizeWineString(getCanonicalDomain(w1.domain));
  const d2 = normalizeWineString(getCanonicalDomain(w2.domain));
  if (d1 !== d2) return false;

  const c1 = (w1.color || '').toString().trim().toLowerCase();
  const c2 = (w2.color || '').toString().trim().toLowerCase();
  const colorMatches = (!c1 || !c2) ? true : c1 === c2;
  if (!colorMatches) return false;

  const f1 = extractWineFormat(w1);
  const f2 = extractWineFormat(w2);
  if (f1 !== f2) return false;

  // Compare normalized name or synthesized appellation + cuvee (with format/punctuation stripped)
  const n1 = normalizeWineString(cleanWineName(w1.name));
  const n2 = normalizeWineString(cleanWineName(w2.name));
  if (n1 && n2 && n1 === n2) return true;

  const appel1 = normalizeWineString(cleanWineName(w1.appellation || ''));
  const cuvee1 = normalizeWineString(cleanWineName(w1.cuvee || ''));
  const syn1 = `${appel1}${cuvee1}`;

  const appel2 = normalizeWineString(cleanWineName(w2.appellation || ''));
  const cuvee2 = normalizeWineString(cleanWineName(w2.cuvee || ''));
  const syn2 = `${appel2}${cuvee2}`;

  const nameMatches = 
    Boolean(syn1 && syn2 && syn1 === syn2) ||
    Boolean(syn1 && syn1 === n2) ||
    Boolean(syn2 && syn2 === n1);

  return nameMatches;
};

export interface Site {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface TechnicalSheet {
  aop?: string;
  lieuDit?: string;
  sol?: string;
  cepage?: string;
  ageVignes?: string;
  rendement?: string;
  densite?: string;
  surface?: string;
  culture?: string;
  vinification?: string;
  elevage?: string;
  degustation?: {
    oeil?: string;
    nez?: string;
    bouche?: string;
  };
  service?: {
    temperature?: string;
    garde?: string;
    accords?: string;
  };
  hasGenerated?: boolean;
}

export interface Wine {
  id: string;
  name: string;
  domain: string;
  vintage: string;
  color: WineColor;
  region?: string;
  subRegion?: string;
  country?: string;
  quantity: number;
  alertThreshold: number;
  siteId: string;
  bin?: string;
  priceBuy?: number;
  priceBuyHt?: number;
  shippingCost?: number;
  priceSell?: number;
  notes?: string;
  hideFromMenu?: boolean;
  createdAt: number;
  updatedAt: number;
  appellation?: string;
  cuvee?: string;
  technicalSheet?: TechnicalSheet;
  isPreSale?: boolean;
  format?: string;
}

export type MovementType = 'in' | 'out' | 'transfer' | 'correction';
export type MovementReason = 'livraison' | 'vente' | 'casse' | 'correction' | 'transfert' | 'autre';

export interface Movement {
  id: string;
  wineId: string;
  wineName: string;
  type: MovementType;
  quantity: number;
  fromSiteId?: string;
  toSiteId?: string;
  reason: MovementReason;
  notes?: string;
  userId: string;
  userName: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface WineRegion {
  id: string;
  name: string;
  group: string;
  country: string;
  subRegions: string[];
  orderIndex?: number;
  description?: string;
  isSystem?: boolean;
}

export interface RegionSettingsDoc {
  regions: WineRegion[];
  groups: string[];
  updatedAt: number;
}
