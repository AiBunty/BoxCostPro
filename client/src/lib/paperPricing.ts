import type { PaperBfPrice, ShadePremium, PaperPricingRules } from "@shared/schema";

export interface PaperPricingParams {
  bf: number;
  gsm: number;
  shade: string;
}

export interface PricingData {
  bfPrices: PaperBfPrice[];
  shadePremiums: ShadePremium[];
  rules: PaperPricingRules | null;
}

export interface PaperPriceBreakdown {
  bfBasePrice: number;
  gsmAdjustment: number;
  shadePremium: number;
  marketAdjustment: number;
  finalRate: number;
  notes: string[];
}

export function calculatePaperRate(
  params: PaperPricingParams,
  pricingData: PricingData
): PaperPriceBreakdown | null {
  const { bf, gsm, shade } = params;
  const { bfPrices, shadePremiums, rules } = pricingData;

  const notes: string[] = [];

  const bfPriceEntry = bfPrices.find(p => p.bf === bf);
  if (!bfPriceEntry) {
    return null;
  }

  const bfBasePrice = Number(bfPriceEntry.basePrice);
  notes.push(`BF ${bf} base price: ₹${bfBasePrice.toFixed(2)}`);

  let gsmAdjustment = 0;
  if (rules) {
    const lowLimit = rules.lowGsmLimit ?? 100;
    const highLimit = rules.highGsmLimit ?? 200;
    const lowAdj = Number(rules.lowGsmAdjustment ?? 0);
    const highAdj = Number(rules.highGsmAdjustment ?? 0);

    if (gsm < lowLimit) {
      gsmAdjustment = lowAdj;
      notes.push(`GSM ${gsm} below ${lowLimit}: +₹${lowAdj.toFixed(2)}`);
    } else if (gsm >= highLimit) {
      gsmAdjustment = highAdj;
      notes.push(`GSM ${gsm} at/above ${highLimit}: +₹${highAdj.toFixed(2)}`);
    } else {
      notes.push(`GSM ${gsm} in normal range (${lowLimit}-${highLimit}): no adjustment`);
    }
  }

  const shadeEntry = shadePremiums.find(p => p.shade.toLowerCase() === shade.toLowerCase());
  const shadePremium = shadeEntry ? Number(shadeEntry.premium) : 0;
  if (shadePremium > 0) {
    notes.push(`${shade} shade premium: +₹${shadePremium.toFixed(2)}`);
  } else if (shadeEntry) {
    notes.push(`${shade} shade: no premium`);
  } else {
    notes.push(`${shade} shade: not configured (no premium)`);
  }

  const marketAdjustment = rules ? Number(rules.marketAdjustment ?? 0) : 0;
  if (marketAdjustment !== 0) {
    notes.push(`Market adjustment: ${marketAdjustment >= 0 ? "+" : ""}₹${marketAdjustment.toFixed(2)}`);
  }

  const finalRate = bfBasePrice + gsmAdjustment + shadePremium + marketAdjustment;
  notes.push(`Final rate: ₹${finalRate.toFixed(2)}/Kg`);

  return {
    bfBasePrice,
    gsmAdjustment,
    shadePremium,
    marketAdjustment,
    finalRate,
    notes
  };
}

export function calculatePaperRateSimple(
  bf: number,
  gsm: number,
  shade: string,
  pricingData: PricingData
): number | null {
  const breakdown = calculatePaperRate({ bf, gsm, shade }, pricingData);
  return breakdown ? breakdown.finalRate : null;
}
