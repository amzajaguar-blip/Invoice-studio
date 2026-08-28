/**
 * Document Model IR — Modello intermedio semantico per la generazione documentale.
 *
 * Questo modello separa la COMPRENSIONE della richiesta (naturale/AI) dalla
 * GENERAZIONE del file (PDF/DOCX/XLSX/RTF/TXT/HTML).
 *
 * Qualsiasi template, builder o validazione lavora SOLO su questo modello.
 * Mai passare stringhe grezze o HTML ai builder.
 */

// ============================================================
// STILI E FORMATTAZIONE
// ============================================================

export type HorizontalAlignment = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';

export interface FontStyle {
  /** Nome font (es. 'Helvetica', 'Times New Roman', 'Georgia') — eredita dal default se omesso */
  family?: string;
  /** Dimensione in punti — eredita dal default se omesso */
  size?: number;
  /** Colore esadecimale senza # (es. '11181C') */
  color?: string;
  /** Grassetto */
  bold?: boolean;
  /** Corsivo */
  italic?: boolean;
  /** Sottolineato */
  underline?: boolean;
  /** Barrato */
  strikethrough?: boolean;
}

export interface ParagraphStyle {
  /** Allineamento orizzontale */
  alignment?: HorizontalAlignment;
  /** Spaziatura prima (pt) */
  spaceBefore?: number;
  /** Spaziatura dopo (pt) */
  spaceAfter?: number;
  /** Interlinea (multiplo, es. 1.15, 1.5) */
  lineSpacing?: number;
  /** Rientro sinistro (pt) */
  indentLeft?: number;
  /** Rientro destro (pt) */
  indentRight?: number;
  /** Rientro prima riga (pt, negativo = hanging) */
  indentFirstLine?: number;
  /** Colore sfondo paragrafo */
  backgroundColor?: string;
  /** Bordi */
  border?: BorderStyle;
  /** Mantieni con il prossimo (evita page break) */
  keepWithNext?: boolean;
  /** Mantieni righe insieme */
  keepLinesTogether?: boolean;
  /** Page break prima */
  pageBreakBefore?: boolean;
}

export interface BorderStyle {
  top?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
  right?: BorderSide;
}

export interface BorderSide {
  style: 'none' | 'single' | 'double' | 'dashed' | 'dotted';
  width: number; // pt
  color?: string;
}

// ============================================================
// ELEMENTI DI CONTENUTO (inline)
// ============================================================

export type InlineElement =
  | TextRun
  | Hyperlink
  | ImageRun
  | FootnoteReference
  | PageNumber
  | TotalPages;

export interface TextRun {
  type: 'text';
  text: string;
  style?: FontStyle;
}

export interface Hyperlink {
  type: 'hyperlink';
  text: string;
  url: string;
  style?: FontStyle;
  tooltip?: string;
}

export interface ImageRun {
  type: 'image';
  /** base64 data URI o path locale */
  source: string;
  /** Larghezza in punti */
  width: number;
  /** Altezza in punti */
  height: number;
  /** Testo alternativo */
  alt?: string;
}

export interface FootnoteReference {
  type: 'footnoteRef';
  id: string;
}

export interface PageNumber {
  type: 'pageNumber';
  format?: 'decimal' | 'roman' | 'romanLower' | 'letter' | 'letterLower';
}

export interface TotalPages {
  type: 'totalPages';
  format?: 'decimal' | 'roman' | 'romanLower' | 'letter' | 'letterLower';
}

// ============================================================
// BLOCCHI PRINCIPALI
// ============================================================

export type BlockElement =
  | Heading
  | Paragraph
  | List
  | Table
  | ImageBlock
  | Quote
  | PageBreak
  | SectionBreak
  | HorizontalRule
  | SignatureBlock
  | Checklist
  | CodeBlock;

export interface Heading {
  type: 'heading';
  /** Livello 1-6 */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Contenuto inline */
  children: InlineElement[];
  /** Stile specifico per questo heading (override template) */
  style?: ParagraphStyle & { font?: FontStyle };
  /** ID per TOC / anchor */
  id?: string;
  /** Numerazione automatica (es. '1.', '1.1', 'I') */
  numbering?: NumberingStyle;
}

