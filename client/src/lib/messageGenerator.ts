import type { QuoteItem, CompanyProfile, PartyProfile } from "@shared/schema";

export function generateWhatsAppMessage(
  items: QuoteItem[],
  partyProfile: PartyProfile | null,
  companyProfile: CompanyProfile | null
): string {
  const partyName = partyProfile?.personName || "Valued Customer";
  const companyName = companyProfile?.companyName || "Ventura Packagers Private Limited";
  
  const lines: string[] = [
    `Dear Valued "${partyName}"`,
    ``,
    `Here is your quote from *${companyName}*:`,
    ``,
    ``,
  ];

  // Filter only selected items
  const selectedItems = items.filter(item => item.selected !== false);
  
  selectedItems.forEach((item, index) => {
    const fluteType = item.ply === '3' ? 'B' : item.ply === '5' ? 'BC' : item.ply === '7' ? 'BCE' : 'B';
    const rateExclGst = item.totalCostPerBox / 1.05;
    const rateInclGst = item.totalCostPerBox;
    
    lines.push(`*Item ${index + 1}*`);
    lines.push(`*Box Size :* (${item.length.toFixed(0)}x${item.width.toFixed(0)}${item.height ? `x${item.height.toFixed(0)}` : ''} ${item.measuredOn} ${item.inputUnit})`);
    lines.push(`*Item Name:* ${item.boxName} *Board:* ${item.ply} Ply`);
    lines.push(`*Flute:* ${fluteType}`);
    lines.push(`*Printing:* ${item.boxDescription || 'Plain Box'}`);
    lines.push(``);
    lines.push(`*Paper Spec:*`);
    
    item.layerSpecs.forEach((spec, idx) => {
      let layerLabel = 'Flute';
      if (idx === 0) layerLabel = 'Outer';
      else if (idx === item.layerSpecs.length - 1) layerLabel = 'Inner';
      else if (spec.layerType === 'flute') layerLabel = `Flute (F${Math.floor(idx / 2)})`;
      else layerLabel = `Liner (L${idx + 1})`;
      
      lines.push(`  - ${layerLabel} (L${idx + 1}): ${spec.gsm} GSM / ${spec.bf} BF (${spec.shade})`);
    });
    
    lines.push(``);
    lines.push(`*Quantity:* ${item.quantity.toLocaleString()} Pcs`);
    lines.push(`*Total Rate (Excl. GST):* Rs.${rateExclGst.toFixed(2)} /pc`);
    lines.push(`*Total Rate (Incl. GST 5%):* Rs.${rateInclGst.toFixed(2)} /pc`);
    lines.push(``);
  });

  const grandTotal = selectedItems.reduce((sum, item) => sum + item.totalValue, 0);
  lines.push(`*Grand Total Value (Incl. GST): Rs.${grandTotal.toFixed(2)}*`);
  lines.push(``);
  
  if (companyProfile) {
    lines.push(`*Payment Terms:* ${companyProfile.paymentTerms || '100% Advance'}`);
    lines.push(`*Delivery Time:* ${companyProfile.deliveryTime || 'Delivery 10 days after receipt of Purchase order'}`);
    lines.push(``);
  }
  
  lines.push(`Thank you for considering our quote!`);
  lines.push(``);
  
  if (companyProfile) {
    lines.push(`*${companyProfile.companyName}*`);
    if (companyProfile.phone) lines.push(`${companyProfile.phone}`);
    if (companyProfile.email) lines.push(`${companyProfile.email}`);
    if (companyProfile.address) lines.push(`${companyProfile.address}`);
    if (companyProfile.gstNo) lines.push(`GST: ${companyProfile.gstNo}`);
    if (companyProfile.website) lines.push(`${companyProfile.website}`);
    if (companyProfile.socialMedia) lines.push(`${companyProfile.socialMedia}`);
    if (companyProfile.googleLocation) lines.push(`${companyProfile.googleLocation}`);
  }

  return lines.join('\n');
}

