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
 * Extrait les expressions entre guillemets ("...", «...», “...”) pour une recherche exacte,
 * et les tokens libres hors guillemets pour une recherche multi-mots tolérante aux fautes.
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
    const phrase = normalizePhrase(g1 || g2 || g3 || '');
    if (phrase) exactPhrases.push(phrase);
    return ' ';
  });

  // Si l'utilisateur a ouvert un guillemet sans le refermer (ex: `"Cote d'or`), on traite la fin comme phrase exacte
  const unclosedQuoteMatch = remaining.match(/(?:["«“])([^"»”]+)$/);
  if (unclosedQuoteMatch) {
    const phrase = normalizePhrase(unclosedQuoteMatch[1]);
    if (phrase) exactPhrases.push(phrase);
    remaining = remaining.slice(0, unclosedQuoteMatch.index);
  }

  const looseTokens = normalizeSearchTokens(remaining);
  return { exactPhrases, looseTokens };
}

/**
 * Vérifie si un token libre matche dans la cible (exact, préfixe ou tolérant aux fautes de frappe).
 */
function matchesLooseToken(
  token: string,
  normalizedTarget: string,
  compactTarget: string,
  targetWords: string[]
): boolean {
  if (normalizedTarget.includes(token)) return true;
  if (token.length >= 2 && compactTarget.includes(token)) return true;

  // Pour les mots d'au moins 4 lettres, tolérance aux fautes de frappe (ex: "Bourgnonne" ou "bourgeonne" -> "Bourgogne")
  if (token.length >= 4) {
    const tokenPhonetic = phoneticFrenchKey(token);
    const maxDist = token.length >= 7 ? 2 : 1;

    for (const word of targetWords) {
      if (word.length < 3) continue;
      const wordPhonetic = phoneticFrenchKey(word);
      if (wordPhonetic.includes(tokenPhonetic) || tokenPhonetic.includes(wordPhonetic)) {
        if (Math.abs(wordPhonetic.length - tokenPhonetic.length) <= 2) return true;
      }
      if (damerauLevenshtein(token, word) <= maxDist) return true;
      if (damerauLevenshtein(tokenPhonetic, wordPhonetic) <= 1) return true;
      // Si le mot cible est plus long, compare avec le préfixe du mot cible
      if (word.length > token.length && token.length >= 5) {
        const prefix = word.slice(0, token.length);
        if (damerauLevenshtein(token, prefix) <= 1) return true;
      }
    }
  }

  return false;
}

/**
 * Vérifie si un vin correspond à une requête de recherche :
 * - Entre guillemets ("...") : recherche de la formule exacte contiguë.
 * - Sans guillemets (ex: Bourgnonne Cote d'or) : cherche chaque mot (cote / or / bourgogne) avec tolérance aux fautes.
 */
export function matchesWineSearch(
  wine: Wine,
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
  const extra = extraSearchText || '';

  // Chaîne complète normalisée (espaces simples, sans ponctuation ni accents)
  const normalizedTarget = normalizePhrase(
    `${name} ${domain} ${cuvee} ${appellation} ${vintage} ${region} ${subRegion} ${country} ${bin} ${extra}`
  );
  // Version sans élision d'/l' pour que la formule exacte "cote d'or" ou "cote or" matche aussi bien "Côte-d'Or" que "Côte d'Or"
  const normalizedTargetNoElision = normalizedTarget.replace(/\b[dl]\s+/g, '');
  const compactTarget = normalizedTarget.replace(/\s+/g, '');
  const targetWords = normalizedTarget.split(' ').filter(Boolean);

  // 1. Toutes les formules entre guillemets doivent être présentes exactement (mots contigus dans l'ordre)
  for (const phrase of exactPhrases) {
    const phraseNoElision = phrase.replace(/\b[dl]\s+/g, '');
    const paddedTarget = ` ${normalizedTarget} `;
    const paddedTargetNoElision = ` ${normalizedTargetNoElision} `;
    const exactMatch =
      paddedTarget.includes(` ${phrase} `) ||
      normalizedTarget.includes(phrase) ||
      (phraseNoElision.length > 0 && paddedTargetNoElision.includes(` ${phraseNoElision} `));
    if (!exactMatch) return false;
  }

  // 2. Tous les mots hors guillemets doivent matcher (exact ou tolérant aux fautes comme Bourgnonne -> Bourgogne)
  return looseTokens.every(token =>
    matchesLooseToken(token, normalizedTarget, compactTarget, targetWords)
  );
}

/**
 * Calcule un score de pertinence pour trier les résultats de recherche :
 * Correspondance exacte en tête, puis préfixe, puis inclusion.
 */
export function getWineSearchRelevanceScore(wine: Wine, searchQuery: string): number {
  if (!searchQuery || !searchQuery.trim()) return 0;
  
  const cleanQ = removeAccents(searchQuery).replace(/[^a-z0-9]/g, '');
  if (!cleanQ) return 0;

  const cleanName = removeAccents(wine.name || '').replace(/[^a-z0-9]/g, '');
  const cleanDomain = removeAccents(wine.domain || '').replace(/[^a-z0-9]/g, '');
  const cleanCuvee = removeAccents(wine.cuvee || '').replace(/[^a-z0-9]/g, '');

  if (cleanName === cleanQ || cleanCuvee === cleanQ) return 100;
  if (cleanName.startsWith(cleanQ) || cleanCuvee.startsWith(cleanQ)) return 80;
  if (cleanDomain === cleanQ) return 70;
  if (cleanDomain.startsWith(cleanQ)) return 60;
  if (cleanName.includes(cleanQ) || cleanCuvee.includes(cleanQ)) return 50;
  if (cleanDomain.includes(cleanQ)) return 40;

  return 10;
}
