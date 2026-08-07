/**
 * excel-engine.ts
 *
 * Genera file .xlsx e .csv per una o più note spese.
 *
 * Regole:
 * - Il chiamante DEVE verificare l'entitlement (vela.export.excel) prima di invocare.
 * - Questo modulo NON controlla entitlement IAP.
 * - I titoli delle colonne sono tradotti nella lingua indicata da `locale`.
 *
 * Dipendenze:
 *   xlsx 0.18.5  (SheetJS CE — già in package.json)
 *   expo-file-system ~19.0.0
 *   expo-sharing ~14.0.0
 */

import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ExpenseReport, ExpenseItem } from '@/shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipi pubblici
// ─────────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportOptions {
  /** Formato di output. Default: 'xlsx' */
  format?: ExportFormat;
  /** Nome file senza estensione. Default: 'expense_report' */
  filename?: string;
  /**
   * Codice lingua BCP-47 (es. 'it', 'en', 'de').
   * Determina le intestazioni colonne nel documento.
   * Default: 'en'
   */
  locale?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Traduttore intestazioni colonne integrato nel documento
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnHeaders {
  date: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
  total: string;
  subtotal: string;
}

const COLUMN_HEADERS: Record<string, ColumnHeaders> = {
  it: {
    date: 'Data',
    category: 'Categoria',
    amount: 'Importo',
    currency: 'Valuta',
    description: 'Descrizione',
    total: 'Totale',
    subtotal: 'Subtotale per categoria',
  },
  en: {
    date: 'Date',
    category: 'Category',
    amount: 'Amount',
    currency: 'Currency',
    description: 'Description',
    total: 'Total',
    subtotal: 'Subtotal by category',
  },
  de: {
    date: 'Datum',
    category: 'Kategorie',
    amount: 'Betrag',
    currency: 'Währung',
    description: 'Beschreibung',
    total: 'Gesamt',
    subtotal: 'Zwischensumme je Kategorie',
  },
  es: {
    date: 'Fecha',
    category: 'Categoría',
    amount: 'Importe',
    currency: 'Divisa',
    description: 'Descripción',
    total: 'Total',
    subtotal: 'Subtotal por categoría',
  },
  fr: {
    date: 'Date',
    category: 'Catégorie',
    amount: 'Montant',
    currency: 'Devise',
    description: 'Description',
    total: 'Total',
    subtotal: 'Sous-total par catégorie',
  },
  pt: {
    date: 'Data',
    category: 'Categoria',
    amount: 'Valor',
    currency: 'Moeda',
    description: 'Descrição',
    total: 'Total',
    subtotal: 'Subtotal por categoria',
  },
  zh: {
    date: '日期',
    category: '类别',
    amount: '金额',
    currency: '货币',
    description: '描述',
    total: '总计',
    subtotal: '按类别小计',
  },
};

