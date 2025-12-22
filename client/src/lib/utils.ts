import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SHADE_ABBREVIATIONS: Record<string, string> = {
  'Kraft': 'Kra',
  'Kraft/Natural': 'Kra',
  'Natural Kraft': 'Kra',
  'Golden Kraft': 'GOL',
  'Virgin Kraft Liner': 'VKL',
  'Virgin Kraft': 'VKL',
  'Duplex': 'DUP',
  'White Kraft': 'WHI',
  'White Top': 'WHI',
  'Semi Kraft': 'SKr',
  'Brown Kraft': 'BKr',
  'Recycled': 'REC',
  'Testliner': 'TES',
};

function getShadeAbbreviation(shade: string): string {
  if (!shade) return 'UNK';
  const normalized = shade.trim();
  if (SHADE_ABBREVIATIONS[normalized]) {
    return SHADE_ABBREVIATIONS[normalized];
  }
  return normalized.substring(0, 3).toUpperCase();
}

export interface LayerSpec {
  gsm?: string | number;
  bf?: string | number;
  shade?: string;
  [key: string]: any;
}

export function formatPaperSpecs(layers: LayerSpec[]): string {
  if (!layers || layers.length === 0) return '-';
  
  return layers.map((layer) => {
    const shade = getShadeAbbreviation(layer.shade || '');
    const gsm = layer.gsm || '-';
    const bf = layer.bf || '-';
    return `${shade}${gsm}/${bf}`;
  }).join(',');
}
