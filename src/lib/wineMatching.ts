import { Wine, WineColor, isSameWineReference, normalizeWineString, getCanonicalDomain } from '../types';

export interface WineMatchQuery {
  rawLabel?: string;
  name?: string;
  domain?: string;
  vintage?: string;
  color?: WineColor | string;
  format?: string;
  targetSiteId?: string;
}

export interface WineMatchResult {
  /** The primary wine card matched. If targetSiteId has a match, this is it; otherwise best available site */
  wine: Wine | null;
  /** All wine cards in the catalog matching this same reference across all sites */
  referenceWines: Wine[];
  /** The specific wine card at targetSiteId, if present */
  wineAtTargetSite: Wine | null;
  /** Whether the reference is already present at targetSiteId */
  existsAtTargetSite: boolean;
  /** Total quantity in stock across all sites for this reference */
  totalStockAcrossSites: number;
  /** Quantity by siteId */
  stockBySite: Record<string, number>;
  /** Match confidence / status */
  status: 'perfect' | 'ambiguous' | 'unmatched';
  confidenceScore: number;
}

/**
 * Normalizes a vintage string: removes asterisks, NV notations, spaces
 */
export function normalizeVintage(vintage?: string): string {
  if (!vintage) return '';
  const clean = vintage.toString().replace(/\*/g, '').trim().toLowerCase();
  if (clean === 'nv' || clean === 'sa' || clean === 's.a.' || clean === 'n.v.' || clean === 'sans millesime') {
    return 'N.V.';
  }
  return clean;
}

/**
 * Robust matching engine that resolves a wine query against the entire cellar catalog.
 * Takes into account canonical domain normalization, vintage handling, color matching,
 * and multi-site inventory resolution.
 */
