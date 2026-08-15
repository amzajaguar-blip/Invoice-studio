/**
 * file-import.ts — Import di un file esistente e sua normalizzazione.
 *
 * Milo Office non deve solo produrre file: deve poter partire da un file che
 * l'utente ha gia' e ritrasformarlo in un altro formato. Questo modulo si
 * occupa della meta' "lettura"; la scrittura resta a document-format-engine.ts,
 * che sa gia' produrre PDF, Excel, Word e RTF.
 *
 * Permessi
 * ────────
 * Nessuno. `expo-document-picker` usa `ACTION_OPEN_DOCUMENT`, cioe' lo Storage
 * Access Framework: e' l'utente a scegliere il file dal selettore di sistema, e
 * l'accesso vale per quel file soltanto. Non c'entrano ne' READ_EXTERNAL_STORAGE
 * ne' alcuna richiesta a runtime — esattamente come per "Salva sul dispositivo".
 *
 * Cosa si riesce a leggere davvero
 * ────────────────────────────────
 * Fogli di calcolo e documenti testuali si leggono sul dispositivo con le
 * librerie gia' presenti. Il PDF no: estrarne il testo richiederebbe un motore
 * che su React Native non e' praticabile, quindi passa dal server. Promettere
 * "qualsiasi formato" e poi fallire in silenzio sarebbe peggio che dirlo.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

/**
 * Contenuto importato, normalizzato.
 *
 * Un foglio di calcolo resta una GRIGLIA: schiacciarlo nella forma
 * `{descrizione, quantita', importo}` di DocumentFormatData perderebbe tutte le
 * colonne in piu'. Un documento testuale resta testo.
 */
export interface ImportedContent {
  /** Titolo proposto, ricavato dal nome del file scelto. */
  title: string;
  kind: 'table' | 'text';
  /** Valorizzato quando kind === 'table'. */
  rows?: string[][];
  /** Valorizzato quando kind === 'text'. */
  text?: string;
  /** Estensione della sorgente, minuscola e senza punto. */
  sourceExt: string;
  /** Nome originale del file scelto. */
  sourceName: string;
  /** Dimensione in byte, quando il selettore la fornisce. */
  sourceSize?: number;
}

export type PickedFile = {
  uri: string;
  name: string;
  size?: number;
  ext: string;
};

/** Esito della scelta: l'annullamento e' un esito normale, non un errore. */
export type PickResult =
  | { status: 'picked'; file: PickedFile }
  | { status: 'cancelled' };

// ─── Formati ──────────────────────────────────────────────────────────────────

/** Estensioni leggibili direttamente sul dispositivo. */
export const LOCAL_SOURCE_EXTS = [
  'xlsx', 'xls', 'csv', 'ods',
  'docx',
  'rtf', 'txt', 'html', 'htm', 'md', 'json',
] as const;

/** Estensioni che richiedono l'estrazione lato server. */
export const REMOTE_SOURCE_EXTS = ['pdf'] as const;

export function isSupportedSource(ext: string): boolean {
  const e = ext.toLowerCase();
  return (
    (LOCAL_SOURCE_EXTS as readonly string[]).includes(e) ||
    (REMOTE_SOURCE_EXTS as readonly string[]).includes(e)
  );
}

export function requiresServerExtraction(ext: string): boolean {
  return (REMOTE_SOURCE_EXTS as readonly string[]).includes(ext.toLowerCase());
}

/** Tetto di dimensione: oltre, la lettura in memoria non e' ragionevole. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

// ─── Scelta del file ──────────────────────────────────────────────────────────

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx <= 0 ? '' : name.slice(idx + 1).toLowerCase();
}

function baseNameOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return (idx <= 0 ? name : name.slice(0, idx)).trim() || name;
}

/**
 * Apre il selettore di sistema.
 *
 * `copyToCacheDirectory` copia il file scelto nella cache dell'app: senza questa
 * copia l'URI restituito e' un `content://` che le librerie di lettura non
 * sanno aprire.
 */
export async function pickFileToConvert(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { status: 'cancelled' };
  }

  const asset = result.assets[0];
  return {
    status: 'picked',
    file: {
      uri: asset.uri,
      name: asset.name,
      size: asset.size,
      ext: extensionOf(asset.name),
    },
  };
}

