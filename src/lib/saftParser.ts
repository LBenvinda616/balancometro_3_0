import { XMLParser } from "fast-xml-parser";

/**
 * Represents a SAF-T product with aggregated data from all months.
 */
export interface AggregatedProduct {
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalValue: number;
  vatBreakdown: Record<string, number>; // e.g., { "23%": 150.00, "13%": 50.00 }
}

/**
 * Result of parsing and aggregating multiple SAF-T files.
 */
export interface SAFTAggregationResult {
  period: string; // e.g., "2025"
  months: string[];
  products: AggregatedProduct[];
  totalValue: number;
  totalQuantity: number;
  errors: string[];
}

/**
 * Parse a single SAF-T XML file and extract products with quantities, values, and VAT.
 */
async function parseSingleSAFT(file: File): Promise<{
  month: string;
  products: Record<
    string,
    {
      name: string;
      quantity: number;
      value: number;
      vat: Record<string, number>;
    }
  >;
  error?: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const xmlString = e.target?.result as string;
        const parser = new XMLParser({
          ignoreAttributes: false,
          parseAttributeValue: true,
        });
        const parsed = parser.parse(xmlString);

        // Extract month from filename (e.g., "SAFT-202501.xml" -> "2025-01")
        const monthMatch = file.name.match(/(\d{4})(\d{2})/);
        const month = monthMatch
          ? `${monthMatch[1]}-${monthMatch[2]}`
          : "unknown";

        // Navigate the SAF-T structure to extract products
        // SAF-T structure: AuditFile > SourceDocuments > SalesInvoices > Invoice > Line
        const products: Record<
          string,
          {
            name: string;
            quantity: number;
            value: number;
            vat: Record<string, number>;
          }
        > = {};

        const auditFile = parsed.AuditFile || {};
        const sourceDocuments = auditFile.SourceDocuments || {};
        const salesInvoices = sourceDocuments.SalesInvoices || {};
        const invoices = Array.isArray(salesInvoices.Invoice)
          ? salesInvoices.Invoice
          : salesInvoices.Invoice
          ? [salesInvoices.Invoice]
          : [];

        invoices.forEach((invoice: any) => {
          const lines = Array.isArray(invoice.Line)
            ? invoice.Line
            : invoice.Line
            ? [invoice.Line]
            : [];

          lines.forEach((line: any) => {
            const productCode = line.ProductCode || "unknown";
            const productName = line.ProductDescription || "Unnamed Product";
            const quantity = parseFloat(line.Quantity ?? "0") || 0;
            const unitPrice = parseFloat(line.UnitPrice ?? "0") || 0;
            const lineTotal = quantity * unitPrice;

            // Extract VAT rate and amount from line
            const taxCode = line.TaxCode || "normal";
            const taxPercentage = line.TaxPercentage
              ? `${line.TaxPercentage}%`
              : "unknown";
            const taxAmount =
              parseFloat(line.TaxPointDate ? "0" : "0") || // placeholder
              (lineTotal * parseFloat(line.TaxPercentage ?? "0")) / 100;

            if (!products[productCode]) {
              products[productCode] = {
                name: productName,
                quantity: 0,
                value: 0,
                vat: {},
              };
            }

            products[productCode].quantity += quantity;
            products[productCode].value += lineTotal;
            products[productCode].vat[taxPercentage] =
              (products[productCode].vat[taxPercentage] || 0) + taxAmount;
          });
        });

        resolve({ month, products });
      } catch (err: any) {
        resolve({
          month: "unknown",
          products: {},
          error: `Failed to parse ${file.name}: ${err.message}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        month: "unknown",
        products: {},
        error: `Failed to read file ${file.name}`,
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Aggregate multiple SAF-T files into a summary.
 */
export async function aggregateSAFTFiles(
  files: File[]
): Promise<SAFTAggregationResult> {
  const errors: string[] = [];
  const allProducts: Record<string, AggregatedProduct> = {};
  const months: Set<string> = new Set();
  let totalValue = 0;
  let totalQuantity = 0;

  // Parse all files in parallel
  const results = await Promise.all(files.map((f) => parseSingleSAFT(f)));

  results.forEach((result) => {
    if (result.error) {
      errors.push(result.error);
    }

    if (result.month) {
      months.add(result.month);
    }

    Object.entries(result.products).forEach(([code, data]) => {
      if (!allProducts[code]) {
        allProducts[code] = {
          productCode: code,
          productName: data.name,
          totalQuantity: 0,
          totalValue: 0,
          vatBreakdown: {},
        };
      }

      allProducts[code].totalQuantity += data.quantity;
      allProducts[code].totalValue += data.value;

      // Aggregate VAT
      Object.entries(data.vat).forEach(([vatRate, amount]) => {
        allProducts[code].vatBreakdown[vatRate] =
          (allProducts[code].vatBreakdown[vatRate] || 0) + amount;
      });

      totalValue += data.value;
      totalQuantity += data.quantity;
    });
  });

  const sortedProducts = Object.values(allProducts).sort(
    (a, b) => b.totalValue - a.totalValue
  );
  const sortedMonths = Array.from(months).sort();
  const period = sortedMonths[0]?.split("-")[0] || "unknown";

  return {
    period,
    months: sortedMonths,
    products: sortedProducts,
    totalValue,
    totalQuantity,
    errors,
  };
}
