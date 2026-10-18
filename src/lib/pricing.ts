/**
 * Utility functions for 4-tier pricing coefficients in Premnord.
 * Tier 1: Purchase price <= 50€  => Coefficient 2.7
 * Tier 2: Purchase price <= 100€ => Coefficient 2.5
 * Tier 3: Purchase price < 200€  => Coefficient 2.2
 * Tier 4: Purchase price >= 200€ => Coefficient 2.0 (x2)
 * All selling prices are rounded up to the nearest whole euro (arrondi à l'euro supérieur).
 */

export function getPricingCoefficient(priceBuy: number): number {
  if (priceBuy >= 200) {
    return 2.0;
  }
  if (priceBuy <= 50) {
    return 2.7;
  }
  if (priceBuy <= 100) {
    return 2.5;
  }
  return 2.2;
}

export function calculateSellingPrice(priceBuy: number): number {
  if (!priceBuy || priceBuy <= 0) return 0;
  const coeff = getPricingCoefficient(priceBuy);
  // Prevent floating point artifacts before ceiling (e.g. 54.00000000000001 -> 54)
  const rawPrice = Math.round(priceBuy * coeff * 100) / 100;
  return Math.ceil(rawPrice);
}