export function findBestWineMatchInCatalog(
  query: WineMatchQuery,
  allWines: Wine[]
): WineMatchResult {
  if (!allWines || allWines.length === 0) {
    return {
      wine: null,
      referenceWines: [],
      wineAtTargetSite: null,
      existsAtTargetSite: false,
      totalStockAcrossSites: 0,
      stockBySite: {},
      status: 'unmatched',
      confidenceScore: 0
    };
  }

  const cleanRaw = normalizeWineString(query.rawLabel || '');
  const cleanDomain = normalizeWineString(getCanonicalDomain(query.domain));
  const cleanName = normalizeWineString(query.name || '');
  const cleanVintage = normalizeVintage(query.vintage);
  const cleanColor = (query.color || '').toString().trim().toLowerCase();

  // 1. First pass: exact reference equality via isSameWineReference or cuvee match
  let matchingRefWines: Wine[] = [];

  if (query.domain && (query.name || cleanRaw)) {
    const nameToCompare = query.name || query.rawLabel;
    const cleanNameToCompare = normalizeWineString(nameToCompare);

    matchingRefWines = allWines.filter(w => {
      // Direct comparison with query object
      if (isSameWineReference(
        {
          name: nameToCompare,
          domain: query.domain,
          vintage: cleanVintage,
          color: query.color,
          format: query.format
        },
        w
      )) {
        return true;
      }

      // Check if cuvee matches exactly (ignoring accents, case, spaces: e.g. "Niña" vs "nina")
      const wDomain = normalizeWineString(getCanonicalDomain(w.domain));
      const qDomain = normalizeWineString(getCanonicalDomain(query.domain));
      const domainMatch = wDomain === qDomain || (wDomain.length > 4 && qDomain.length > 4 && (wDomain.includes(qDomain) || qDomain.includes(wDomain)));
      const wVintage = normalizeVintage(w.vintage);
      const vintageMatch = 
        (cleanVintage && wVintage && cleanVintage === wVintage) ||
        ((cleanVintage === 'N.V.' || !cleanVintage) && (wVintage === 'N.V.' || !wVintage));

      if (domainMatch && vintageMatch) {
        const wCuvee = normalizeWineString(w.cuvee || '');
        const wName = normalizeWineString(w.name || '');
        if (cleanNameToCompare && (
          wCuvee === cleanNameToCompare ||
          wName === cleanNameToCompare ||
          (cleanNameToCompare.length >= 4 && (wName.includes(cleanNameToCompare) || cleanNameToCompare.includes(wName) || (wCuvee && (wCuvee.includes(cleanNameToCompare) || cleanNameToCompare.includes(wCuvee)))))
        )) {
          return true;
        }
      }

      return false;
    });
  }

  let matchStatus: 'perfect' | 'ambiguous' | 'unmatched' = 'unmatched';
  let confidence = 0;

  if (matchingRefWines.length > 0) {
    matchStatus = 'perfect';
    confidence = 95;
  } else {
    // 2. Second pass: Structured matching by canonical domain + name inclusion + vintage
    if (cleanDomain) {
      const domainMatches = allWines.filter(w => {
        const wDomain = normalizeWineString(getCanonicalDomain(w.domain));
        return wDomain === cleanDomain || wDomain.includes(cleanDomain) || cleanDomain.includes(wDomain);
      });

      if (domainMatches.length > 0) {
        // Narrow down by vintage if known
        let pool = domainMatches;
        if (cleanVintage && cleanVintage !== 'N.V.') {
          pool = pool.filter(w => normalizeVintage(w.vintage) === cleanVintage);
        } else if (cleanVintage === 'N.V.') {
          pool = pool.filter(w => !w.vintage || normalizeVintage(w.vintage) === 'N.V.');
        }

        // Narrow down by name or raw label keywords
        const targetSearchString = cleanName || cleanRaw;
        if (targetSearchString) {
          const nameMatches = pool.filter(w => {
            const wName = normalizeWineString(w.name);
            const wAppel = normalizeWineString(w.appellation || '');
            const wCuvee = normalizeWineString(w.cuvee || '');

            return (
              targetSearchString.includes(wName) ||
              wName.includes(targetSearchString) ||
              (wAppel && targetSearchString.includes(wAppel)) ||
              (wCuvee && targetSearchString.includes(wCuvee))
            );
          });

          if (nameMatches.length > 0) {
            matchingRefWines = nameMatches;
            matchStatus = 'perfect';
            confidence = 88;
          }
        }
      }
    }

    // 3. Third pass: Raw label scanning (PMS receipt lines like "1 BOUT CHASSAGNE BLANCHOT 20")
    if (matchingRefWines.length === 0 && cleanRaw) {
      const candidates = allWines.filter(w => {
        const wName = normalizeWineString(w.name);
        const wDomain = normalizeWineString(getCanonicalDomain(w.domain));
        const wVintage = normalizeVintage(w.vintage);

        const hasDomain = wDomain.length > 3 && cleanRaw.includes(wDomain);
        const hasName = wName.length > 3 && cleanRaw.includes(wName);
        const hasVintage = wVintage && wVintage !== 'N.V.' ? cleanRaw.includes(wVintage) : true;

        return (hasDomain && hasName) || (hasName && hasVintage && wName.length > 5);
      });

      if (candidates.length > 0) {
        matchingRefWines = candidates;
        matchStatus = candidates.length === 1 ? 'perfect' : 'ambiguous';
        confidence = candidates.length === 1 ? 80 : 65;
      }
    }

    // 4. Fourth pass: Fallback fuzzy partial match on wine name or domain
    if (matchingRefWines.length === 0 && cleanRaw.length > 4) {
      const partials = allWines.filter(w => {
        const wName = normalizeWineString(w.name);
        const wDomain = normalizeWineString(getCanonicalDomain(w.domain));
        return (cleanRaw.includes(wName) && wName.length > 4) || (cleanRaw.includes(wDomain) && wDomain.length > 4);
      });

      if (partials.length > 0) {
        matchingRefWines = partials;
        matchStatus = 'ambiguous';
        confidence = 50;
      }
    }
  }

  // Multi-site resolution
  if (matchingRefWines.length === 0) {
    return {
      wine: null,
      referenceWines: [],
      wineAtTargetSite: null,
      existsAtTargetSite: false,
      totalStockAcrossSites: 0,
      stockBySite: {},
      status: 'unmatched',
      confidenceScore: 0
    };
  }

  // Find all cards matching the resolved reference across ALL sites
  const firstMatch = matchingRefWines[0];
  const allRefInstances = allWines.filter(w => isSameWineReference(w, firstMatch));

  // Compute stock across sites
  const stockBySite: Record<string, number> = {};
  let totalStockAcrossSites = 0;

  allRefInstances.forEach(w => {
    stockBySite[w.siteId] = (stockBySite[w.siteId] || 0) + (w.quantity || 0);
    totalStockAcrossSites += (w.quantity || 0);
  });

  // Check if wine exists at requested targetSiteId
  let wineAtTargetSite: Wine | null = null;
  if (query.targetSiteId) {
    wineAtTargetSite = allRefInstances.find(w => w.siteId === query.targetSiteId) || null;
  }

  // Choose the primary wine card:
  // 1. If wineAtTargetSite exists, pick it.
  // 2. Otherwise pick the card with highest stock available.
  // 3. Otherwise pick the first card in allRefInstances.
  let primaryWine: Wine = wineAtTargetSite || allRefInstances[0];
  if (!wineAtTargetSite && allRefInstances.length > 1) {
    const sortedByStock = [...allRefInstances].sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    primaryWine = sortedByStock[0];
  }

  return {
    wine: primaryWine,
    referenceWines: allRefInstances,
    wineAtTargetSite,
    existsAtTargetSite: wineAtTargetSite !== null,
    totalStockAcrossSites,
    stockBySite,
    status: matchStatus,
    confidenceScore: confidence
  };
}

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Normalized string similarity ratio between 0 and 1
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Strips common wine prefixes (domaine, chateau, etc.) for deeper stem matching
 */
