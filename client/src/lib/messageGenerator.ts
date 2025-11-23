import type { QuoteItem } from "@shared/schema";

export function generateWhatsAppMessage(items: QuoteItem[], customerName: string, companyName: string): string {
  const lines = [
    `Hello ${customerName},`,
    ``,
    `Thank you for your interest in our corrugated box solutions.`,
    ``,
    `Here's your quote summary:`,
    `Company: ${companyName}`,
    ``,
  ];

  items.forEach((item, index) => {
    lines.push(`*Item ${index + 1}: ${item.boxName}*`);
    lines.push(`Type: ${item.type === 'rsc' ? 'RSC Box' : 'Sheet'}`);
    lines.push(`Ply: ${item.ply}-Ply`);
    lines.push(`Sheet Size: ${item.sheetLength.toFixed(2)}mm × ${item.sheetWidth.toFixed(2)}mm`);
    lines.push(`Weight: ${item.sheetWeight.toFixed(3)} Kg`);
    lines.push(`Quantity: ${item.quantity}`);
    lines.push(`Cost per unit: ₹${item.totalCostPerBox.toFixed(2)}`);
    lines.push(`Total: ₹${item.totalValue.toFixed(2)}`);
    lines.push(``);
  });

  const grandTotal = items.reduce((sum, item) => sum + item.totalValue, 0);
  lines.push(`*Grand Total: ₹${grandTotal.toFixed(2)}*`);
  lines.push(``,
    `Looking forward to your confirmation.`,
    `Best regards`
  );

  return lines.join('\n');
}

export function generateEmailContent(items: QuoteItem[], customerName: string, customerCompany: string, companyProfile: any): { subject: string; body: string } {
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
