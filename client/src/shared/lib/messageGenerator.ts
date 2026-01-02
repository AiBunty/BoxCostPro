import type { QuoteItem, CompanyProfile, PartyProfile } from "@shared/schema";

export interface QuoteMessagingContext {
  items: QuoteItem[];
  partyProfile: PartyProfile | null;
  companyProfile: CompanyProfile | null;
  taxRate: number;
  paymentTerms?: string;
  deliveryDays?: string;
  transportCharge?: number;
  transportRemark?: string;
  quoteNumber?: string;
  validityDays?: number;
}

export function generateWhatsAppMessage(
  items: QuoteItem[],
  partyProfile: PartyProfile | null,
  companyProfile: CompanyProfile | null,
  taxRate: number = 18
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

  const selectedItems = items.filter(item => item.selected !== false);
  
  if (selectedItems.length === 0) {
    lines.push(`*No items selected*`);
    lines.push(``);
  } else {
    selectedItems.forEach((item, index) => {
      const fluteType = item.ply === '3' ? 'B' : item.ply === '5' ? 'BC' : item.ply === '7' ? 'BCE' : 'B';
      
      const priceBeforeTax = item.negotiatedPrice || item.totalCostPerBox || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0);
      const originalPrice = item.originalPrice || item.totalCostPerBox || priceBeforeTax;
      const hasNegotiation = item.negotiationMode && item.negotiationMode !== 'none' && item.negotiatedPrice;
      
      lines.push(`*Item ${index + 1}*`);
      lines.push(`*Box Size :* (${item.length.toFixed(0)}x${item.width.toFixed(0)}${item.height ? `x${item.height.toFixed(0)}` : ''} ${item.measuredOn} ${item.inputUnit})`);
      lines.push(`*Item Name:* ${item.boxName} *Board:* ${item.ply} Ply`);
      lines.push(`*Flute:* ${fluteType}`);
      
      if (item.showPrinting !== false) {
        const printingInfo = item.printingEnabled 
          ? `${item.printType || 'Flexo'} - ${item.printColours || 1} colour${(item.printColours || 1) > 1 ? 's' : ''}${item.boxDescription ? ` (${item.boxDescription})` : ''}`
          : 'Plain';
        lines.push(`*Printing:* ${printingInfo}`);
      }
      
      if (item.showPaperSpec !== false && item.layerSpecs && item.layerSpecs.length > 0) {
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
      }
      
      if (item.showBS !== false && item.bs) {
        lines.push(`*BS (Burst Strength):* ${item.bs.toFixed(1)}`);
      }
      
      if (item.showCS !== false && item.bct) {
        lines.push(`*CS (BCT):* ${item.bct.toFixed(1)}`);
      }
      
      if (item.showWeight !== false && item.sheetWeight) {
        lines.push(`*Weight:* ${item.sheetWeight.toFixed(3)} Kg`);
      }
      
      lines.push(``);
      lines.push(`*Quantity:* ${item.quantity.toLocaleString()} Pcs`);
      
      if (hasNegotiation) {
        const discountNote = item.negotiationMode === 'percentage' 
          ? ` (${item.negotiationValue}% off)` 
          : '';
        lines.push(`*Rate (Before Tax):* ~Rs.${originalPrice.toFixed(2)}~ → *Rs.${priceBeforeTax.toFixed(2)}* /pc${discountNote}`);
      } else {
        lines.push(`*Rate (Before Tax):* Rs.${priceBeforeTax.toFixed(2)} /pc`);
      }
      lines.push(``);
    });
  }

  const subtotal = selectedItems.reduce((sum, item) => {
    const priceBeforeTax = item.negotiatedPrice || item.totalCostPerBox || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0);
    return sum + (priceBeforeTax * (item.quantity || 0));
  }, 0);
  
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;
  
  lines.push(`*Subtotal (Before Tax): Rs.${subtotal.toFixed(2)}*`);
  lines.push(`*GST (${taxRate}%): Rs.${taxAmount.toFixed(2)}*`);
  lines.push(`*Grand Total (Incl. GST): Rs.${grandTotal.toFixed(2)}*`);
  lines.push(``);
  
  if (companyProfile) {
    if (companyProfile.paymentTerms) {
      lines.push(`*Payment Terms:* ${companyProfile.paymentTerms}`);
    }
    if (companyProfile.deliveryTime) {
      lines.push(`*Delivery Time:* ${companyProfile.deliveryTime}`);
    }
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
  companyProfile: CompanyProfile | null,
  taxRate: number = 18
): { subject: string; body: string } {
  const partyName = partyProfile?.personName || "Valued Customer";
  const companyName = companyProfile?.companyName || "Ventura Packagers Private Limited";
  const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const selectedItems = items.filter(item => item.selected !== false);
  
  const subject = `Quote for Corrugated Packaging - ${partyProfile?.companyName || partyName}`;

  let itemRows = '';
  
  if (selectedItems.length === 0) {
    itemRows = `            <tr>
                <td colspan="6" style="border: 1px solid #ccc; padding: 20px; text-align: center; color: #666;">No items selected</td>
            </tr>`;
  } else {
    itemRows = selectedItems.map((item, index) => {
      const fluteType = item.ply === '3' ? 'B' : item.ply === '5' ? 'BC' : item.ply === '7' ? 'BCE' : 'B';
      
      const paperSpecs = item.showPaperSpec !== false && item.layerSpecs && item.layerSpecs.length > 0
        ? item.layerSpecs.map(s => `${s.gsm}/${s.bf}`).join(', ')
        : '';
      
      const priceBeforeTax = item.negotiatedPrice || item.totalCostPerBox || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0);
      const originalPrice = item.originalPrice || item.totalCostPerBox || priceBeforeTax;
      const hasNegotiation = item.negotiationMode && item.negotiationMode !== 'none' && item.negotiatedPrice;
      
      let priceCell = `Rs.${priceBeforeTax.toFixed(2)}`;
      if (hasNegotiation) {
        const discountBadge = item.negotiationMode === 'percentage' 
          ? `<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;">${item.negotiationValue}% off</span>` 
          : '';
        priceCell = `<span style="text-decoration: line-through; color: #999;">Rs.${originalPrice.toFixed(2)}</span><br><span style="color: #16a34a; font-weight: bold;">Rs.${priceBeforeTax.toFixed(2)}</span>${discountBadge}`;
      }
      
      const lineTotal = priceBeforeTax * (item.quantity || 0);
      
      const emailPrintingInfo = item.showPrinting !== false
        ? (item.printingEnabled 
          ? `${item.printType || 'Flexo'} - ${item.printColours || 1} colour${(item.printColours || 1) > 1 ? 's' : ''}${item.boxDescription ? ` (${item.boxDescription})` : ''}`
          : 'Plain')
        : '';
      
      const additionalInfo: string[] = [];
      if (item.showBS !== false && item.bs) additionalInfo.push(`BS: ${item.bs.toFixed(1)}`);
      if (item.showCS !== false && item.bct) additionalInfo.push(`CS: ${item.bct.toFixed(1)}`);
      if (item.showWeight !== false && item.sheetWeight) additionalInfo.push(`Wt: ${item.sheetWeight.toFixed(3)}kg`);
      
      return `            <tr>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${item.boxName}${emailPrintingInfo ? `<br><small>${emailPrintingInfo}</small>` : ''}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">${item.length.toFixed(0)}x${item.width.toFixed(0)}${item.height ? `x${item.height.toFixed(0)}` : ''} ${item.measuredOn} ${item.inputUnit}<br><small>${item.ply}-Ply (${fluteType})</small>${paperSpecs ? `<br><small>Paper: ${paperSpecs}</small>` : ''}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">RSC${additionalInfo.length > 0 ? `<br><small>${additionalInfo.join(', ')}</small>` : ''}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${priceCell}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">${(item.quantity || 0).toLocaleString()}</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">Rs.${lineTotal.toFixed(2)}</td>
            </tr>`;
    }).join('\n');
  }

  const subtotal = selectedItems.reduce((sum, item) => {
    const priceBeforeTax = item.negotiatedPrice || item.totalCostPerBox || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0);
    return sum + (priceBeforeTax * (item.quantity || 0));
  }, 0);
  const gstAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + gstAmount;
  const totalQuantity = selectedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  const hasAnyNegotiations = selectedItems.some(item => item.negotiationMode && item.negotiationMode !== 'none' && item.negotiatedPrice);
  const savingsNote = hasAnyNegotiations ? `<p style="color: #16a34a; margin-top: 10px;">* Special negotiated pricing applied to some items</p>` : '';

  const logoHtml = companyProfile?.logoUrl 
    ? `<img src="${companyProfile.logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;" /><br>`
    : '';

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
                <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Details</th>
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
                <td colspan="5" style="border: 1px solid #ccc; padding: 10px; text-align: right;"><strong>Subtotal (Before Tax)</strong></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;"><strong>Rs.${subtotal.toFixed(2)}</strong></td>
            </tr>
            <tr>
                <td colspan="5" style="border: 1px solid #ccc; padding: 10px; text-align: right;">Goods and Services Tax (GST) ${taxRate}%</td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">Rs.${gstAmount.toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f0f9ff;">
                <td colspan="5" style="border: 1px solid #ccc; padding: 10px; text-align: right; color: #1e40af;"><strong>Grand Total (Incl. GST)</strong></td>
                <td style="border: 1px solid #ccc; padding: 10px; text-align: right; color: #1e40af;"><strong>Rs.${grandTotal.toFixed(2)}</strong></td>
            </tr>
        </tfoot>
    </table>
    ${savingsNote}

    <div style="margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px;">
        <h3 style="color: #1e40af; font-size: 16px; margin-bottom: 10px; text-decoration: underline;">Terms & Conditions</h3>
        <ul style="padding-left: 20px; margin: 0; line-height: 1.8;">
            <li><strong>Validity:</strong> This quote is valid for 30 days from the date of issue.</li>
            <li><strong>Delivery:</strong> ${companyProfile?.deliveryTime || 'Delivery 10 days after receipt of Purchase order'}</li>
            <li><strong>Payment:</strong> ${companyProfile?.paymentTerms || '100% Advance'}</li>
            ${totalQuantity > 0 ? `<li><strong>Minimum Order Quantity (MOQ):</strong> The quoted price is based on the stated quantity of ${totalQuantity.toLocaleString()} units. Any change in quantity may affect the unit price.</li>` : ''}
        </ul>
    </div>
    
    <div style="margin-top: 40px;">
        <p>Thank you for considering our quote. Please feel free to contact us if you have any questions or require any modifications.</p>
        <div style="margin-top: 30px;">
            ${logoHtml}
            <p style="font-weight: bold; margin: 0;">${companyName}</p>
            ${companyProfile?.address ? `<p style="margin: 2px 0;">${companyProfile.address}</p>` : ''}
            ${companyProfile?.gstNo ? `<p style="margin: 2px 0;">GST: ${companyProfile.gstNo}</p>` : ''}
            ${companyProfile?.phone ? `<p style="margin: 2px 0;">Phone: ${companyProfile.phone}</p>` : ''}
            ${companyProfile?.email ? `<p style="margin: 2px 0;">Email: ${companyProfile.email}</p>` : ''}
        </div>
        <p style="margin-top: 50px; border-top: 1px dashed #999; width: 200px; padding-top: 5px;">Authorized Signatory</p>
    </div>
</div>`;

  return { subject, body };
}
