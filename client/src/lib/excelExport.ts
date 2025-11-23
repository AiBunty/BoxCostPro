import type { QuoteItem, CompanyProfile } from "@shared/schema";

// Simple CSV export function (works better with Excel than complex XLSX)
export function generateExcelCSV(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null
): string {
  const rows: string[] = [];
  
  // Header
  rows.push("Ventura Packagers - Quote Export");
  rows.push("");
  rows.push("Customer Details");
  rows.push(`Party Name,${customerName}`);
  rows.push(`Company,${customerCompany}`);
  rows.push("");
  
  // Item details header
  rows.push("Item Details");
  rows.push("Item#,Box Name,Type,Ply,Length(mm),Width(mm),Height(mm),Quantity,Sheet Length,Sheet Width,Weight(kg),ECT,BCT,BS,Paper Cost,Printing Cost,Lamination Cost,Varnish Cost,Die Cost,Punching Cost,Cost Per Unit,Total Value");
  
  // Items
  items.forEach((item, idx) => {
    rows.push([
      (idx + 1).toString(),
      item.boxName,
      item.type,
      item.ply,
      item.length.toFixed(2),
      item.width.toFixed(2),
      item.height?.toFixed(2) || "",
      item.quantity.toString(),
      item.sheetLength.toFixed(2),
      item.sheetWidth.toFixed(2),
      item.sheetWeight.toFixed(3),
      item.ect.toFixed(2),
      item.bct.toFixed(1),
      item.bs.toFixed(2),
      item.paperCost.toFixed(2),
      item.printingCost.toFixed(2),
      item.laminationCost.toFixed(2),
      item.varnishCost.toFixed(2),
      item.dieCost.toFixed(2),
      item.punchingCost.toFixed(2),
      item.totalCostPerBox.toFixed(2),
      item.totalValue.toFixed(2),
    ].map(cell => `"${cell}"`).join(","));
  });
  
  rows.push("");
  rows.push(`Grand Total,${items.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)}`);
  rows.push("");
  
  // Company details
  if (companyProfile) {
    rows.push("Company Details");
    rows.push(`Company Name,${companyProfile.companyName}`);
    rows.push(`GST,${companyProfile.gstNo || ""}`);
    rows.push(`Phone,${companyProfile.phone || ""}`);
    rows.push(`Email,${companyProfile.email || ""}`);
    rows.push(`Address,${companyProfile.address || ""}`);
    rows.push(`Website,${companyProfile.website || ""}`);
    rows.push(`Payment Terms,${companyProfile.paymentTerms || ""}`);
    rows.push(`Delivery Time,${companyProfile.deliveryTime || ""}`);
  }
  
  return rows.join("\n");
}

export function downloadExcel(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null,
  filename: string = "quote.csv"
) {
  const csv = generateExcelCSV(items, customerName, customerCompany, companyProfile);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
import type { QuoteItem, CompanyProfile } from "@shared/schema";

export function downloadQuotePDF(
  items: QuoteItem[],
  partyName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null,
  paymentTerms: string,
  deliveryDays: string,
  transportCharge: string,
  transportRemark: string
) {
  let htmlContent = `
    <html>
    <head>
      <title>Quote - ${partyName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }
        .company-name { font-size: 24px; font-weight: bold; }
        .company-details { font-size: 12px; color: #666; margin-top: 5px; }
        .quote-details { margin: 20px 0; }
        .quote-details table { width: 100%; border-collapse: collapse; }
        .quote-details td { padding: 8px; border: 1px solid #ddd; }
        .quote-details th { padding: 8px; border: 1px solid #ddd; background: #f0f0f0; font-weight: bold; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table td { padding: 10px; border: 1px solid #ddd; }
        .items-table th { padding: 10px; border: 1px solid #ddd; background: #f0f0f0; font-weight: bold; }
        .total { text-align: right; font-weight: bold; font-size: 16px; margin-top: 20px; }
        .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${companyProfile?.companyName || 'Ventura Packagers Private Limited'}</div>
        <div class="company-details">
          ${companyProfile?.phone ? `Phone: ${companyProfile.phone}<br>` : ''}
          ${companyProfile?.email ? `Email: ${companyProfile.email}<br>` : ''}
          ${companyProfile?.address ? `Address: ${companyProfile.address}` : ''}
        </div>
      </div>
      
      <div class="quote-details">
        <h2>Quote Details</h2>
        <table>
          <tr><td><strong>To:</strong></td><td>${partyName}</td></tr>
          <tr><td><strong>Company:</strong></td><td>${customerCompany}</td></tr>
          <tr><td><strong>Date:</strong></td><td>${new Date().toLocaleDateString()}</td></tr>
          <tr><td><strong>Payment Terms:</strong></td><td>${paymentTerms}</td></tr>
          <tr><td><strong>Delivery Time:</strong></td><td>${deliveryDays} days</td></tr>
        </table>
      </div>
      
      <h2>Quote Items</h2>
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Size (mm)</th>
            <th>Ply</th>
            <th>Qty</th>
            <th>Rate/Pc (₹)</th>
            <th>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  items.forEach((item) => {
    const size = item.height 
      ? `${item.length.toFixed(0)}×${item.width.toFixed(0)}×${item.height.toFixed(0)}`
      : `${item.length.toFixed(0)}×${item.width.toFixed(0)}`;
    
    htmlContent += `
      <tr>
        <td>${item.boxName}</td>
        <td>${item.type === 'rsc' ? 'RSC Box' : 'Sheet'}</td>
        <td>${size}</td>
        <td>${item.ply}-Ply</td>
        <td>${item.quantity.toLocaleString()}</td>
        <td>₹${item.totalCostPerBox.toFixed(2)}</td>
        <td>₹${item.totalValue.toFixed(2)}</td>
      </tr>
    `;
  });
  
  const grandTotal = items.reduce((sum, item) => sum + item.totalValue, 0);
  const transportCost = parseFloat(transportCharge) || 0;
  const finalTotal = grandTotal + transportCost;
  
  htmlContent += `
        </tbody>
      </table>
      
      <div class="total">
        Sub Total: ₹${grandTotal.toFixed(2)}<br>
        ${transportCost > 0 ? `Transport Charge${transportRemark ? ` (${transportRemark})` : ''}: ₹${transportCost.toFixed(2)}<br>` : ''}
        <strong>Grand Total: ₹${finalTotal.toFixed(2)}</strong>
      </div>
      
      <div class="footer">
        <p>Thank you for choosing our services. Please confirm the order at your earliest convenience.</p>
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quote-${partyName}-${new Date().toISOString().split('T')[0]}.pdf`;
  
  // Print to PDF instead of download
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  }
}