// ─── Lettori ──────────────────────────────────────────────────────────────────

/**
 * Fogli di calcolo. SheetJS legge xlsx, xls, csv e ods dallo stesso ingresso; la
 * griglia esce come array di array, senza interpretare quale colonna sia cosa —
 * interpretare sarebbe indovinare.
 */
function readSpreadsheet(base64: string): string[][] {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return grid.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []));
}

/**
 * DOCX: e' uno ZIP che contiene `word/document.xml`. Il testo vive nei nodi
 * `<w:t>`; i `<w:p>` sono i paragrafi e diventano gli a capo.
 */
async function readDocx(base64: string): Promise<string> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const entry = zip.file('word/document.xml');
  if (!entry) {
    throw new Error('Il file .docx non contiene word/document.xml.');
  }
  const xml = await entry.async('string');

  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    // `<w:t[^>]*>` sembrava giusto ma prendeva ogni tag che comincia per
    // `w:t`: <w:tbl>, <w:tblPr>, <w:tr>, <w:tc>. Il pezzo che segue non
    // contiene un `</w:t>`, quindi `split('</w:t>')[0]` restituiva il markup
    // cosi' com'era, e un .docx con una sola tabella finiva convertito in un
    // PDF pieno di `</w:tblPr>` e `<w:p><w:r>`. Qui dopo `w:t` si pretende un
    // `>` oppure uno spazio (il caso di <w:t xml:space="preserve">).
    .split(/<w:t(?:\s[^>]*)?>/)
    .map((chunk, i) => (i === 0 ? '' : chunk.split('</w:t>')[0]))
    .join('')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** RTF: si tolgono gruppi di controllo e control word, resta il testo. */
function readRtf(raw: string): string {
  return raw
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** HTML: via tag e entita' minime, resta il testo leggibile. */
function readHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Ingresso pubblico ────────────────────────────────────────────────────────

/**
 * Legge un file scelto e lo normalizza, quando la lettura e' possibile sul
 * dispositivo.
 *
 * Per il PDF NON tenta nulla: solleva un errore riconoscibile, perche' quel
 * percorso passa dal server (vedi `extractPdfText`).
 */
export async function readLocalFile(file: PickedFile): Promise<ImportedContent> {
  if (file.size !== undefined && file.size > MAX_IMPORT_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (requiresServerExtraction(file.ext)) {
    throw new Error('NEEDS_SERVER_EXTRACTION');
  }
  if (!isSupportedSource(file.ext)) {
    throw new Error('UNSUPPORTED_SOURCE');
  }

  const common = {
    title: baseNameOf(file.name),
    sourceExt: file.ext,
    sourceName: file.name,
    sourceSize: file.size,
  };

  if (['xlsx', 'xls', 'ods', 'csv'].includes(file.ext)) {
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ...common, kind: 'table', rows: readSpreadsheet(base64) };
  }

  if (file.ext === 'docx') {
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ...common, kind: 'text', text: await readDocx(base64) };
  }

  const raw = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (file.ext === 'rtf') return { ...common, kind: 'text', text: readRtf(raw) };
  if (file.ext === 'html' || file.ext === 'htm') {
    return { ...common, kind: 'text', text: readHtml(raw) };
  }
  return { ...common, kind: 'text', text: raw.trim() };
}

/**
 * Costruisce il contenuto normalizzato a partire dal testo che il server ha
 * estratto da un PDF. Le pagine restano separate da una riga vuota.
 */
export function importedFromPdfPages(
  file: PickedFile,
  pages: string[]
): ImportedContent {
  return {
    title: baseNameOf(file.name),
    kind: 'text',
    text: pages.join('\n\n').trim(),
    sourceExt: file.ext,
    sourceName: file.name,
    sourceSize: file.size,
  };
}

/**
 * Legge il file scelto come base64. Serve alla rotta di estrazione del PDF, che
 * riceve il contenuto nel corpo della richiesta.
 */
export async function readAsBase64(file: PickedFile): Promise<string> {
  return FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