export interface NumberingStyle {
  /** Formato: 'decimal' | 'upperRoman' | 'lowerRoman' | 'upperLetter' | 'lowerLetter' */
  format: string;
  /** Prefisso (es. 'Cap. ') */
  prefix?: string;
  /** Suffisso (es. '. ') */
  suffix?: string;
  /** Livello genitore per numerazione gerarchica */
  level?: number;
}

export interface Paragraph {
  type: 'paragraph';
  children: InlineElement[];
  style?: ParagraphStyle;
  /** Stile carattere di default per i run senza stile */
  defaultRunStyle?: FontStyle;
  /** Liste numerate/puntate annidate (se questo paragrafo è un list item) */
  listInfo?: ListItemInfo;
}

export interface ListItemInfo {
  /** ID della lista a cui appartiene */
  listId: string;
  /** Livello di annidamento (0 = root) */
  level: number;
  /** Numero ordinale (per liste ordinate) */
  ordinal?: number;
  /** Testo marker personalizzato (per liste non ordinate) */
  marker?: string;
}

export interface List {
  type: 'list';
  /** ID univoco per riferimenti cross-riferimento */
  id: string;
  /** Ordinata (1, 2, 3) o puntata (•, -, *) */
  ordered: boolean;
  /** Elementi della lista */
  items: ListItem[];
  /** Stile numerazione per liste ordinate */
  numberingStyle?: NumberingStyle;
  /** Marker per liste non ordinate */
  bulletMarker?: string;
  /** Spaziatura tra item */
  itemSpacing?: number;
}

export interface ListItem {
  /** Blocchi contenuti in questo item (paragrafi, sottoliste, tabelle...) */
  blocks: BlockElement[];
  /** Valore ordinale esplicito (per riprendere numerazione) */
  ordinal?: number;
  /** Marker personalizzato */
  marker?: string;
}

export interface Table {
  type: 'table';
  /** ID per riferimenti */
  id?: string;
  /** Intestazione colonna (opzionale) */
  header?: TableRow;
  /** Righe dati */
  rows: TableRow[];
  /** Larghezza colonne in % (somma = 100) o 'auto' */
  columnWidths?: (number | 'auto')[];
  /** Stile tabella */
  style?: TableStyle;
  /** Non spezzare righe tra pagine */
  keepRowsTogether?: boolean;
  /** Ripeti header su ogni pagina */
  repeatHeader?: boolean;
  /** Caption / didascalia */
  caption?: InlineElement[];
}

export interface TableRow {
  cells: TableCell[];
  /** È una riga di intestazione */
  isHeader?: boolean;
  /** Altezza minima (pt) */
  height?: number;
  /** Colore sfondo riga */
  backgroundColor?: string;
}

export interface TableCell {
  /** Contenuto: blocchi (paragrafi, liste, tabelle annidate) */
  blocks: BlockElement[];
  /** Span orizzontale (colspan) */
  colSpan?: number;
  /** Span verticale (rowspan) */
  rowSpan?: number;
  /** Allineamento orizzontale */
  alignment?: HorizontalAlignment;
  /** Allineamento verticale */
  verticalAlignment?: VerticalAlignment;
  /** Stile cella */
  style?: CellStyle;
  /** Larghezza cella (% o 'auto') */
  width?: number | 'auto';
}

export interface CellStyle {
  backgroundColor?: string;
  border?: BorderStyle;
  padding?: { top: number; right: number; bottom: number; left: number };
  font?: FontStyle;
}

export interface TableStyle {
  /** Larghezza tabella (% pagina, es. '100%', o 'auto') */
  width?: number | 'auto' | string;
  /** Bordo esterno */
  border?: BorderStyle;
  /** Bordo celle interne */
  cellBorder?: BorderSide;
  /** Spaziatura celle (cellspacing) */
  cellSpacing?: number;
  /** Padding default celle */
  cellPadding?: { top: number; right: number; bottom: number; left: number };
  /** Colori righe alternate */
  alternateRowColors?: [string, string];
  /** Colore header */
  headerColor?: string;
  /** Colore footer (ultima riga) */
  footerColor?: string;
}

export interface ImageBlock {
  type: 'imageBlock';
  source: string; // base64 data URI o path
  width: number; // pt
  height: number; // pt
  /** Didascalia */
  caption?: InlineElement[];
  /** Allineamento */
  alignment?: HorizontalAlignment;
  /** Stile paragrafo per didascalia */
  captionStyle?: ParagraphStyle;
  /** Mantieni con didascalia */
  keepWithCaption?: boolean;
}

