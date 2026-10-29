/**
 * Bangladeshi Market Pricing Intelligence (DAM / TCB Benchmarks).
 *
 * Provides real market prices in BDT for staples, produce, proteins,
 * and spices across Dhaka/Bangladesh wet markets (Kawran Bazar/DAM benchmarks).
 * Replaces hardcoded ৳40 placeholders with authentic unit economics.
 */

import marketData from '../../app/data/bd_market_prices.json';

export interface MarketPriceItem {
  name: string;
  name_bn: string;
  aliases: string[];
  category: string;
  unit: string;
  price_bdt: number;
  default_pack_g: number;
}

export const MARKET_PRICES: MarketPriceItem[] = marketData as MarketPriceItem[];

const LOOKUP_MAP = new Map<string, MarketPriceItem>();

// Index names and aliases for fast O(1) matching
for (const item of MARKET_PRICES) {
  LOOKUP_MAP.set(item.name.toLowerCase().trim(), item);
  LOOKUP_MAP.set(item.name_bn.trim(), item);
  for (const alias of item.aliases) {
    LOOKUP_MAP.set(alias.toLowerCase().trim(), item);
  }
}

/**
 * Find exact or fuzzy matching market item.
 */
export function findMarketPrice(name: string): MarketPriceItem | undefined {
  if (!name) return undefined;
  const clean = name.toLowerCase().trim();

  // 1. Exact match
  if (LOOKUP_MAP.has(clean)) {
    return LOOKUP_MAP.get(clean);
  }

  // 2. Substring or token match
  const tokens = clean.split(/[\s,/-]+/).filter((t) => t.length > 2);
  for (const item of MARKET_PRICES) {
    const itemTokens = (item.name + ' ' + item.aliases.join(' ')).toLowerCase();
    if (tokens.some((t) => itemTokens.includes(t))) {
      return item;
    }
  }

  return undefined;
}

/**
 * Resolve price and calculate realistic cost in BDT for a given quantity in grams.
 */
export function resolveMarketPrice(
  name: string,
  quantityGrams: number = 1000,
): {
  unitPrice: number;
  estimatedCost: number;
  unitLabel: string;
  name_bn: string;
  matched: boolean;
} {
  const item = findMarketPrice(name);
  if (!item) {
    // Sensible fallback estimate if item is completely unknown
    const defaultCost = Math.max(20, Math.round((quantityGrams / 1000) * 120));
    return {
      unitPrice: 120,
      estimatedCost: defaultCost,
      unitLabel: 'কেজি / kg',
      name_bn: name,
      matched: false,
    };
  }

  // Calculate proportional cost
  // price_bdt is for default_pack_g (e.g. 1000g for kg, 600g for dozen eggs)
  const factor = quantityGrams / (item.default_pack_g || 1000);
  const estimatedCost = Math.max(5, Math.round(item.price_bdt * factor));

  return {
    unitPrice: item.price_bdt,
    estimatedCost,
    unitLabel: item.unit,
    name_bn: item.name_bn,
    matched: true,
  };
}
