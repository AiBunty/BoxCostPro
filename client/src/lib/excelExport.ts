import * as XLSX from 'xlsx';
import type { QuoteItem, CompanyProfile } from "@shared/schema";

export function generateExcelWorkbook(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  const quoteData: any[][] = [
    ["Ventura Packagers - Quote Export"],
    [],
    ["Customer Details"],
    ["Party Name", customerName],
    ["Company", customerCompany],
    [],
    ["Item Details"],
    ["Item#", "Box Name", "Type", "Ply", "Length(mm)", "Width(mm)", "Height(mm)", "Quantity", 
     "Sheet Length", "Sheet Width", "Weight(kg)", "ECT", "BCT", "BS", 
     "Paper Cost", "Printing Cost", "Lamination Cost", "Varnish Cost", "Die Cost", "Punching Cost", 
     "Cost Per Unit", "Total Value"],
  ];
  
  items.forEach((item, idx) => {
    quoteData.push([
      idx + 1,
      item.boxName,
      item.type,
      item.ply,
      parseFloat(item.length.toFixed(2)),
      parseFloat(item.width.toFixed(2)),
      item.height ? parseFloat(item.height.toFixed(2)) : "",
      item.quantity,
      parseFloat(item.sheetLength.toFixed(2)),
      parseFloat(item.sheetWidth.toFixed(2)),
      parseFloat(item.sheetWeight.toFixed(3)),
      parseFloat(item.ect.toFixed(2)),
      parseFloat(item.bct.toFixed(1)),
      parseFloat(item.bs.toFixed(2)),
      parseFloat(item.paperCost.toFixed(2)),
      parseFloat((item.printingCost || 0).toFixed(2)),
      parseFloat((item.laminationCost || 0).toFixed(2)),
      parseFloat((item.varnishCost || 0).toFixed(2)),
      parseFloat((item.dieCost || 0).toFixed(2)),
      parseFloat((item.punchingCost || 0).toFixed(2)),
      parseFloat(item.totalCostPerBox.toFixed(2)),
      parseFloat(item.totalValue.toFixed(2)),
    ]);
  });
  
  quoteData.push([]);
  quoteData.push(["Grand Total", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", 
    items.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)]);
  quoteData.push([]);
  
  if (companyProfile) {
    quoteData.push(["Company Details"]);
    quoteData.push(["Company Name", companyProfile.companyName]);
    quoteData.push(["GST", companyProfile.gstNo || ""]);
    quoteData.push(["Phone", companyProfile.phone || ""]);
    quoteData.push(["Email", companyProfile.email || ""]);
    quoteData.push(["Address", companyProfile.address || ""]);
    quoteData.push(["Website", companyProfile.website || ""]);
  }
  
  const worksheet = XLSX.utils.aoa_to_sheet(quoteData);
  
  worksheet['!cols'] = [
    { wch: 8 },   
    { wch: 25 },  
    { wch: 10 },  
    { wch: 8 },   
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 10 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 10 },  
    { wch: 10 },  
    { wch: 10 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 10 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Quote");
  
  return workbook;
}

export function downloadExcel(
  items: QuoteItem[],
  customerName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null,
  filename: string = "quote.xlsx"
) {
  const workbook = generateExcelWorkbook(items, customerName, customerCompany, companyProfile);
  const xlsxFilename = filename.replace('.csv', '.xlsx');
  XLSX.writeFile(workbook, xlsxFilename);
}