export interface Quote {
  type: 'quote';
  /** Citazione: blocchi (paragrafi, liste...) */
  blocks: BlockElement[];
  /** Attribuzione (autore, fonte) */
  attribution?: InlineElement[];
  /** Stile */
  style?: {
    borderLeft?: BorderSide;
    backgroundColor?: string;
    padding?: number;
    font?: FontStyle;
  };
}

export interface PageBreak {
  type: 'pageBreak';
  /** Forza break anche se pagina vuota */
  force?: boolean;
}

export interface SectionBreak {
  type: 'sectionBreak';
  /** Tipo: 'nextPage' | 'continuous' | 'evenPage' | 'oddPage' */
  breakType: 'nextPage' | 'continuous' | 'evenPage' | 'oddPage';
  /** Nuovi margini per la sezione successiva */
  newMargins?: PageMargins;
  /** Nuovi header/footer */
  newHeader?: HeaderFooter;
  newFooter?: HeaderFooter;
  /** Nuove colonne */
  columns?: number;
  /** Spaziatura colonne (pt) */
  columnSpacing?: number;
}

export interface HorizontalRule {
  type: 'horizontalRule';
  /** Stile linea */
  border?: BorderSide;
  /** Larghezza % */
  width?: number;
  /** Allineamento */
  alignment?: HorizontalAlignment;
}

export interface SignatureBlock {
  type: 'signatureBlock';
  /** Etichetta (es. 'Firma', 'Timbro e Firma') */
  label: string;
  /** Nome firmatario (opzionale, precompilato) */
  signerName?: string;
  /** Ruolo firmatario */
  signerRole?: string;
  /** Data firma (opzionale, auto = oggi) */
  date?: string | 'auto';
  /** Larghezza linea firma (pt) */
  lineWidth?: number;
  /** Altezza area firma (pt) */
  lineHeight?: number;
  /** Mostra linea per data */
  showDateLine?: boolean;
  /** Allineamento blocco */
  alignment?: HorizontalAlignment;
}

export interface Checklist {
  type: 'checklist';
  /** Titolo checklist */
  title?: InlineElement[];
  items: ChecklistItem[];
  /** Spaziatura item */
  itemSpacing?: number;
}

export interface ChecklistItem {
  /** Testo item */
  text: InlineElement[];
  /** Spuntato di default */
  checked?: boolean;
  /** Livello annidamento */
  level?: number;
}

export interface CodeBlock {
  type: 'codeBlock';
  /** Codice sorgente */
  code: string;
  /** Linguaggio per syntax highlighting */
  language?: string;
  /** Tema: 'light' | 'dark' | 'auto' */
  theme?: 'light' | 'dark' | 'auto';
  /** Font monospace */
  font?: FontStyle;
  /** Mostra numeri riga */
  showLineNumbers?: boolean;
}

// ============================================================
// HEADER / FOOTER / NUMERAZIONE PAGINE
// ============================================================

export interface HeaderFooter {
  /** Blocchi contenuto (paragrafi, tabelle, immagini) */
  blocks: BlockElement[];
  /** Diverso per prima pagina */
  differentFirstPage?: HeaderFooter;
  /** Diverso per pagine pari/dispari */
  differentOddEven?: {
    odd: HeaderFooter;
    even: HeaderFooter;
  };
  /** Altezza area (pt) */
  height?: number;
  /** Distanza dal bordo pagina (pt) */
  distanceFromEdge?: number;
}

export interface PageNumbering {
  /** Formato numero */
  format: 'decimal' | 'roman' | 'romanLower' | 'letter' | 'letterLower';
  /** Prefisso (es. 'Pag. ') */
  prefix?: string;
  /** Suffisso (es. ' / 10') */
  suffix?: string;
  /** Inizio numerazione (default 1) */
  startAt?: number;
  /** Posizione: header | footer */
  position: 'header' | 'footer';
  /** Allineamento */
  alignment: HorizontalAlignment;
  /** Mostra su prima pagina */
  showOnFirstPage?: boolean;
  /** Stile font */
  font?: FontStyle;
}

// ============================================================
// MARGINI E LAYOUT PAGINA
// ============================================================

