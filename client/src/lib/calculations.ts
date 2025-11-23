import type { LayerSpec } from "@shared/schema";

// Unit conversion utilities
export const mmToInches = (mm: number): number => mm / 25.4;
export const inchesToMm = (inches: number): number => inches * 25.4;

// McKee Formula for Box Compression Test (BCT)
// BCT (Kg) = 5.87 * ECT (kN/m) * sqrt(Board Thickness (mm) * Box Perimeter (mm))
export function calculateMcKeeFormula(params: {
  ect: number; // Edge Crush Test in kN/m
  boardThickness: number; // Board thickness in mm
  boxPerimeter: number; // Box perimeter in mm
}): number {
  const { ect, boardThickness, boxPerimeter } = params;
  // BCT = 5.87 * ECT * √(Board Thickness * Box Perimeter)
  return 5.87 * ect * Math.sqrt((boardThickness / 10) * boxPerimeter); // Convert mm thickness to cm
}

// Calculate Edge Crush Test (ECT) based on RCT values of each layer
// ECT = RCT Liners + (Flute Factor * RCT Fluting) for each layer
export function calculateECT(layerSpecs: LayerSpec[]): number {
  if (layerSpecs.length === 0) return 3.0; // Default ECT
  
  let ectValue = 0;
  for (const spec of layerSpecs) {
    const rct = spec.rctValue || 0;
    if (spec.layerType === 'liner') {
      // For liner: add RCT directly
      ectValue += rct;
    } else {
      // For flute: multiply RCT by fluting factor
      const flutingFactor = spec.flutingFactor || 1.5;
      ectValue += rct * flutingFactor;
    }
  }
  
  return ectValue; // kN/m
}

// Calculate board thickness based on ply and layer specifications
export function calculateBoardThickness(
  ply: string,
  layerSpecs: LayerSpec[],
  defaultThicknessMap: Record<string, number>
): number {
  // If custom layer specs are provided with fluting factors, calculate from those
  if (layerSpecs.length > 0) {
    return layerSpecs.reduce((total, spec) => {
      const baseThickness = spec.gsm / 1000; // Convert GSM to approximate mm
      const flutingFactor = spec.flutingFactor || 1;
      return total + (baseThickness * flutingFactor);
    }, 0);
  }
  
  // Otherwise use default thickness map
  return defaultThicknessMap[ply] || 3.5;
}

// Calculate sheet dimensions for RSC box
export function calculateRSCSheet(params: {
  length: number; // mm
  width: number; // mm
  height: number; // mm
  glueFlap: number; // mm
  deckleAllowance: number; // mm
  maxLengthThreshold?: number; // mm
  ply: string;
}): {
  sheetLength: number;
  sheetWidth: number;
  additionalFlapApplied: boolean;
} {
  const { length, width, height, glueFlap, deckleAllowance, maxLengthThreshold, ply } = params;
  
  let sheetLength = (2 * (length + width)) + glueFlap;
  let additionalFlapApplied = false;
  
  // Check if additional flap needed for 2-pcs boxes (length threshold logic)
  if (maxLengthThreshold && sheetLength > maxLengthThreshold) {
    const glueFlapDefaults: Record<string, number> = {
      '1': 50, '3': 50, '5': 60, '7': 70, '9': 80,
    };
    const defaultGlueFlap = glueFlapDefaults[ply] || 50;
    sheetLength += defaultGlueFlap; // Add additional flap
    additionalFlapApplied = true;
  }
  
  const sheetWidth = width + height + deckleAllowance;
  
  return { sheetLength, sheetWidth, additionalFlapApplied };
}

// Calculate sheet dimensions for flat sheet
export function calculateFlatSheet(params: {
  length: number; // mm
  width: number; // mm
  allowance: number; // mm
}): {
  sheetLength: number;
  sheetWidth: number;
} {
  const { length, width, allowance } = params;
  return {
    sheetLength: length + allowance,
    sheetWidth: width + allowance,
  };
}

// Calculate sheet weight
export function calculateSheetWeight(params: {
  sheetLength: number; // mm
  sheetWidth: number; // mm
  layerSpecs: LayerSpec[];
  ply: string;
}): number {
  const { sheetLength, sheetWidth, layerSpecs, ply } = params;
  const area_m2 = (sheetLength / 1000) * (sheetWidth / 1000);
  
  // Calculate total GSM from layer specs
  const totalGsm = layerSpecs.length > 0
    ? layerSpecs.reduce((sum, spec) => sum + spec.gsm, 0)
    : 180; // default
  
  const plyNum = parseInt(ply);
  const weight = area_m2 * totalGsm * (plyNum === 1 ? 1 : plyNum / 2) / 1000;
  
  return weight; // Kg
}

// Calculate Burst Strength (BS)
export function calculateBurstStrength(layerSpecs: LayerSpec[]): number {
  if (layerSpecs.length === 0) return 12; // default
  
  const avgGsm = layerSpecs.reduce((sum, spec) => sum + spec.gsm, 0) / layerSpecs.length;
  const avgBF = layerSpecs.reduce((sum, spec) => sum + (spec.bf || 12), 0) / layerSpecs.length;
  
  return (avgGsm * avgBF) / 500; // kg/cm
}

// Calculate paper cost
export function calculatePaperCost(weight: number, layerSpecs: LayerSpec[]): number {
  if (layerSpecs.length === 0) return weight * 55; // default rate
  
  const avgRate = layerSpecs.reduce((sum, spec) => sum + spec.rate, 0) / layerSpecs.length;
  return weight * avgRate;
}

// Calculate total manufacturing costs
export function calculateTotalCost(params: {
  paperCost: number;
  printingCost: number;
  laminationCost: number;
  varnishCost: number;
  dieCost: number;
  punchingCost: number;
  markup?: number; // percentage markup, default 15%
}): number {
  const { paperCost, printingCost, laminationCost, varnishCost, dieCost, punchingCost, markup = 15 } = params;
  
  const totalFixedCosts = printingCost + laminationCost + varnishCost + dieCost + punchingCost;
  const totalCost = paperCost + totalFixedCosts;
  
  return totalCost * (1 + markup / 100);
}