export function generateSampleUploadTemplate(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  // Valid dropdown options - CANONICAL SHADE NAMES (from paper_shades master table)
  const PAPER_SHADES = [
    "Kraft/Natural",
    "Testliner",
    "Virgin Kraft Liner",
    "White Kraft Liner",
    "White Top Testliner",
    "Duplex Grey Back (LWC)",
    "Duplex Grey Back (HWC)",
    "Semi Chemical Fluting",
    "Recycled Fluting",
    "Bagasse (Agro based)",
    "Golden Kraft"
  ];
  const TYPES = ["rsc", "sheet"];
  const PLY_OPTIONS = ["1", "3", "5", "7", "9"];
  
  const sampleData: any[][] = [
    ["Box Name", "Type", "Ply", "Length(mm)", "Width(mm)", "Height(mm)", "Quantity",
     "L1 GSM", "L1 BF", "L1 RCT", "L1 Shade", "L1 Rate",
     "F1 GSM", "F1 BF", "F1 RCT", "F1 Shade", "F1 Rate",
     "L2 GSM", "L2 BF", "L2 RCT", "L2 Shade", "L2 Rate",
     "F2 GSM", "F2 BF", "F2 RCT", "F2 Shade", "F2 Rate",
     "L3 GSM", "L3 BF", "L3 RCT", "L3 Shade", "L3 Rate"],
    ["Sample Box 1", "rsc", "3", "300", "200", "150", "1000",
     "180", "20", "5", "Kraft/Natural", "45",
     "120", "16", "4", "Semi Kraft", "38",
     "180", "20", "5", "Kraft/Natural", "45",
     "", "", "", "", "",
     "", "", "", "", ""],
    ["Sample Box 2", "rsc", "5", "400", "300", "200", "500",
     "200", "22", "6", "Kraft/Natural", "48",
     "140", "18", "5", "Semi Kraft", "40",
     "180", "20", "5", "Kraft/Natural", "45",
     "140", "18", "5", "Semi Kraft", "40",
     "200", "22", "6", "Kraft/Natural", "48"],
    ["Sample Sheet", "sheet", "3", "600", "400", "", "2000",
     "180", "20", "5", "Golden (Brown)", "45",
     "120", "16", "4", "Semi Kraft", "38",
     "180", "20", "5", "Kraft/Natural", "45",
     "", "", "", "", "",
     "", "", "", "", ""],
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
  
  worksheet['!cols'] = [
    { wch: 20 },  
    { wch: 8 },   
    { wch: 6 },   
    { wch: 12 },  
    { wch: 12 },  
    { wch: 12 },  
    { wch: 10 },  
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 18 },  
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 18 },  
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 18 },  
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 18 },  
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 8 },   
    { wch: 18 },  
    { wch: 8 },   
  ];
  
  // Add data validation for dropdowns (rows 2-100 to allow for many entries)
  // Note: xlsx library uses 0-indexed columns
  // Column B (1) = Type, Column C (2) = Ply
  // Shade columns: K (10), P (15), U (20), Z (25), AE (30)
  
  // Add a helper sheet with valid options for reference
  const validationData: any[][] = [
    ["Valid Paper Shades:", ...PAPER_SHADES],
    ["Valid Types:", ...TYPES],
    ["Valid Ply:", ...PLY_OPTIONS],
    [],
    ["Instructions:"],
    ["1. Type must be: rsc (for box) or sheet (for flat sheet)"],
    ["2. Ply must be: 1, 3, 5, 7, or 9"],
    ["3. Paper Shade options (from Master Table):"],
    ["   - Kraft/Natural (KRA), Testliner (TST), Virgin Kraft Liner (VKL)"],
    ["   - White Kraft Liner (WKL), White Top Testliner (WTT)"],
    ["   - Duplex Grey Back LWC (LWC), Duplex Grey Back HWC (HWC)"],
    ["   - Semi Chemical Fluting (SCF), Recycled Fluting (RCF)"],
    ["   - Bagasse (BAG), Golden Kraft (GOL)"],
    ["4. For sheets, leave Height column empty"],
    ["5. Fill layer columns based on ply count:"],
    ["   - 3-Ply: L1, F1, L2 (3 layers)"],
    ["   - 5-Ply: L1, F1, L2, F2, L3 (5 layers)"],
    ["   - etc."],
  ];
  
  const validationSheet = XLSX.utils.aoa_to_sheet(validationData);
  validationSheet['!cols'] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Template");
  XLSX.utils.book_append_sheet(workbook, validationSheet, "Valid Options");
  
  return workbook;
}

export function downloadSampleTemplate() {
  const workbook = generateSampleUploadTemplate();
  XLSX.writeFile(workbook, "bulk-upload-template.xlsx");
}

