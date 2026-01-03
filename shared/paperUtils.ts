import type { PaperShade } from "./schema";

export interface LayerData {
  shade: string;
  gsm?: number;
  bf?: number;
}

export interface PaperSpecResult {
  paperSpec: string;
  errors: string[];
  isValid: boolean;
}

// CANONICAL ABBREVIATION MAP - Single source of truth for paper shade abbreviations
// These abbreviations appear in Paper Specs, Reports, Calculator, and all exports
// Format: <ABBR><GSM>/<BF> — Example: KRA120/32, VKL180/24
const SHADE_ABBREVIATION_MAP: Record<string, string> = {
  "kraft/natural": "KRA",
  "kraft": "KRA",
  "natural": "KRA",
  "testliner": "TST",
  "virgin kraft liner": "VKL",
  "white kraft liner": "WKL",
  "white top testliner": "WTT",
  "duplex grey back (lwc)": "LWC",
  "lwc": "LWC",
  "duplex grey back (hwc)": "HWC",
  "hwc": "HWC",
  "semi chemical fluting": "SCF",
  "recycled fluting": "RCF",
  "rcf": "RCF",
  "bagasse (agro based)": "BAG",
  "bagasse": "BAG",
  "golden kraft": "GOL",
  "golden": "GOL",
};

/**
 * Get the canonical abbreviation for a paper shade name.
 * First checks shadesList (from database), then falls back to hardcoded map.
 * If no match found, generates abbreviation from first letters.
 */
export function getShadeAbbreviation(shadeName: string, shadesList?: PaperShade[]): string {
  if (!shadeName) return "UNK";
  
  const normalizedName = shadeName.toLowerCase().trim();
  
  // Priority 1: Check database shades list
  if (shadesList && shadesList.length > 0) {
    const shade = shadesList.find(
      s => s.shadeName.toLowerCase() === normalizedName
    );
    if (shade) return shade.abbreviation;
  }
  
  // Priority 2: Check hardcoded abbreviation map
  if (SHADE_ABBREVIATION_MAP[normalizedName]) {
    return SHADE_ABBREVIATION_MAP[normalizedName];
  }
  
  // Priority 3: Check partial matches
  const partialMatch = Object.entries(SHADE_ABBREVIATION_MAP).find(
    ([key]) => normalizedName.includes(key) || key.includes(normalizedName)
  );
  if (partialMatch) return partialMatch[1];
  
  // Fallback: Generate abbreviation from first letters (max 3 chars)
  const generated = shadeName.split(/\s+/).map(word => word[0]?.toUpperCase() || "").join("").slice(0, 3);
  return generated || "UNK";
}

/**
 * Generate paper specification string from layers.
 * Format: <ABBR><GSM>/<BF> — Example: KRA120/32, VKL180/24
 * 
 * CRITICAL: Paper spec must NEVER be blank. If layers are invalid,
 * errors array will contain the issues. Use isValid to check.
 */
export function generatePaperSpec(layers: LayerData[], shadesList?: PaperShade[]): PaperSpecResult {
  const errors: string[] = [];
  const specParts: string[] = [];
  
  if (!layers || layers.length === 0) {
    return {
      paperSpec: "",
      errors: ["No layers defined - at least one paper layer is required"],
      isValid: false,
    };
  }
  
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerNum = i + 1;
    
    if (!layer.shade) {
      errors.push(`Layer ${layerNum}: Shade is required`);
      continue;
    }
    
    if (!layer.gsm && !layer.bf) {
      errors.push(`Layer ${layerNum}: GSM or BF is required`);
      continue;
    }
    
    const abbr = getShadeAbbreviation(layer.shade, shadesList);
    
    // Build spec: ABBR + GSM + "/" + BF (BF = Bursting Factor)
    let specPart = abbr;
    if (layer.gsm && layer.bf) {
      specPart += `${layer.gsm}/${layer.bf}`;
    } else if (layer.gsm) {
      specPart += `${layer.gsm}`;
    } else if (layer.bf) {
      specPart += `/${layer.bf}`;
    }
    
    specParts.push(specPart);
  }
  
  const paperSpec = specParts.join(",");
  
  // Add error if we couldn't generate any spec parts
  if (specParts.length === 0 && errors.length === 0) {
    errors.push("Unable to generate paper specification from provided layers");
  }
  
  return {
    paperSpec: paperSpec || "",
    errors,
    isValid: errors.length === 0 && paperSpec.length > 0,
  };
}

/**
 * Validate paper spec format.
 * Valid format: ABBR[GSM][/BF] separated by commas
 * Examples: KRA120/32, VKL180/24,KRA150/18
 */
export function validatePaperSpec(paperSpec: string): boolean {
  if (!paperSpec || paperSpec.trim() === "") {
    return false;
  }
  
  // Pattern: letters followed by optional digits and optional /digits
  const pattern = /^[A-Za-z]+\d*(\/\d+)?$/;
  const parts = paperSpec.split(",");
  
  return parts.length > 0 && parts.every(part => pattern.test(part.trim()));
}

/**
 * Generate paper spec or throw an error if generation fails.
 * Use this when saving quotes to ensure paper spec is never blank.
 */
export function generatePaperSpecOrThrow(layers: LayerData[], shadesList?: PaperShade[]): string {
  const result = generatePaperSpec(layers, shadesList);
  
  if (!result.isValid || !result.paperSpec) {
    const errorMessage = result.errors.length > 0 
      ? result.errors.join("; ")
      : "Paper specification could not be generated";
    throw new Error(`Invalid paper specification: ${errorMessage}`);
  }
  
  return result.paperSpec;
}

/**
 * Format paper spec from layers breakdown array.
 * Returns "-" if layers are empty or invalid (for display purposes).
 * Use generatePaperSpecOrThrow for validation during save.
 */
export function formatPaperSpecFromLayers(
  layersBreakdown: Array<{
    shade?: string;
    gsm?: number;
    bf?: number;
    rate?: number;
  }>,
  shadesList?: PaperShade[]
): string {
  if (!layersBreakdown || layersBreakdown.length === 0) {
    return "-";
  }
  
  const result = generatePaperSpec(
    layersBreakdown.map(l => ({
      shade: l.shade || "",
      gsm: l.gsm,
      bf: l.bf,
    })),
    shadesList
  );
  
  return result.paperSpec || "-";
}

/**
 * Get all available shade names from the abbreviation map.
 * Useful for dropdowns and validation.
 */
export function getAvailableShadeNames(): string[] {
  const uniqueShades = new Set<string>();
  
  // Add canonical shade names
  uniqueShades.add("Kraft/Natural");
  uniqueShades.add("Testliner");
  uniqueShades.add("Virgin Kraft Liner");
  uniqueShades.add("White Kraft Liner");
  uniqueShades.add("White Top Testliner");
  uniqueShades.add("Duplex Grey Back (LWC)");
  uniqueShades.add("Duplex Grey Back (HWC)");
  uniqueShades.add("Semi Chemical Fluting");
  uniqueShades.add("Recycled Fluting");
  uniqueShades.add("Bagasse (Agro based)");
  uniqueShades.add("Golden Kraft");
  
  return Array.from(uniqueShades);
}
