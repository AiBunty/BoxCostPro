import type { QuoteItem, CompanyProfile } from "@shared/schema";

export function generateWhatsAppMessage(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null
): string {
  const lines = [
    `👋 Dear ${customerName},`,
    ``,
    `Here is your quote from ${companyProfile?.companyName || 'Ventura Packagers Private Limited'}:`,
    ``,
    `➖➖➖➖➖➖➖➖➖➖`,
  ];

  items.forEach((item, index) => {
    lines.push(`📦 Item ${index + 1}`);
    lines.push(`📏 Box Size : (${item.length.toFixed(0)}×${item.width.toFixed(0)}${item.height ? `×${item.height.toFixed(0)}` : ''} ${item.inputUnit === 'inches' ? 'in' : 'mm'})`);
    lines.push(`🏗 Board: ${item.ply}-Ply`);
    lines.push(`〰 Flute Type: BC`);
    lines.push(`🎨 Printing: ${item.boxDescription || 'Plain Box'}`);
    lines.push(``);
    lines.push(`Paper Spec:`);
    
    item.layerSpecs.forEach((spec, idx) => {
      const layerLabel = idx === 0 ? 'Outer' : idx === item.layerSpecs.length - 1 ? 'Inner' : `Flute`;
      lines.push(`  - ${layerLabel} (L${idx + 1}): ${spec.gsm} GSM / ${spec.bf} BF (${spec.shade})`);
    });
    
    lines.push(``);
    lines.push(`🔢 Quantity: ${item.quantity.toLocaleString()} Pcs`);
    lines.push(`💰 Rate (Incl. GST): ${formatCurrencyWithEmoji(item.totalCostPerBox)} /pc`);
    lines.push(`➖➖➖➖➖➖➖➖➖➖`);
  });

  const grandTotal = items.reduce((sum, item) => sum + item.totalValue, 0);
  lines.push(`🏆 Grand Total Value: ${formatCurrencyWithEmoji(grandTotal)}`);
  lines.push(``);
  
  if (companyProfile) {
    lines.push(`💳 Payment Terms: ${companyProfile.paymentTerms || '100% Advance'}`);
    lines.push(`🚚 Delivery Time: ${companyProfile.deliveryTime || '10 days after receipt of PO'}`);
    lines.push(``);
  }
  
  lines.push(`🙏 Thank you for considering our quote!`);
  lines.push(`${companyProfile?.companyName || 'Ventura Packagers Private Limited'}`);
  
  if (companyProfile) {
    if (companyProfile.phone) lines.push(`📞 Phone: ${companyProfile.phone}`);
    if (companyProfile.email) lines.push(`📧 Email: ${companyProfile.email}`);
    if (companyProfile.address) lines.push(`🇮🇳 Address: ${companyProfile.address}`);
    if (companyProfile.gstNo) lines.push(`📄 GST: ${companyProfile.gstNo}`);
    if (companyProfile.website) lines.push(`🌐 Website: ${companyProfile.website}`);
    if (companyProfile.socialMedia) lines.push(`📱 Social: ${companyProfile.socialMedia}`);
    if (companyProfile.googleLocation) lines.push(`📍 Location: ${companyProfile.googleLocation}`);
  }

  return lines.join('\n');
}

function formatCurrencyWithEmoji(value: number): string {
  const formatted = value.toFixed(2);
  return `₹${formatted}`;
}

export function generateEmailContent(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null
): { subject: string; body: string } {
  const subject = `Quote for Corrugated Boxes - ${customerCompany}`;

  const body = `
Dear ${customerName},

Thank you for your interest in our corrugated box solutions. Please find below your customized quote:

QUOTE SUMMARY
=============

Customer: ${customerName}
Company: ${customerCompany}

${items.map((item, index) => `
ITEM ${index + 1}: ${item.boxName}
${item.boxDescription ? `Description: ${item.boxDescription}\n` : ''}
Type: ${item.type === 'rsc' ? 'RSC Box' : 'Sheet'}
Ply Configuration: ${item.ply}-Ply
Input Unit: ${item.inputUnit}
Measured On: ${item.measuredOn}

DIMENSIONS:
  Length: ${item.length.toFixed(2)} mm
  Width: ${item.width.toFixed(2)} mm
${item.height ? `  Height: ${item.height.toFixed(2)} mm` : ''}

CALCULATED SHEET SIZE:
  Sheet Length (L-blank): ${item.sheetLength.toFixed(2)} mm (${item.sheetLengthInches.toFixed(2)} in)
  Sheet Width (W-blank): ${item.sheetWidth.toFixed(2)} mm (${item.sheetWidthInches.toFixed(2)} in)
  Sheet Weight: ${item.sheetWeight.toFixed(3)} Kg

STRENGTH ANALYSIS (McKee Formula):
  Board Thickness: ${item.boardThickness.toFixed(2)} mm
  Box Perimeter: ${item.boxPerimeter.toFixed(0)} mm
  Calculated ECT: ${item.ect.toFixed(2)} kN/m
  Predicted BCT: ${item.bct.toFixed(1)} Kg
  Burst Strength: ${item.bs.toFixed(2)} kg/cm

PAPER SPECIFICATIONS:
${item.layerSpecs.map((spec, idx) => `  Layer ${idx + 1} (${spec.layerType.toUpperCase()}): ${spec.gsm} GSM / ${spec.bf} BF / RCT ${spec.rctValue} - ${spec.shade}`).join('\n')}

COSTS:
  Paper Cost: ₹${item.paperCost.toFixed(2)}
  Printing Cost: ₹${item.printingCost.toFixed(2)}
  Lamination Cost: ₹${item.laminationCost.toFixed(2)}
  Varnish Cost: ₹${item.varnishCost.toFixed(2)}
  Die Cost: ₹${item.dieCost.toFixed(2)}
  Punching Cost: ₹${item.punchingCost.toFixed(2)}
  Cost per Unit: ₹${item.totalCostPerBox.toFixed(2)}
  Quantity: ${item.quantity}
  Total Value: ₹${item.totalValue.toFixed(2)}
`).join('\n')}

GRAND TOTAL: ₹${items.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)}

${companyProfile ? `
COMPANY DETAILS:
===============
Company: ${companyProfile.companyName}
GST: ${companyProfile.gstNo || 'N/A'}
Address: ${companyProfile.address || 'N/A'}
Phone: ${companyProfile.phone || 'N/A'}
Email: ${companyProfile.email || 'N/A'}
Payment Terms: ${companyProfile.paymentTerms || 'N/A'}
Delivery Time: ${companyProfile.deliveryTime || 'N/A'}
` : ''}

We look forward to serving you. Please feel free to contact us for any clarifications.

Best regards,
${companyProfile?.companyName || 'Ventura Packagers'}
`;

  return { subject, body };
}