export function parseExcelUpload(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          reject(new Error("File is empty or has no data rows"));
          return;
        }
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && cell !== ""));
        
        const parsedItems = rows.map((row: any[], idx) => {
          const getValue = (colName: string) => {
            const colIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes(colName.toLowerCase()));
            return colIdx >= 0 ? row[colIdx] : null;
          };
          
          return {
            boxName: getValue("box name") || `Box ${idx + 1}`,
            type: (getValue("type") || "rsc").toString().toLowerCase(),
            ply: getValue("ply") || "3",
            length: parseFloat(getValue("length") || "0"),
            width: parseFloat(getValue("width") || "0"),
            height: parseFloat(getValue("height") || "0"),
            quantity: parseInt(getValue("quantity") || "1000"),
            layers: [
              {
                layerType: "liner",
                gsm: getValue("l1 gsm") || "180",
                bf: getValue("l1 bf") || "20",
                rctValue: getValue("l1 rct") || "5",
                shade: getValue("l1 shade") || "Kraft",
                rate: getValue("l1 rate") || "45",
              },
              {
                layerType: "flute",
                gsm: getValue("f1 gsm") || "120",
                bf: getValue("f1 bf") || "16",
                rctValue: getValue("f1 rct") || "4",
                shade: getValue("f1 shade") || "SemiKraft",
                rate: getValue("f1 rate") || "38",
              },
              {
                layerType: "liner",
                gsm: getValue("l2 gsm") || "180",
                bf: getValue("l2 bf") || "20",
                rctValue: getValue("l2 rct") || "5",
                shade: getValue("l2 shade") || "Kraft",
                rate: getValue("l2 rate") || "45",
              },
              {
                layerType: "flute",
                gsm: getValue("f2 gsm") || "",
                bf: getValue("f2 bf") || "",
                rctValue: getValue("f2 rct") || "",
                shade: getValue("f2 shade") || "",
                rate: getValue("f2 rate") || "",
              },
              {
                layerType: "liner",
                gsm: getValue("l3 gsm") || "",
                bf: getValue("l3 bf") || "",
                rctValue: getValue("l3 rct") || "",
                shade: getValue("l3 shade") || "",
                rate: getValue("l3 rate") || "",
              },
            ].filter(l => l.gsm && l.gsm !== ""),
          };
        });
        
        resolve(parsedItems);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadQuotePDF(
  items: QuoteItem[],
  partyName: string,
  customerCompany: string,
  companyProfile: CompanyProfile | null,
  paymentTerms: string,
  deliveryDays: string,
  transportCharge: string,
  transportRemark: string,
  taxRate: number = 18 // GST percentage, default 18%
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
  
  const subtotal = items.reduce((sum, item) => sum + item.totalValue, 0);
  const transportCost = parseFloat(transportCharge) || 0;
  const subtotalWithTransport = subtotal + transportCost;
  const taxAmount = taxRate > 0 ? subtotalWithTransport * (taxRate / 100) : 0;
  const grandTotal = subtotalWithTransport + taxAmount;
  
  htmlContent += `
        </tbody>
      </table>
      
      <div class="total">
        Subtotal (Before Tax): ₹${subtotal.toFixed(2)}<br>
        ${transportCost > 0 ? `Transport Charge${transportRemark ? ` (${transportRemark})` : ''}: ₹${transportCost.toFixed(2)}<br>` : ''}
        ${taxRate > 0 ? `GST (${taxRate}%): ₹${taxAmount.toFixed(2)}<br>` : ''}
        <strong>Grand Total${taxRate > 0 ? ' (Incl. GST)' : ''}: ₹${grandTotal.toFixed(2)}</strong>
      </div>
      
      <div class="footer">
        <p>Thank you for choosing our services. Please confirm the order at your earliest convenience.</p>
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = window.URL.createObjectURL(blob);
  
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  }
}

export function downloadGenericExcel(
  data: Record<string, any>[],
  filename: string = "export.xlsx"
) {
  if (!data || data.length === 0) return;
  
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportReportToExcel(
  items: QuoteItem[],
  partyName: string,
  filename: string = "report.xlsx"
) {
  const workbook = XLSX.utils.book_new();
  
  const reportData: any[][] = [
    [`Box History Report - ${partyName}`],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ["Box Name", "Type", "Ply", "Size (L×W×H)", "Quantity", "Sheet Size", "Weight/Sheet", 
     "Paper Cost", "Printing", "Lamination", "Varnish", "Die", "Punching", "Cost/Pc", "Total Value"],
  ];
  
  items.forEach((item) => {
    reportData.push([
      item.boxName,
      item.type === 'rsc' ? 'RSC Box' : 'Sheet',
      `${item.ply}-Ply`,
      item.height ? `${item.length}×${item.width}×${item.height}` : `${item.length}×${item.width}`,
      item.quantity,
      `${item.sheetLength.toFixed(0)}×${item.sheetWidth.toFixed(0)}`,
      item.sheetWeight.toFixed(3),
      item.paperCost.toFixed(2),
      (item.printingCost || 0).toFixed(2),
      (item.laminationCost || 0).toFixed(2),
      (item.varnishCost || 0).toFixed(2),
      (item.dieCost || 0).toFixed(2),
      (item.punchingCost || 0).toFixed(2),
      item.totalCostPerBox.toFixed(2),
      item.totalValue.toFixed(2),
    ]);
  });
  
  reportData.push([]);
  reportData.push(["Total Items:", items.length, "", "", "", "", "", "", "", "", "", "", "", "",
    items.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)]);
  
  const worksheet = XLSX.utils.aoa_to_sheet(reportData);
  
  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  
  XLSX.writeFile(workbook, filename);
}