export interface PageMargins {
  top: number;    // pt
  right: number;  // pt
  bottom: number; // pt
  left: number;   // pt
  /** Header distance from top */
  header?: number;
  /** Footer distance from bottom */
  footer?: number;
  /** Gutter (margine rilegatura) */
  gutter?: number;
  /** Gutter position: 'left' | 'top' */
  gutterPosition?: 'left' | 'top';
}

export interface PageSetup {
  /** Dimensione pagina: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | {width, height} */
  size: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | { width: number; height: number };
  /** Orientamento */
  orientation: 'portrait' | 'landscape';
  /** Margini */
  margins: PageMargins;
  /** Colonne */
  columns?: number;
  /** Spaziatura colonne */
  columnSpacing?: number;
  /** Linee griglia (per debug) */
  showGrid?: boolean;
}

// ============================================================
// METADATI DOCUMENTO
// ============================================================

export interface DocumentMetadata {
  /** Titolo documento (per proprietà file) */
  title: string;
  /** Sottotitolo */
  subtitle?: string;
  /** Autore */
  author?: string;
  /** Creatore applicazione */
  creator?: string;
  /** Azienda/Organizzazione */
  company?: string;
  /** Soggetto */
  subject?: string;
  /** Parole chiave */
  keywords?: string[];
  /** Categoria */
  category?: string;
  /** Descrizione */
  description?: string;
  /** Data creazione */
  createdAt?: Date;
  /** Data modifica */
  modifiedAt?: Date;
  /** Lingua principale (BCP 47) */
  language?: string;
  /** Versione documento */
  version?: string;
  /** Identificativo univoco */
  identifier?: string;
  /** Campi personalizzati */
  customProperties?: Record<string, string>;
}

// ============================================================
// MODELLO DOCUMENTO PRINCIPALE
// ============================================================

export interface DocumentModel {
  /** Metadati file */
  metadata: DocumentMetadata;
  /** Setup pagina */
  pageSetup: PageSetup;
  /** Header */
  header?: HeaderFooter;
  /** Footer */
  footer?: HeaderFooter;
  /** Numerazione pagine */
  pageNumbering?: PageNumbering;
  /** Contenuto: sequenza di blocchi */
  blocks: BlockElement[];
  /** Stili globali (riferiti per nome dai blocchi) */
  styles?: DocumentStyles;
  /** Impostazioni specifiche per formato di output */
  formatOptions?: FormatSpecificOptions;
}

export interface DocumentStyles {
  /** Stili paragrafo per nome */
  paragraphStyles?: Record<string, ParagraphStyle>;
  /** Stili carattere per nome */
  characterStyles?: Record<string, FontStyle>;
  /** Stili lista per nome */
  listStyles?: Record<string, { ordered: boolean; numberingStyle?: NumberingStyle; bulletMarker?: string }>;
  /** Stili tabella per nome */
  tableStyles?: Record<string, TableStyle>;
  /** Default run style */
  defaultFont?: FontStyle;
  /** Default paragraph style */
  defaultParagraph?: ParagraphStyle;
}

export interface FormatSpecificOptions {
  /** Opzioni solo per PDF */
  pdf?: {
    /** Tag PDF/UA per accessibilità */
    tagged?: boolean;
    /** Conformità: 'PDF/UA-1' | 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' */
    conformance?: string;
    /** Compressione immagini */
    imageCompression?: 'auto' | 'jpeg' | 'flate' | 'none';
    /** Qualità JPEG (0-100) */
    jpegQuality?: number;
    /** Embed font */
    embedFonts?: boolean;
    /** Subset font */
    subsetFonts?: boolean;
  };
  /** Opzioni solo per DOCX */
  docx?: {
    /** Track revisions */
    trackRevisions?: boolean;
    /** Protezione documento */
    protection?: { type: 'readOnly' | 'comments' | 'forms'; password?: string };
    /** Compatibilità */
    compatibility?: 'transitional' | 'strict';
  };
  /** Opzioni solo per XLSX */
  xlsx?: {
    /** Freeze pane */
    freezePane?: { row: number; col: number };
    /** Auto filter */
    autoFilter?: boolean;
    /** Print area */
    printArea?: string;
  };
  /** Opzioni solo per RTF */
  rtf?: {
    /** Genera RTF 1.9 (più compatibile) */
    version?: '1.5' | '1.9';
  };
}

// ============================================================
// TIPI DOCUMENTO PREDEFINITI (per template)
// ============================================================

