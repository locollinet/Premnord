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
 * Normalise un texte de recherche en conservant les espaces entre mots
 * mais en supprimant les accents, la ponctuation inutile et en passant en minuscules.
 */
export function normalizeSearchTokens(str: string | undefined | null): string[] {
  if (!str || typeof str !== 'string') return [];
  const clean = removeAccents(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  
  if (!clean) return [];
  return clean.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Vérifie si un vin correspond à une requête de recherche (multi-mots, insensible aux accents).
 * Ex: si l'utilisateur tape "nina", elle propose aussi "niña".
 * Ex: si l'utilisateur tape "nina 20", elle trouve "Domaine ... Niña 2020".
 */
export function matchesWineSearch(
  wine: Wine,
  searchQuery: string,
  extraSearchText?: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const tokens = normalizeSearchTokens(searchQuery);
  if (tokens.length === 0) return true;

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

  // Chaîne complète sans accent avec espaces
  const combinedTarget = removeAccents(
    `${name} ${domain} ${cuvee} ${appellation} ${vintage} ${region} ${subRegion} ${country} ${bin} ${extra}`
  );

  // Version compactée (sans espaces ni ponctuation) pour tolérer les mots collés
  const compactTarget = combinedTarget.replace(/[^a-z0-9]/g, '');

  // Tous les tokens tapés par l'utilisateur doivent matcher dans la cible
  return tokens.every(token => {
    if (combinedTarget.includes(token)) return true;
    const compactToken = token.replace(/[^a-z0-9]/g, '');
    return compactToken.length > 0 && compactTarget.includes(compactToken);
  });
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