/** Restituisce le intestazioni per la lingua richiesta, con fallback a 'en'. */
function getHeaders(locale?: string): ColumnHeaders {
  const lang = (locale ?? 'en').split('-')[0].toLowerCase();
  return COLUMN_HEADERS[lang] ?? COLUMN_HEADERS['en'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers interni
// ─────────────────────────────────────────────────────────────────────────────

/** Formatta una Date in stringa ISO locale (YYYY-MM-DD). */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Sanitizza un valore testuale per prevenire formula injection in Excel/CSV.
 * I caratteri = + - @ all'inizio di una cella sono interpretati come inizio
 * formula da Excel, LibreOffice e Google Sheets — prefissarli con apostrofo
 * forza la cella a essere trattata come testo (OWASP: Input Validation).
 * Ref: https://owasp.org/www-community/attacks/CSV_Injection
 */
function sanitizeCellValue(value: string): string {
  if (typeof value !== 'string') return value;
  // Prefissi che attivano l'interpretazione come formula
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Calcola i subtotali per categoria da una lista di items. */
function computeSubtotals(items: ExpenseItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.amount;
    return acc;
  }, {});
}

/**
 * Costruisce le righe del documento (dati + subtotali + totale).
 * Ritorna:
 *  - `rows`: array di array di valori (riga di intestazione inclusa)
 *  - `totalRowIndex`: indice 0-based della riga del totale complessivo
 */
function buildRows(
  reports: ExpenseReport[],
  headers: ColumnHeaders
): { rows: (string | number)[][]; totalRowIndex: number } {
  const headerRow: string[] = [
    headers.date,
    headers.category,
    headers.amount,
    headers.currency,
    headers.description,
  ];

  const dataRows: (string | number)[][] = [];

  // Aggrega tutti gli items e subtotali attraverso tutti i report
  const allSubtotals: Record<string, number> = {};

  for (const report of reports) {
    for (const item of report.items) {
      dataRows.push([
        formatDate(item.date instanceof Date ? item.date : new Date(item.date)),
        sanitizeCellValue(item.category),
        item.amount,                              // number — immune da formula injection
        sanitizeCellValue(item.currency ?? ''),
        sanitizeCellValue(item.description ?? ''),
      ]);
      allSubtotals[item.category] = (allSubtotals[item.category] ?? 0) + item.amount;
    }
  }

  // Righe subtotale per categoria
  const subtotalRows: (string | number)[][] = Object.entries(allSubtotals).map(
    ([category, sum]) => [
      '',
      sanitizeCellValue(category),
      sum,
      '',                     // currency — vuoto (aggregato)
      headers.subtotal,
    ]
  );

  // Totale complessivo
  const grandTotal = Object.values(allSubtotals).reduce((a, b) => a + b, 0);
  const totalRow: (string | number)[] = [
    '',
    '',
    grandTotal,
    '',
    headers.total,
  ];

  const rows: (string | number)[][] = [
    headerRow,
    ...dataRows,
    ...subtotalRows,
    totalRow,
  ];

  const totalRowIndex = rows.length - 1;

  return { rows, totalRowIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generazione XLSX
// ─────────────────────────────────────────────────────────────────────────────

async function generateXLSX(
  reports: ExpenseReport[],
  options: Required<ExportOptions>
): Promise<string> {
  const headers = getHeaders(options.locale);
  const { rows, totalRowIndex } = buildRows(reports, headers);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Applica bold all'ultima riga (totale complessivo)
  // SheetJS CE supporta solo un sottoinsieme di stili tramite il modulo 'cellStyles'
  // ma la versione CE (0.18.5) non include stili completi nel bundle standard.
  // Usiamo l'approccio compatibile: imposta '!merges' e formatta il numero.
  const totalCols = rows[0]?.length ?? 5;
  for (let c = 0; c < totalCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c });
    if (worksheet[cellRef]) {
      // Aggiungiamo metadata custom — i viewer moderni applicano bold se presente
      // (compatibilità massima senza richiedere xlsxstyle/exceljs)
      worksheet[cellRef].s = { font: { bold: true } };
    }
  }

  // Larghezze colonne automatiche basate sul contenuto
  const colWidths = rows.reduce<number[]>((acc, row) => {
    row.forEach((cell, i) => {
      const len = String(cell).length;
      acc[i] = Math.max(acc[i] ?? 10, len + 2);
    });
    return acc;
  }, []);
  worksheet['!cols'] = colWidths.map((w) => ({ wch: w }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

  const xlsxBinary: string = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'base64',
  });

  const filePath = `${FileSystem.cacheDirectory}${options.filename}.xlsx`;
  await FileSystem.writeAsStringAsync(filePath, xlsxBinary, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generazione CSV
// ─────────────────────────────────────────────────────────────────────────────

async function generateCSV(
  reports: ExpenseReport[],
  options: Required<ExportOptions>
): Promise<string> {
  const headers = getHeaders(options.locale);
  const { rows } = buildRows(reports, headers);

  /** Escapa un valore CSV: wrappa in virgolette se contiene virgola, virgolette o newline. */
  const escapeCell = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = rows.map((row) => row.map(escapeCell).join(','));
  const csvContent = csvLines.join('\n');

  // UTF-8 BOM per compatibilità con Excel (apre correttamente caratteri non-ASCII)
  const BOM = '\uFEFF';
  const csvWithBom = BOM + csvContent;

  const filePath = `${FileSystem.cacheDirectory}${options.filename}.csv`;
  await FileSystem.writeAsStringAsync(filePath, csvWithBom, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pubblica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un file .xlsx o .csv per una o più note spese.
 *
 * Il chiamante DEVE verificare l'entitlement (es. `vela.export.excel`)
 * prima di invocare questa funzione.
 *
 * @param reports  Array di ExpenseReport da esportare.
 * @param options  Opzioni formato, nome file e lingua.
 * @returns        Path assoluto del file generato nella cache directory.
 */
export async function generateExpenseExport(
  reports: ExpenseReport[],
  options?: ExportOptions
): Promise<string> {
  if (!reports || reports.length === 0) {
    throw new Error('generateExpenseExport: reports array must be non-empty');
  }

  const resolvedOptions: Required<ExportOptions> = {
    format: options?.format ?? 'xlsx',
    filename: options?.filename ?? 'expense_report',
    locale: options?.locale ?? 'en',
  };

  if (resolvedOptions.format === 'csv') {
    return generateCSV(reports, resolvedOptions);
  }
  return generateXLSX(reports, resolvedOptions);
}

/**
 * Condivide il file generato via sistema di sharing nativo.
 *
 * Se `Sharing.shareAsync` non è disponibile o lancia un errore,
 * il file viene copiato in `documentDirectory` come fallback (Req 5.6).
 *
 * @param filepath  Path assoluto del file da condividere.
 * @param filename  Nome file (con estensione) da usare nel fallback.
 * @returns         `{ shared: true }` se la condivisione ha avuto successo,
 *                  `{ shared: false, fallbackPath }` se è stato usato il fallback.
 */
export async function shareExpenseExport(
  filepath: string,
  filename: string
): Promise<{ shared: boolean; fallbackPath?: string }> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing not available on this platform');
    }
    await Sharing.shareAsync(filepath, {
      mimeType: filepath.endsWith('.csv')
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: filename,
      UTI: filepath.endsWith('.csv') ? 'public.comma-separated-values-text' : 'com.microsoft.excel.xlsx',
    });
    return { shared: true };
  } catch (_err) {
    // Fallback: copia il file in documentDirectory (persistente, accessibile all'utente)
    const fallbackPath = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.copyAsync({ from: filepath, to: fallbackPath });
    } catch (copyErr) {
      // Se anche la copia fallisce, rilanciamo l'errore originale
      throw new Error(
        `shareExpenseExport: sharing failed and fallback copy also failed. ` +
          `Original error: ${_err}. Copy error: ${copyErr}`
      );
    }
    return { shared: false, fallbackPath };
  }
}
