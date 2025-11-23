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
