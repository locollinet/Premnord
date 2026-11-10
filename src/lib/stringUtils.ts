import { Wine } from '../types';

/**
 * Supprime les accents, tildes (ñ/Ñ), cédilles (ç/Ç), trémas (ë/ï/ü/ö/ä),
 * ligatures (œ, æ) et normalise en minuscules pour comparaison insensible.
 */
export function removeAccents(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques combinés (accents, tildes, cédilles, etc.)
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'o')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim();
}

/**
 * Normalise un texte en conservant uniquement les caractères alphanumériques séparés par un espace simple.
 */
export function normalizePhrase(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return removeAccents(str)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise un texte de recherche en conservant les espaces entre mots
 * mais en supprimant les accents, la ponctuation inutile et en passant en minuscules.
 */
export function normalizeSearchTokens(str: string | undefined | null): string[] {
  if (!str || typeof str !== 'string') return [];
  const clean = normalizePhrase(str);
  if (!clean) return [];
  const rawTokens = clean.split(' ').filter(token => token.length > 0);
  // Ignore les élisions d'une seule lettre ("d", "l") lorsqu'il y a d'autres mots significatifs (ex: "Cote d'or" -> ["cote", "or"])
  const meaningful = rawTokens.filter(t => !(t.length === 1 && (t === 'd' || t === 'l')));
  return meaningful.length > 0 ? meaningful : rawTokens;
}

/**
 * Simplifie l'orthographe phonétique française (vins / régions) pour tolérer les fautes courantes
 * ex: "Bourgnonne" / "bourgeonne" / "Bourgogne" -> même squelette
 */
function phoneticFrenchKey(word: string): string {
  return word
    .replace(/geonn/g, 'gogn')
    .replace(/gnonn/g, 'gogn')
    .replace(/gnon/g, 'gogn')
    .replace(/bourgn/g, 'bourg')
    .replace(/bourge/g, 'bourg')
    .replace(/([a-z])\1+/g, '$1') // dédouble les consonnes/voyelles répétées (nn -> n, ll -> l)
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'k')
    .replace(/y/g, 'i');
}

/**
 * Distance de Damerau-Levenshtein (insertions, suppressions, substitutions et transpositions adjacentes)
 */
function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (Math.abs(lenA - lenB) > 3) return Math.abs(lenA - lenB);

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // suppression
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost); // transposition
      }
    }
  }
  return dp[lenA][lenB];
}

/**
 * Normalise un texte de vin en enrichissant avec les équivalences œnologiques courantes :
 * - "st" <-> "saint" (ex: "st-aubin" <-> "saint-aubin", "nuits-st-georges" <-> "nuits-saint-georges")
 * - "1er" / "1ers" <-> "premier" / "premiers"
 * - "gd cru" / "gc" <-> "grand cru"
 */
export function normalizeWineText(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  let clean = removeAccents(str).toLowerCase();
  
  // Remplacer ponctuation par des espaces simples
  clean = clean.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Normaliser les abréviations ultra courantes
  clean = clean
    .replace(/\bst\b/g, 'saint')
    .replace(/\b1er\b/g, 'premier')
    .replace(/\b1ers\b/g, 'premiers')
    .replace(/\bgc\b/g, 'grand cru');

  return clean;
}

/**
 * Extrait les expressions entre guillemets ("...", «...», “...”) pour une recherche exacte,
 * et les tokens libres hors guillemets pour une recherche multi-mots.
 */
export function parseSearchQuery(searchQuery: string): {
  exactPhrases: string[];
  looseTokens: string[];
} {
  const exactPhrases: string[] = [];
  let remaining = searchQuery || '';

  // Capture "...", «...», “...”
  const quoteRegex = /(?:"([^"]+)"|«([^»]+)»|“([^”]+)”)/g;
  remaining = remaining.replace(quoteRegex, (_match, g1, g2, g3) => {
    const phrase = normalizeWineText(g1 || g2 || g3 || '');
    if (phrase) exactPhrases.push(phrase);
    return ' ';
  });

  // Si l'utilisateur a ouvert un guillemet sans le refermer
  const unclosedQuoteMatch = remaining.match(/(?:["«“])([^"»”]+)$/);
  if (unclosedQuoteMatch) {
    const phrase = normalizeWineText(unclosedQuoteMatch[1]);
    if (phrase) exactPhrases.push(phrase);
    remaining = remaining.slice(0, unclosedQuoteMatch.index);
  }

  const cleanRemaining = normalizeWineText(remaining);
  if (!cleanRemaining) {
    return { exactPhrases, looseTokens: [] };
  }

  const rawTokens = cleanRemaining.split(' ').filter(Boolean);
  // Élimine les articles d'une seule lettre ('d', 'l') sauf si la requête ne contient que ça
  const looseTokens = rawTokens.filter(t => !(t.length === 1 && (t === 'd' || t === 'l')));
  return {
    exactPhrases,
    looseTokens: looseTokens.length > 0 ? looseTokens : rawTokens
  };
}

/**
 * Vérifie si un token individuel correspond au texte d'un vin :
 * 1. Mot exact dans la cible (ex: "chapuis" === "chapuis")
 * 2. Préfixe d'un mot (ex: "chapu" -> "chapuis", "chabl" -> "chablis")
 * 3. Sous-chaîne dans un mot individuel de la cible (au moins 4 lettres, ex: "montrachet" dans "puligny-montrachet")
 * 4. Recherche concaténée sans espace (au moins 6 lettres, ex: "saintaubin" dans "saint aubin")
 * 5. Alias spécifique DPR ("dpr" -> "Domaine Prieuré-Roch")
 *
 * NOTE : Ne JAMAIS autoriser de substitution arbitraire de lettres qui confond des noms de domaines
 * ou appellations distincts (comme "Chapuis" avec "Chablis", ou "Corton" avec "Cotton").
 */
