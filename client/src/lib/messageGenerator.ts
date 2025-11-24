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

QUOTATION DETAILS
=================

Customer: ${customerName}
Company: ${customerCompany}
Date: ${new Date().toLocaleDateString()}

${items.map((item, index) => `
ITEM ${index + 1}: ${item.boxName}
${item.boxDescription ? `Description: ${item.boxDescription}` : ''}

┌─────────────────────────────────────────────────────────────────┐
│                     BOX SPECIFICATIONS                          │
├─────────────────────────────────────────────────────────────────┤
│ Type: ${item.type === 'rsc' ? 'RSC Box' : 'Sheet'} | Ply: ${item.ply}-Ply | Unit: ${item.inputUnit} (${item.measuredOn})
│ Box Size: ${item.length.toFixed(0)}×${item.width.toFixed(0)}${item.height ? `×${item.height.toFixed(0)}` : ''} ${item.inputUnit === 'inches' ? 'in' : 'mm'}
│ Sheet Size (L-blank): ${item.sheetLength.toFixed(2)} mm (${item.sheetLengthInches.toFixed(2)} in)
│ Sheet Size (W-blank): ${item.sheetWidth.toFixed(2)} mm (${item.sheetWidthInches.toFixed(2)} in)
│ Sheet Weight: ${item.sheetWeight.toFixed(3)} Kg
└─────────────────────────────────────────────────────────────────┘

PAPER SPECIFICATIONS TABLE:
┌─────┬──────┬─────┬──────┬─────────────┬─────────────┐
│ Lyr │ Type │ GSM │  BF  │ RCT | Shade│ Rate (₹/Kg) │
├─────┼──────┼─────┼──────┼─────────────┼─────────────┤
${item.layerSpecs.map((spec, idx) => `│ L${idx + 1}  │ ${spec.layerType === 'liner' ? 'Liner' : 'Flute'} │ ${spec.gsm.toString().padEnd(4)} │ ${spec.bf.toString().padEnd(5)} │ ${spec.rctValue.toString().padEnd(2)} - ${spec.shade.substring(0, 7).padEnd(7)} │ ${spec.rate.toFixed(2).padStart(11)} │`).join('\n')}
└─────┴──────┴─────┴──────┴─────────────┴─────────────┘

STRENGTH ANALYSIS (McKee Formula):
┌────────────────────────────────────┐
│ Board Thickness:  ${item.boardThickness.toFixed(2)} mm           │
│ Box Perimeter:    ${item.boxPerimeter.toFixed(0)} mm             │
│ Calculated ECT:   ${item.ect.toFixed(2)} kN/m         │
│ Predicted BCT:    ${item.bct.toFixed(1)} Kg             │
│ Burst Strength:   ${item.bs.toFixed(2)} kg/cm         │
└────────────────────────────────────┘

COST BREAKDOWN:
┌──────────────────────────────┬──────────────┐
│ Description                  │ Amount (₹)   │
├──────────────────────────────┼──────────────┤
│ Paper Cost                   │ ${item.paperCost.toFixed(2).padStart(12)} │
│ Printing Cost                │ ${item.printingCost.toFixed(2).padStart(12)} │
│ Lamination Cost              │ ${item.laminationCost.toFixed(2).padStart(12)} │
│ Varnish Cost                 │ ${item.varnishCost.toFixed(2).padStart(12)} │
│ Die Cost                     │ ${item.dieCost.toFixed(2).padStart(12)} │
│ Punching Cost                │ ${item.punchingCost.toFixed(2).padStart(12)} │
├──────────────────────────────┼──────────────┤
│ Cost per Unit                │ ${item.totalCostPerBox.toFixed(2).padStart(12)} │
├──────────────────────────────┼──────────────┤
│ Quantity (Pcs)               │ ${item.quantity.toLocaleString().padStart(12)} │
│ Total Value                  │ ${item.totalValue.toFixed(2).padStart(12)} │
└──────────────────────────────┴──────────────┘
`).join('\n')}

═════════════════════════════════════════════════════════
QUOTATION SUMMARY TABLE:
═════════════════════════════════════════════════════════
┌────────────┬─────────────┬────────────────┬──────────────┐
│ Item       │ Quantity    │ Rate/Unit (₹)  │ Total (₹)    │
├────────────┼─────────────┼────────────────┼──────────────┤
${items.map((item) => `│ ${item.boxName.substring(0, 10).padEnd(10)} │ ${item.quantity.toLocaleString().padStart(10)} pc │ ${item.totalCostPerBox.toFixed(2).padStart(14)} │ ${item.totalValue.toFixed(2).padStart(12)} │`).join('\n')}
├────────────┼─────────────┼────────────────┼──────────────┤
│ GRAND TOTAL│ ${items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString().padStart(10)} pc │                │ ${items.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2).padStart(12)} │
└────────────┴─────────────┴────────────────┴──────────────┘

${companyProfile ? `
COMPANY INFORMATION:
====================
Company: ${companyProfile.companyName}
GST: ${companyProfile.gstNo || 'N/A'}
Address: ${companyProfile.address || 'N/A'}
Phone: ${companyProfile.phone || 'N/A'}
Email: ${companyProfile.email || 'N/A'}
Payment Terms: ${companyProfile.paymentTerms || 'N/A'}
Delivery Time: ${companyProfile.deliveryTime || 'N/A'}
Website: ${companyProfile.website || 'N/A'}
` : ''}

We look forward to serving you. Please feel free to contact us for any clarifications or modifications to this quote.

Best regards,
${companyProfile?.companyName || 'Ventura Packagers'}
`;

  return { subject, body };
}