export function stripWinePrefixes(str: string | undefined): string {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(domaine|dne|chateau|ch|maison|vignobles?|earl|sarl|les|la|le|du|de|d)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export interface WineTypoSuggestion {
  wine: Wine;
  score: number; // 0 to 100
  reason: string;
  domainSimilarity: number;
  nameSimilarity: number;
}

export interface SmartWineMatchOutcome {
  matchedWine: Wine | null;
  suggestedMatch: WineTypoSuggestion | null;
  status: 'matched' | 'suggested' | 'new_ref';
  confidence: number;
}

/**
 * Smart wine matcher with typo detection.
 * Evaluates exact match first. If no perfect match is found, scores the catalog
 * with fuzzy Levenshtein and token overlap to detect typos (e.g. "Thibault Boudignon" vs "Thibaud Boudignon",
 * "Clos de la Hute" vs "Clos de la Hutte").
 */
export function findSmartWineMatchWithTypo(
  query: WineMatchQuery,
  allWines: Wine[]
): SmartWineMatchOutcome {
  if (!allWines || allWines.length === 0) {
    return { matchedWine: null, suggestedMatch: null, status: 'new_ref', confidence: 0 };
  }

  // 1. Try standard matching first
  const standardMatch = findBestWineMatchInCatalog(query, allWines);
  if (standardMatch.wine && standardMatch.confidenceScore >= 88) {
    return {
      matchedWine: standardMatch.wine,
      suggestedMatch: null,
      status: 'matched',
      confidence: standardMatch.confidenceScore
    };
  }

  const queryVintage = normalizeVintage(query.vintage);
  const cleanQDomain = normalizeWineString(getCanonicalDomain(query.domain));
  const strippedQDomain = stripWinePrefixes(query.domain);
  const cleanQName = normalizeWineString(query.name);
  const strippedQName = stripWinePrefixes(query.name);
  const cleanQRaw = normalizeWineString(query.rawLabel);

  let bestCandidate: Wine | null = null;
  let bestScore = 0;
  let bestDomainSim = 0;
  let bestNameSim = 0;
  let bestReason = '';

  for (const w of allWines) {
    const wVintage = normalizeVintage(w.vintage);

    // Vintage check:
    // If both have vintage specified and they don't match, strictly do not match (different vintage)
    let vintageFactor = 1.0;
    const vintagesMatchExactly = 
      (queryVintage && wVintage && queryVintage === wVintage) ||
      ((queryVintage === 'N.V.' || !queryVintage) && (wVintage === 'N.V.' || !wVintage));

    if (queryVintage && wVintage) {
      if (queryVintage === wVintage) {
        vintageFactor = 1.0;
      } else if (queryVintage === 'N.V.' || wVintage === 'N.V.') {
        vintageFactor = 0.8;
      } else {
        // Different vintage (e.g. 2024 vs 2023) -> never match
        vintageFactor = 0.0;
      }
    } else if (!queryVintage && !wVintage) {
      vintageFactor = 1.0;
    } else {
      // One has vintage, the other does not: at most a suggestion (score penalized), NEVER auto-matched >= 90
      vintageFactor = 0.65;
    }

    if (vintageFactor === 0) continue;

    // Domain similarity
    const cleanWDomain = normalizeWineString(getCanonicalDomain(w.domain));
    const strippedWDomain = stripWinePrefixes(w.domain);

    const dSim1 = stringSimilarity(cleanQDomain, cleanWDomain);
    const dSim2 = stringSimilarity(strippedQDomain, strippedWDomain);
    let domainScore = Math.max(dSim1, dSim2);

    // If one contains the other and is long enough
    if ((cleanQDomain.includes(cleanWDomain) || cleanWDomain.includes(cleanQDomain)) && Math.min(cleanQDomain.length, cleanWDomain.length) >= 4) {
      domainScore = Math.max(domainScore, 0.90);
    }
    if ((strippedQDomain.includes(strippedWDomain) || strippedWDomain.includes(strippedQDomain)) && Math.min(strippedQDomain.length, strippedWDomain.length) >= 4) {
      domainScore = Math.max(domainScore, 0.92);
    }

    // Wine name / cuvée / appellation similarity
    const cleanWName = normalizeWineString(w.name);
    const strippedWName = stripWinePrefixes(w.name);
    const cleanWAppel = normalizeWineString(w.appellation);
    const cleanWCuvee = normalizeWineString(w.cuvee);

    const nSim1 = stringSimilarity(cleanQName, cleanWName);
    const nSim2 = stringSimilarity(strippedQName, strippedWName);
    let nameScore = Math.max(nSim1, nSim2);

    // Check cuvee and appellation if present
    if (cleanWCuvee) {
      nameScore = Math.max(nameScore, stringSimilarity(cleanQName, cleanWCuvee));
      nameScore = Math.max(nameScore, stringSimilarity(strippedQName, stripWinePrefixes(w.cuvee)));
    }
    if (cleanWAppel) {
      nameScore = Math.max(nameScore, stringSimilarity(cleanQName, cleanWAppel) * 0.9);
    }

    // Check raw label substring matching
    if (cleanQRaw && cleanWName.length >= 4 && cleanQRaw.includes(cleanWName)) {
      nameScore = Math.max(nameScore, 0.90);
    }

    // Overall weighted composite score
    // Domain: 40%, Cuvée/Name: 60%
    let combinedScore = Math.round((domainScore * 40 + nameScore * 60) * vintageFactor);

    // If cuvee/name is an exact match modulo accents and case (score >= 0.95) and domain is reasonably close,
    // boost confidence ONLY if vintages match exactly!
    if (nameScore >= 0.95 && domainScore >= 0.50 && vintageFactor >= 0.9 && vintagesMatchExactly) {
      combinedScore = Math.max(combinedScore, 92);
    }

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestCandidate = w;
      bestDomainSim = Math.round(domainScore * 100);
      bestNameSim = Math.round(nameScore * 100);

      // Generate helpful sommelier diagnosis
      const reasons: string[] = [];
      if (domainScore >= 0.70 && domainScore < 0.98) {
        reasons.push(`Domaine proche (${bestDomainSim}% : « ${query.domain || ''} » vs « ${w.domain} »)`);
      }
      if (nameScore >= 0.70 && nameScore < 0.98) {
        reasons.push(`Cuvée proche (${bestNameSim}% : « ${query.name || ''} » vs « ${w.name} »)`);
      }
      if (reasons.length === 0) {
        reasons.push(`Forte similarité globale (${combinedScore}%)`);
      }
      bestReason = reasons.join(' • ');
    }
  }

  // Thresholds:
  // >= 90: Almost certain match despite tiny typo (e.g. single accent or trailing s)
  if (bestScore >= 90 && bestCandidate) {
    return {
      matchedWine: bestCandidate,
      suggestedMatch: null,
      status: 'matched',
      confidence: bestScore
    };
  }

  // 65 to 89: Strong candidate for typo / fuzzy match! (e.g. "Hute" vs "Hutte", "Thibault" vs "Thibaud")
  if (bestScore >= 65 && bestCandidate) {
    return {
      matchedWine: null,
      suggestedMatch: {
        wine: bestCandidate,
        score: bestScore,
        reason: bestReason,
        domainSimilarity: bestDomainSim,
        nameSimilarity: bestNameSim
      },
      status: 'suggested',
      confidence: bestScore
    };
  }

  // Under 65: Brand new reference
  return {
    matchedWine: null,
    suggestedMatch: null,
    status: 'new_ref',
    confidence: bestScore
  };
}