export function generateEmailContent(
  items: QuoteItem[],
  partyProfile: PartyProfile | null,
  companyProfile: CompanyProfile | null
): { subject: string; body: string } {
  const partyName = partyProfile?.personName || "Valued Customer";
  const companyName = companyProfile?.companyName || "Ventura Packagers Private Limited";
  const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Filter only selected items
  const selectedItems = items.filter(item => item.selected !== false);
  
  const subject = `Quote for Corrugated Packaging - ${partyProfile?.companyName || partyName}`;

  // Generate table rows for items
  const itemRows = selectedItems.map((item, index) => {
    const fluteType = item.ply === '3' ? 'B' : item.ply === '5' ? 'BC' : item.ply === '7' ? 'BCE' : 'B';
    const paperSpecs = item.layerSpecs.map(s => `${s.gsm}/${s.bf}`).join(', ');
    const rateExclGst = item.totalCostPerBox / 1.05;
    
    return `            <tr>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${item.boxName}<br><small>${item.boxDescription || 'Plain Box'}</small></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${item.length.toFixed(0)}x${item.width.toFixed(0)}${item.height ? `x${item.height.toFixed(0)}` : ''} ${item.measuredOn} ${item.inputUnit}<br><small>${item.ply}-Ply (${fluteType})</small><br><small>Paper: ${paperSpecs}</small></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">RSC</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${item.bs.toFixed(1)}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">Rs.${rateExclGst.toFixed(2)}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${item.quantity.toLocaleString()}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">Rs.${(rateExclGst * item.quantity).toFixed(2)}</td>
            </tr>`;
  }).join('\n');

  const subtotal = selectedItems.reduce((sum, item) => sum + (item.totalCostPerBox / 1.05) * item.quantity, 0);
  const gstAmount = subtotal * 0.05;
  const grandTotal = subtotal + gstAmount;
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const body = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5;">
    <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px;">Quotation for Corrugated Shipping Boxes</h2>
    
    <table style="width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="padding: 2px 0; width: 100px;"><strong>Date:</strong></td>
            <td style="padding: 2px 0;">${today}</td>
        </tr>
        <tr>
            <td style="padding: 2px 0; vertical-align: top;"><strong>To:</strong></td>
            <td style="padding: 2px 0; vertical-align: top;">${partyName}${partyProfile?.companyName ? `<br>${partyProfile.companyName}` : ''}</td>
        </tr>
        <tr>
            <td style="padding: 2px 0;"><strong>From:</strong></td>
            <td style="padding: 2px 0;">${companyName}</td>
        </tr>
        <tr>
            <td style="padding: 2px 0;"><strong>Contact:</strong></td>
            <td style="padding: 2px 0;">${companyProfile?.phone || ''}, ${companyProfile?.email || ''}</td>
        </tr>
        <tr>
            <td style="padding: 2px 0;"><strong>Subject:</strong></td>
            <td style="padding: 2px 0;">Quote for Corrugated Packaging</td>
        </tr>
    </table>

    <p style="margin-bottom: 20px;">We are pleased to provide you with the following quotation for the supply of high-quality, heavy-duty corrugated shipping boxes as per your specifications:</p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
            <tr style="background-color: #1e40af; color: white;">
                <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Description</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Specifications</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Box Style</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: center;">BS (kg/cm)</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: right;">Unit Price (Rs.)</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: right;">Quantity</th>
                <th style="border: 1px solid #ccc; padding: 10px; text-align: right;">Total Price (Rs.)</th>
            </tr>
        </thead>
        <tbody>
${itemRows}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="6" style="border: 1px solid #ccc; padding: 10px; text-align: right;"><strong>Subtotal</strong></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;"><strong>Rs.${subtotal.toFixed(2)}</strong></td>
            </tr>
            <tr>
                <td colspan="6" style="border: 1px solid #ccc; padding: 10px; text-align: right;">Goods and Services Tax (GST) 5% on Subtotal</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">Rs.${gstAmount.toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f0f9ff;">
                <td colspan="6" style="border: 1px solid #ccc; padding: 10px; text-align: right; color: #1e40af;"><strong>Grand Total</strong></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right; color: #1e40af;"><strong>Rs.${grandTotal.toFixed(2)}</strong></td>
            </tr>
        </tfoot>
    </table>

    <div style="margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px;">
        <h3 style="color: #1e40af; font-size: 16px; margin-bottom: 10px; text-decoration: underline;">Terms & Conditions</h3>
        <ul style="padding-left: 20px; margin: 0; line-height: 1.8;">
            <li><strong>Validity:</strong> This quote is valid for 30 days from the date of issue.</li>
            <li><strong>Delivery:</strong> ${companyProfile?.deliveryTime || 'Delivery 10 days after receipt of Purchase order'}</li>
            <li><strong>Payment:</strong> ${companyProfile?.paymentTerms || '100% Advance'}</li>
            <li><strong>Minimum Order Quantity (MOQ):</strong> The quoted price is based on the stated quantity of ${totalQuantity.toLocaleString()} units. Any change in quantity may affect the unit price.</li>
        </ul>
    </div>
    
    <div style="margin-top: 40px;">
        <p>Thank you for considering our quote. Please feel free to contact us if you have any questions or require any modifications.</p>
        <p style="margin-top: 30px; font-weight: bold;">${companyName}</p>
        ${companyProfile?.address ? `<p>${companyProfile.address}</p>` : ''}
        ${companyProfile?.gstNo ? `<p>GST: ${companyProfile.gstNo}</p>` : ''}
        <p style="margin-top: 50px; border-top: 1px dashed #999; width: 200px; padding-top: 5px;">[Signature Line]</p>
    </div>
</div>`;

  return { subject, body };
}
