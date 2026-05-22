import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";

// ─── Register fonts (lazy — only on first PDF render) ────────────────────────

let fontsRegistered = false;

function ensureFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf",
        fontWeight: 700,
      },
    ],
  });
  fontsRegistered = true;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: "2 solid #6c63ff",
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111318",
  },
  brandAccent: {
    color: "#6c63ff",
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111318",
  },
  invoiceLabel: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
    color: "#111318",
    marginBottom: 2,
  },
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottom: "1 solid #e5e7eb",
  },
  tableCellDesc: {
    flex: 4,
    fontSize: 10,
    color: "#111318",
  },
  tableCellQty: {
    flex: 1,
    fontSize: 10,
    color: "#111318",
    textAlign: "center",
  },
  tableCellPrice: {
    flex: 2,
    fontSize: 10,
    color: "#111318",
    textAlign: "right",
  },
  tableCellTotal: {
    flex: 2,
    fontSize: 10,
    color: "#111318",
    textAlign: "right",
  },
  totalsSection: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    width: "50%",
  },
  totalLabel: {
    fontSize: 10,
    color: "#6b7280",
    flex: 2,
    textAlign: "right",
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 10,
    color: "#111318",
    flex: 1,
    textAlign: "right",
  },
  totalBold: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111318",
    flex: 1,
    textAlign: "right",
  },
  totalLabelBold: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111318",
    flex: 2,
    textAlign: "right",
    paddingRight: 12,
  },
  totalDivider: {
    borderTop: "1 solid #e5e7eb",
    marginVertical: 6,
    width: "50%",
    alignSelf: "flex-end",
  },
  notesSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#6b7280",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDFInvoiceData {
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string | null;
  clientVatNumber?: string | null;
  currency: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  taxRate: number;
  withholdingTaxRate: number;
  total: number;
  notes?: string | null;
  orgName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencySymbol: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr.",
};

function fmt(amount: number, currency: string): string {
  const sym = currencySymbol[currency] || currency;
  return `${sym} ${amount.toFixed(2)}`;
}

function statusBadgeStyle(status: string) {
  switch (status) {
    case "paid":
      return { color: "#16a34a", bg: "#dcfce7" };
    case "sent":
      return { color: "#d97706", bg: "#fef3c7" };
    case "overdue":
      return { color: "#dc2626", bg: "#fee2e2" };
    case "draft":
      return { color: "#6b7280", bg: "#f3f4f6" };
    default:
      return { color: "#6b7280", bg: "#f3f4f6" };
  }
}

// ─── Document Component ───────────────────────────────────────────────────────

export function InvoicePDF({ data }: { data: PDFInvoiceData }) {
  const badge = statusBadgeStyle(data.status);
  const vatAmount = data.subtotal * (data.taxRate / 100);
  const withholdingAmount = data.subtotal * (data.withholdingTaxRate / 100);
  const statusLabels: Record<string, string> = {
    draft: "Bozza",
    sent: "Inviata",
    overdue: "Scaduta",
    paid: "Pagata",
    cancelled: "Annullata",
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              Invoice<Text style={styles.brandAccent}>Studio</Text>
            </Text>
            {data.orgName && (
              <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>
                {data.orgName}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.invoiceLabel}>Fattura</Text>
            <Text style={styles.invoiceNumber}>{data.number}</Text>
            <View
              style={{
                ...styles.statusBadge,
                backgroundColor: badge.bg,
                color: badge.color,
                marginTop: 6,
              }}
            >
              <Text>{statusLabels[data.status] || data.status}</Text>
            </View>
          </View>
        </View>

        {/* Parties */}
        <View style={[styles.section, styles.row]}>
          <View style={styles.col}>
            <Text style={styles.label}>Emessa da</Text>
            <Text style={styles.value}>{data.orgName || "—"}</Text>
          </View>
          <View style={[styles.col, { paddingLeft: 24 }]}>
            <Text style={styles.label}>Intestata a</Text>
            <Text style={styles.value}>{data.clientName}</Text>
            {data.clientEmail && (
              <Text style={[styles.value, { color: "#6b7280" }]}>
                {data.clientEmail}
              </Text>
            )}
            {data.clientAddress && (
              <Text style={[styles.value, { color: "#6b7280" }]}>
                {data.clientAddress}
              </Text>
            )}
            {data.clientVatNumber && (
              <Text style={[styles.value, { color: "#6b7280" }]}>
                P.IVA: {data.clientVatNumber}
              </Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={[styles.section, styles.row]}>
          <View style={styles.col}>
            <Text style={styles.label}>Data emissione</Text>
            <Text style={styles.value}>{data.issueDate}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Scadenza</Text>
            <Text style={styles.value}>{data.dueDate}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Valuta</Text>
            <Text style={styles.value}>{data.currency}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Descrizione</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Qtà</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: "right" }]}>Prezzo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: "right" }]}>Totale</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCellDesc}>{item.description}</Text>
              <Text style={styles.tableCellQty}>{item.quantity}</Text>
              <Text style={styles.tableCellPrice}>{fmt(item.unitPrice, data.currency)}</Text>
              <Text style={styles.tableCellTotal}>
                {fmt(item.quantity * item.unitPrice, data.currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Imponibile</Text>
            <Text style={styles.totalValue}>{fmt(data.subtotal, data.currency)}</Text>
          </View>
          {data.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA {data.taxRate}%</Text>
              <Text style={styles.totalValue}>{fmt(vatAmount, data.currency)}</Text>
            </View>
          )}
          {data.withholdingTaxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Rit. d&apos;acconto {data.withholdingTaxRate}%
              </Text>
              <Text style={[styles.totalValue, { color: "#dc2626" }]}>
                -{fmt(withholdingAmount, data.currency)}
              </Text>
            </View>
          )}
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelBold}>Totale</Text>
            <Text style={styles.totalBold}>{fmt(data.total, data.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Note</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            InvoiceStudio — Fattura generata digitalmente. Per assistenza: support@invoicestudio.app
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Server-side renderer ─────────────────────────────────────────────────────

export async function generateInvoicePDF(data: PDFInvoiceData): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<InvoicePDF data={data} />);
}