export type DocumentType =
  | 'report'
  | 'invoice'
  | 'quote'
  | 'cv'
  | 'coverLetter'
  | 'businessLetter'
  | 'meetingMinutes'
  | 'proposal'
  | 'contract'
  | 'professionalReport'
  | 'simple'
  | 'academic'
  | 'checklist'
  | 'notes'
  | 'presentationPrint';

export interface TemplatePreset {
  /** Tipo documento */
  type: DocumentType;
  /** Nome visualizzato */
  label: string;
  /** Descrizione breve */
  description: string;
  /** Icona (Ionicons name) */
  icon: string;
  /** Setup pagina predefinito */
  pageSetup: Partial<PageSetup>;
  /** Stili predefiniti */
  styles: Partial<DocumentStyles>;
  /** Header predefinito */
  header?: HeaderFooter;
  /** Footer predefinito */
  footer?: HeaderFooter;
  /** Numerazione pagine predefinita */
  pageNumbering?: PageNumbering;
  /** Blocchi struttura base (scheletro) */
  skeleton: BlockElement[];
  /** Campi richiesti per compilare lo scheletro */
  requiredFields: TemplateField[];
  /** Campi opzionali */
  optionalFields: TemplateField[];
}

export interface TemplateField {
  /** Chiave nel modello dati */
  key: string;
  /** Etichetta utente */
  label: string;
  /** Tipo campo per UI */
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'table' | 'image' | 'boolean';
  /** Opzioni per select */
  options?: { value: string; label: string }[];
  /** Validazione */
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
  /** Placeholder */
  placeholder?: string;
  /** Aiuto */
  helpText?: string;
  /** Sezione UI */
  section?: string;
}

// ============================================================
// COSTRUTTORI COMODI (factory functions)
// ============================================================

/** Crea un TextRun */
export function text(content: string, style?: FontStyle): TextRun {
  return { type: 'text', text: content, style };
}

/** Crea un Hyperlink */
export function link(text: string, url: string, style?: FontStyle): Hyperlink {
  return { type: 'hyperlink', text, url, style };
}

/** Crea un Heading */
export function heading(level: Heading['level'], children: InlineElement[], style?: Heading['style']): Heading {
  return { type: 'heading', level, children, style };
}

/** Crea un Paragraph */
export function paragraph(children: InlineElement[], style?: ParagraphStyle): Paragraph {
  return { type: 'paragraph', children, style };
}

/** Crea un PageBreak */
export function pageBreak(force = false): PageBreak {
  return { type: 'pageBreak', force };
}

/** Crea una Table */
export function table(
  rows: TableRow[],
  options?: {
    header?: TableRow;
    columnWidths?: Table['columnWidths'];
    style?: TableStyle;
    repeatHeader?: boolean;
    keepRowsTogether?: boolean;
  }
): Table {
  return { type: 'table', rows, ...options };
}

/** Crea una TableRow */
export function tableRow(cells: TableCell[], isHeader = false): TableRow {
  return { cells, isHeader };
}

/** Crea una TableCell */
export function tableCell(blocks: BlockElement[], options?: Partial<TableCell>): TableCell {
  return { blocks, ...options };
}

/** Crea un List (ordinata) */
export function orderedList(
  items: ListItem[],
  numberingStyle?: NumberingStyle
): List {
  return { type: 'list', id: `list_${Date.now()}_${Math.random().toString(36).slice(2)}`, ordered: true, items, numberingStyle };
}

/** Crea un List (puntata) */
export function bulletList(
  items: ListItem[],
  bulletMarker = '•'
): List {
  return { type: 'list', id: `list_${Date.now()}_${Math.random().toString(36).slice(2)}`, ordered: false, items, bulletMarker };
}

/** Crea un ListItem */
export function listItem(blocks: BlockElement[], options?: Partial<ListItem>): ListItem {
  return { blocks, ...options };
}

/** Crea un ImageBlock */
export function imageBlock(
  source: string,
  width: number,
  height: number,
  options?: Partial<ImageBlock>
): ImageBlock {
  return { type: 'imageBlock', source, width, height, ...options };
}

/** Crea una Quote */
export function quote(blocks: BlockElement[], attribution?: InlineElement[]): Quote {
  return { type: 'quote', blocks, attribution };
}

