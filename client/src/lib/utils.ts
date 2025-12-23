import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SHADE_ABBREVIATIONS: Record<string, string> = {
  'Kraft': 'Kra',
  'Kraft/Natural': 'Kra',
  'Natural': 'Kra',
  'Natural Kraft': 'Kra',
  'Testliner': 'TL',
  'Virgin Kraft Liner': 'VKL',
  'Virgin Kraft': 'VKL',
  'White Kraft Liner': 'WKL',
  'White Kraft': 'WKL',
  'White Top Testliner': 'WTT',
  'White Top': 'WTT',
  'Duplex Grey Back (LWC)': 'LWC',
  'LWC': 'LWC',
  'Light Weight Coated': 'LWC',
  'Duplex Grey Back (HWC)': 'HWC',
  'HWC': 'HWC',
  'Heavy Weight Coated': 'HWC',
  'Duplex': 'LWC',
  'Semi Chemical Fluting': 'SCF',
  'Semi Chemical': 'SCF',
  'Recycled Fluting': 'RF',
  'Recycled': 'RF',
  'Bagasse (Agro based)': 'BAG',
  'Bagasse': 'BAG',
  'Agro based': 'BAG',
  'Golden Kraft': 'GOL',
  'Golden': 'GOL',
};

export function getShadeAbbreviation(shade: string): string {
  if (!shade) return '';
  const normalized = shade.trim();
  
  if (SHADE_ABBREVIATIONS[normalized]) {
    return SHADE_ABBREVIATIONS[normalized];
  }
  
  const lowerNormalized = normalized.toLowerCase();
  for (const [key, abbr] of Object.entries(SHADE_ABBREVIATIONS)) {
    if (key.toLowerCase() === lowerNormalized) {
      return abbr;
    }
    if (lowerNormalized.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerNormalized)) {
      return abbr;
    }
  }
  
  return normalized.split(/\s+/).map(word => word[0]?.toUpperCase() || '').join('').slice(0, 3) || 'UNK';
}

export interface LayerSpec {
  gsm?: string | number;
  bf?: string | number;
  shade?: string;
  [key: string]: any;
}

export function formatPaperSpecs(layers: LayerSpec[]): string {
  if (!layers || layers.length === 0) return '-';
  
  const specs = layers.map((layer) => {
    const shade = getShadeAbbreviation(layer.shade || '');
    const gsm = layer.gsm || '';
    const bf = layer.bf || '';
    
    if (!shade && !gsm && !bf) return null;
    
    let spec = shade || 'UNK';
    if (gsm && bf) {
      spec += `${gsm}/${bf}`;
    } else if (gsm) {
      spec += `${gsm}`;
    } else if (bf) {
      spec += `/${bf}`;
    }
    return spec;
  }).filter(Boolean);
  
  return specs.length > 0 ? specs.join(',') : '-';
}