export function tokenMatchesWine(
  token: string,
  targetWords: string[],
  normalizedFullTarget: string,
  compactTarget: string
): boolean {
  if (!token) return true;

  // 1. Mot exact dans la cible
  if (targetWords.includes(token)) return true;

  // 2. Préfixe d'un mot de la cible (si le token fait au moins 2 lettres)
  // Ex: "chapu" -> "chapuis", "ladoi" -> "ladoix", "meurs" -> "meursault"
  for (const word of targetWords) {
    if (word.startsWith(token)) return true;
  }

  // 3. Sous-chaîne dans un mot individuel de la cible (au moins 4 lettres)
  // Ex: "montrachet" dans "puligny-montrachet", "corvees" dans "clos-des-corvees"
  if (token.length >= 4) {
    for (const word of targetWords) {
      if (word.includes(token)) return true;
    }
  }

  // 4. Cas où l'utilisateur a tapé une formule sans espace (au moins 6 lettres pour éviter collisions inter-mots)
  // Ex: "saintaubin" ou "prieureroch" ou "closdescorvees"
  if (token.length >= 6 && compactTarget.includes(token)) {
    return true;
  }

  // 5. Cas spécifique Domaine Prieuré-Roch ("dpr")
  if (token === 'dpr' && (normalizedFullTarget.includes('prieure roch') || normalizedFullTarget.includes('roch'))) {
    return true;
  }

  return false;
}

/**
 * Vérifie si un vin correspond à une requête de recherche :
 * - Entre guillemets ("...") : recherche de la formule exacte contiguë.
 * - Sans guillemets (ex: "chapuis aloxe", "prieure roch clos") : tous les termes doivent être présents.
 */
export function matchesWineSearch(
  wine: Partial<Wine>,
  searchQuery: string,
  extraSearchText?: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const { exactPhrases, looseTokens } = parseSearchQuery(searchQuery);
  if (exactPhrases.length === 0 && looseTokens.length === 0) return true;

  const name = wine.name || '';
  const domain = wine.domain || '';
  const cuvee = wine.cuvee || '';
  const appellation = wine.appellation || '';
  const vintage = (wine.vintage || '').toString();
  const region = wine.region || '';
  const subRegion = wine.subRegion || '';
  const country = wine.country || '';
  const bin = wine.bin || '';
  const notes = wine.notes || '';
  const extra = extraSearchText || '';

  // Cible complète normalisée avec gestion des accents, de la ponctuation et des abréviations
  const rawTarget = `${name} ${domain} ${cuvee} ${appellation} ${vintage} ${region} ${subRegion} ${country} ${bin} ${notes} ${extra}`;
  const normalizedTarget = normalizeWineText(rawTarget);
  const compactTarget = normalizedTarget.replace(/\s+/g, '');
  const targetWords = normalizedTarget.split(' ').filter(Boolean);

  // 1. Toutes les formules entre guillemets doivent être présentes exactement (mots contigus)
  for (const phrase of exactPhrases) {
    const padded = ` ${normalizedTarget} `;
    if (!padded.includes(` ${phrase} `) && !normalizedTarget.includes(phrase)) {
      return false;
    }
  }

  // 2. Tous les mots hors guillemets doivent matcher
  return looseTokens.every(token =>
    tokenMatchesWine(token, targetWords, normalizedTarget, compactTarget)
  );
}

/**
 * Calcule un score de pertinence pour trier les résultats de recherche :
 * Correspondance exacte ou préfixe sur le Domaine / Appellation / Nom en tête,
 * puis correspondance dans la cuvée ou les notes.
 */
export function getWineSearchRelevanceScore(wine: Partial<Wine>, searchQuery: string): number {
  if (!searchQuery || !searchQuery.trim()) return 0;

  const cleanQ = normalizeWineText(searchQuery);
  if (!cleanQ) return 0;

  const cleanDomain = normalizeWineText(wine.domain || '');
  const cleanName = normalizeWineText(wine.name || '');
  const cleanAppellation = normalizeWineText(wine.appellation || '');
  const cleanCuvee = normalizeWineText(wine.cuvee || '');

  // DPR alias
  if (cleanQ === 'dpr' && (cleanDomain.includes('prieure roch') || cleanDomain.includes('roch'))) {
    return 100;
  }

  // Correspondance exacte sur le domaine ou l'appellation
  if (cleanDomain === cleanQ || cleanAppellation === cleanQ) return 100;
  if (cleanDomain.startsWith(cleanQ) || cleanAppellation.startsWith(cleanQ)) return 90;

  // Correspondance exacte sur le nom du vin ou la cuvée
  if (cleanName === cleanQ || cleanCuvee === cleanQ) return 85;
  if (cleanName.startsWith(cleanQ) || cleanCuvee.startsWith(cleanQ)) return 75;

  // Domaine contient la recherche complète
  if (cleanDomain.includes(cleanQ)) return 65;

  // Nom ou cuvée contient la recherche
  if (cleanName.includes(cleanQ) || cleanCuvee.includes(cleanQ) || cleanAppellation.includes(cleanQ)) return 50;

  // Score basé sur les tokens individuels
  const tokens = cleanQ.split(' ').filter(Boolean);
  let tokenScore = 0;
  for (const t of tokens) {
    if (cleanDomain.includes(t)) tokenScore += 15;
    if (cleanName.includes(t)) tokenScore += 10;
    if (cleanAppellation.includes(t)) tokenScore += 10;
  }

  return Math.min(45, 10 + tokenScore);
}