/** Crea una SignatureBlock */
export function signatureBlock(
  label: string,
  options?: Partial<SignatureBlock>
): SignatureBlock {
  return { type: 'signatureBlock', label, ...options };
}

/** Crea un Checklist */
export function checklist(
  items: ChecklistItem[],
  title?: InlineElement[]
): Checklist {
  return { type: 'checklist', title, items };
}

/** Crea un ChecklistItem */
export function checklistItem(text: InlineElement[], checked = false): ChecklistItem {
  return { text, checked };
}

/** Crea un HorizontalRule */
export function horizontalRule(options?: Partial<HorizontalRule>): HorizontalRule {
  return { type: 'horizontalRule', ...options };
}

/** Crea un CodeBlock */
export function codeBlock(code: string, language?: string): CodeBlock {
  return { type: 'codeBlock', code, language };
}

// ============================================================
// DEFAULT PAGE SETUP (A4, ritratto, margini standard)
// ============================================================

export const DEFAULT_PAGE_SETUP: PageSetup = {
  size: 'A4',
  orientation: 'portrait',
  margins: {
    top: 72,    // 1 inch = 72pt
    right: 72,
    bottom: 72,
    left: 72,
    header: 36,
    footer: 36,
    gutter: 0,
    gutterPosition: 'left',
  },
};

export const DEFAULT_DOCUMENT_STYLES: DocumentStyles = {
  defaultFont: {
    family: 'Helvetica',
    size: 11,
    color: '11181C',
  },
  defaultParagraph: {
    alignment: 'justify',
    spaceBefore: 0,
    spaceAfter: 6,
    lineSpacing: 1.15,
    indentLeft: 0,
    indentRight: 0,
    indentFirstLine: 0,
  },
  paragraphStyles: {
    'heading1': { spaceBefore: 24, spaceAfter: 12, keepWithNext: true, lineSpacing: 1.2 },
    'heading2': { spaceBefore: 18, spaceAfter: 8, keepWithNext: true, lineSpacing: 1.2 },
    'heading3': { spaceBefore: 12, spaceAfter: 6, keepWithNext: true, lineSpacing: 1.2 },
    'body': { spaceAfter: 6, lineSpacing: 1.15 },
    'caption': { spaceBefore: 4, spaceAfter: 8, alignment: 'center', lineSpacing: 1.1 },
    'footer': { alignment: 'center', lineSpacing: 1.0, spaceBefore: 12 },
    'signature': { spaceBefore: 36, spaceAfter: 12, alignment: 'left' },
  },
  characterStyles: {
    'strong': { bold: true },
    'emphasis': { italic: true },
    'underline': { underline: true },
    'hyperlink': { color: '0066CC', underline: true },
    'code': { family: 'Monospace', size: 10 },
  },
  tableStyles: {
    'default': {
      width: '100%',
      cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      headerColor: 'F4F4F5',
      alternateRowColors: ['FFFFFF', 'FAFAFA'],
    },
    'invoice': {
      width: '100%',
      cellBorder: { style: 'single', width: 0.5, color: 'E5E7EB' },
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
      headerColor: 'F5F5F5',
      footerColor: 'E6F4FE',
    },
  },
};

// ============================================================
// CONVERSIONE DA DocumentFormatData (legacy) → DocumentModel
// ============================================================

import type { DocumentFormatData } from '@/lib/document-format-engine';

/**
 * Converte il vecchio DocumentFormatData nel nuovo DocumentModel.
 * Usato per migrare le schermate esistenti (generate, quotes, expenses, import)
 * senza rompere la generazione durante la transizione.
 */
