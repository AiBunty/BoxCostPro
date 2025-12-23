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

const SHADE_ABBREVIATION_MAP: Record<string, string> = {
  "kraft/natural": "Kra",
  "kraft": "Kra",
  "natural": "Kra",
  "testliner": "TL",
  "virgin kraft liner": "VKL",
  "white kraft liner": "WKL",
  "white top testliner": "WTT",
  "duplex grey back (lwc)": "LWC",
  "lwc": "LWC",
  "duplex grey back (hwc)": "HWC",
  "hwc": "HWC",
  "semi chemical fluting": "SCF",
  "recycled fluting": "RF",
  "bagasse (agro based)": "BAG",
  "bagasse": "BAG",
  "golden kraft": "GOL",
  "golden": "GOL",
};

export function getShadeAbbreviation(shadeName: string, shadesList?: PaperShade[]): string {
  if (!shadeName) return "";
  
  const normalizedName = shadeName.toLowerCase().trim();
  
  if (shadesList && shadesList.length > 0) {
    const shade = shadesList.find(
      s => s.shadeName.toLowerCase() === normalizedName
    );
    if (shade) return shade.abbreviation;
  }
  
  if (SHADE_ABBREVIATION_MAP[normalizedName]) {
    return SHADE_ABBREVIATION_MAP[normalizedName];
  }
  
  const partialMatch = Object.entries(SHADE_ABBREVIATION_MAP).find(
    ([key]) => normalizedName.includes(key) || key.includes(normalizedName)
  );
  if (partialMatch) return partialMatch[1];
  
  return shadeName.split(/\s+/).map(word => word[0]?.toUpperCase() || "").join("").slice(0, 3) || "UNK";
}

export function generatePaperSpec(layers: LayerData[], shadesList?: PaperShade[]): PaperSpecResult {
  const errors: string[] = [];
  const specParts: string[] = [];
  
  if (!layers || layers.length === 0) {
    return {
      paperSpec: "",
      errors: ["No layers defined"],
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
  
  return {
    paperSpec: paperSpec || "",
    errors,
    isValid: errors.length === 0 && paperSpec.length > 0,
  };
}

export function validatePaperSpec(paperSpec: string): boolean {
  if (!paperSpec || paperSpec.trim() === "") {
    return false;
  }
  
  const pattern = /^[A-Za-z]+\d*(\/\d+)?$/;
  const parts = paperSpec.split(",");
  
  return parts.every(part => pattern.test(part.trim()));
}

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