export function fromLegacyFormatData(data: DocumentFormatData): DocumentModel {
  const currency = data.totals.currency === 'EUR' ? '€' : data.totals.currency;
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

  const blocks: BlockElement[] = [];

  // Titolo
  blocks.push(
    heading(1, [text(data.customTitle?.toUpperCase() ?? data.title?.toUpperCase() ?? 'DOCUMENTO')], {
      alignment: 'center',
      spaceAfter: 4,
    })
  );

  // Meta: numero, date
  const metaLines: InlineElement[] = [];
  if (data.number) {
    metaLines.push(text('N°: ', { bold: true }), text(data.number), text('   '));
  }
  if (data.issueDate) {
    metaLines.push(text('Data: ', { bold: true }), text(data.issueDate), text('   '));
  }
  if (data.dueDate) {
    metaLines.push(text('Scadenza: ', { bold: true }), text(data.dueDate), text('   '));
  }
  if (data.validUntil) {
    metaLines.push(text('Valido fino al: ', { bold: true }), text(data.validUntil));
  }
  if (metaLines.length > 0) {
    blocks.push(paragraph(metaLines, { alignment: 'center', spaceAfter: 12 }));
  }

  // Cliente
  if (data.client) {
    const clientLines: InlineElement[] = [
      text('CLIENTE', { bold: true, size: 10, color: '687076' }),
      text('\n'),
      text(data.client.name, { bold: true }),
    ];
    if (data.client.email) clientLines.push(text('\n'), text(data.client.email));
    if (data.client.address) clientLines.push(text('\n'), text(data.client.address));
    if (data.client.taxId) clientLines.push(text('\n'), text('P.IVA: ', { bold: true }), text(data.client.taxId));
    blocks.push(paragraph(clientLines, { spaceAfter: 16 }));
  }

  // Tabella voci
  if (data.lineItems.length > 0) {
    const headerRow = tableRow([
      tableCell([paragraph([text('Descrizione', { bold: true, size: 9 })])]),
      tableCell([paragraph([text('Q.tà', { bold: true, size: 9 })])], { alignment: 'right' }),
      tableCell([paragraph([text('Prezzo', { bold: true, size: 9 })])], { alignment: 'right' }),
      tableCell([paragraph([text('Importo', { bold: true, size: 9 })])], { alignment: 'right' }),
    ], true);

    const dataRows = data.lineItems.map(item =>
      tableRow([
        tableCell([paragraph([text(item.description)])]),
        tableCell([paragraph([text(String(item.quantity))])], { alignment: 'right' }),
        tableCell([paragraph([text(fmt(item.rate))])], { alignment: 'right' }),
        tableCell([paragraph([text(fmt(item.amount))])], { alignment: 'right' }),
      ])
    );

    blocks.push(
      table(dataRows, {
        header: headerRow,
        columnWidths: [55, 10, 17.5, 17.5],
        style: DEFAULT_DOCUMENT_STYLES.tableStyles?.invoice,
        repeatHeader: true,
        keepRowsTogether: true,
      })
    );
  }

  // Totali
  const totalLines: InlineElement[] = [];
  const showSubtotal = data.totals.taxAmount && data.totals.taxAmount > 0 || data.totals.subtotal !== data.totals.grandTotal;
  if (showSubtotal) {
    totalLines.push(text('Subtotale: ', { bold: true }), text(fmt(data.totals.subtotal)), text('\n'));
  }
  if (data.totals.taxAmount && data.totals.taxAmount > 0) {
    totalLines.push(
      text(`IVA (${data.totals.taxRate ?? 0}%): `, { bold: true }),
      text(fmt(data.totals.taxAmount)),
      text('\n')
    );
  }
  totalLines.push(text('TOTALE: ', { bold: true, size: 14 }), text(fmt(data.totals.grandTotal), { bold: true, size: 14 }));
  blocks.push(paragraph(totalLines, { alignment: 'right', spaceBefore: 12, spaceAfter: 16 }));

  // Note
  if (data.notes) {
    blocks.push(
      paragraph([
        text('Note:', { bold: true }),
        text('\n'),
        text(data.notes),
      ], { spaceBefore: 16, border: { top: { style: 'single', width: 0.5, color: 'E5E7EB' } } })
    );
  }

  // Footer
  blocks.push(
    paragraph(
      [text(`Generato da ${data.companyName ?? 'Milo Office'}`, { italic: true, color: '9CA3AF', size: 9 })],
      { alignment: 'center', spaceBefore: 24 }
    )
  );

  return {
    metadata: {
      title: data.title,
      author: 'Milo Office',
      creator: 'Milo Office',
      company: data.companyName ?? 'Milo Office',
      subject: data.type,
      language: 'it-IT',
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
    pageSetup: DEFAULT_PAGE_SETUP,
    pageNumbering: {
      format: 'decimal',
      prefix: 'Pag. ',
      position: 'footer',
      alignment: 'center',
      showOnFirstPage: true,
      font: { family: 'Helvetica', size: 8, color: '9CA3AF' },
    },
    blocks,
    styles: DEFAULT_DOCUMENT_STYLES,
  };
}