/**
 * generated-files.ts — Gestione dei file prodotti da Milo Office.
 *
 * Milo Office non e' solo un generatore: i file che produce devono restare a
 * disposizione dell'utente. Questo modulo e' il lato "gestore" del prodotto —
 * elenca, rinomina, elimina e salva fuori dall'app i documenti generati.
 *
 * I file vivono in `FileSystem.documentDirectory`, che e' storage privato
 * dell'app: leggerli e scriverli NON richiede alcun permesso Android, a
 * nessuna API level. Il permesso entra in scena una volta sola, in
 * `saveToDevice()`, quando l'utente vuole una copia FUORI dalla sandbox: li'
 * la strada corretta su Android moderno e' lo Storage Access Framework — e'
 * l'utente a scegliere la cartella e a concedere l'accesso a quella soltanto.
 * `READ/WRITE_EXTERNAL_STORAGE` non c'entra e non servono.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FORMAT_META, type OutputFormat } from './document-format-engine';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  /** URI `file://` completo — quello da passare a shareDocument(). */
  uri: string;
  /** Nome reale su disco, estensione inclusa. */
  filename: string;
  /** Nome leggibile: senza estensione e senza il suffisso timestamp. */
  displayName: string;
  /** Estensione in minuscolo, senza punto. */
  ext: string;
  format: OutputFormat;
  mimeType: string;
  /** Dimensione in byte. */
  size: number;
  /** Ultima modifica, millisecondi dall'epoch. */
  modifiedAt: number;
}

export type SaveToDeviceResult =
  /** File scritto nella cartella scelta dall'utente. */
  | { status: 'saved'; folderName: string }
  /** L'utente ha chiuso il selettore di cartella: non e' un errore. */
  | { status: 'cancelled' }
  /** Piattaforma senza Storage Access Framework (iOS). */
  | { status: 'unsupported' };

// ─── Mappa estensione → formato ───────────────────────────────────────────────

/**
 * Derivata da FORMAT_META cosi' che aggiungere un formato al generatore lo
 * renda automaticamente visibile al gestore. `doc` e' accettata in piu' come
 * estensione legacy: FORMAT_META.doc produce `.docx`, ma un file `.doc`
 * rimasto da versioni precedenti resta comunque elencabile.
 */
const EXT_TO_FORMAT: Record<string, OutputFormat> = (() => {
  const map: Record<string, OutputFormat> = { doc: 'doc' };
  (Object.keys(FORMAT_META) as OutputFormat[]).forEach((format) => {
    map[FORMAT_META[format].ext] = format;
  });
  return map;
})();

// ─── Helper interni ───────────────────────────────────────────────────────────

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx <= 0 ? filename : filename.slice(0, idx);
}

/**
 * I generatori accodano `_${Date.now()}` per evitare collisioni di nome
 * (document-format-engine.ts). All'utente quel numero non dice niente: qui
 * viene tolto, e gli underscore introdotti da _safeName tornano spazi.
 * Un file rinominato dall'utente non ha il suffisso e resta intatto.
 */
export function toDisplayName(filename: string): string {
  const base = stripExtension(filename).replace(/_\d{10,}$/, '');
  return base.replace(/_+/g, ' ').trim() || base;
}

/**
 * Ripulisce un nome scelto dall'utente: via i separatori di percorso e i
 * caratteri che rompono un filename, niente punti iniziali (file nascosti).
 *
 * `#` e `%` sono nella lista non perche' rompano un filename — su disco sono
 * legittimi — ma perche' qui ogni percorso e' una URI `file://` composta per
 * concatenazione (`${dir}${name}`). Un nome come `Report #3` produrrebbe
 * `file:///…/Report #3.pdf`, dove `#` apre un frammento e taglia via il resto;
 * `Sconto 50%` produrrebbe una sequenza percent-escape non valida. Il rinomino
 * sembrerebbe riuscito, e la condivisione o la cancellazione successive
 * punterebbero a un percorso diverso.
 */
export function sanitizeFileName(input: string): string {
  const cleaned = input
    .replace(/[/\\:*?"<>|#%\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned;
}

function documentDirectoryOrThrow(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('documentDirectory non disponibile su questa piattaforma.');
  }
  return dir;
}

/**
 * Ricava un nome di cartella leggibile da un URI SAF, tipicamente
 * `content://com.android.externalstorage.documents/tree/primary%3ADownload`.
 * Se la forma non e' riconoscibile si restituisce stringa vuota e la UI
 * mostrera' un messaggio generico invece di un URI incollato a schermo.
 */
function describeSafFolder(directoryUri: string): string {
  try {
    const decoded = decodeURIComponent(directoryUri);
    const afterTree = decoded.split('/tree/').pop() ?? decoded;
    const afterColon = afterTree.includes(':')
      ? afterTree.slice(afterTree.lastIndexOf(':') + 1)
      : afterTree;
    const segment = afterColon.split('/').filter(Boolean).pop() ?? '';
    return segment;
  } catch {
    return '';
  }
}

// ─── Lettura ──────────────────────────────────────────────────────────────────

/**
 * Elenca i documenti generati, dal piu' recente al piu' vecchio.
 *
 * Vengono considerati solo i file con un'estensione che il generatore sa
 * produrre: la documentDirectory ospita anche file di servizio (cache di
 * librerie, log) che non sono documenti dell'utente e non vanno mostrati.
 */
/**
 * Data di modifica in millisecondi, con due reti di sicurezza.
 *
 * `FileSystem.getInfoAsync` non garantisce `modificationTime` su ogni
 * piattaforma: quando manca, `info.modificationTime * 1000` vale `NaN`, la
 * scheda del file stampa "Invalid Date" e l'ordinamento per data diventa
 * arbitrario, perche' ogni confronto con `NaN` e' falso.
 *
 * Il primo ripiego e' il nome stesso: i file generati si chiamano
 * `<titolo>_<Date.now()>.<ext>`, quindi il timestamp e' li' dentro. Solo se
 * nemmeno quello c'e' si torna a 0, che almeno ordina in fondo invece di
 * disordinare tutto.
 */
function modifiedAtOf(modificationTime: number | undefined, filename: string): number {
  const fromFs = (modificationTime ?? NaN) * 1000;
  if (Number.isFinite(fromFs) && fromFs > 0) return fromFs;

  const stamp = filename.replace(/\.[^.]+$/, '').match(/_(\d{10,})$/);
  if (stamp) {
    const parsed = Number(stamp[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

export async function listGeneratedFiles(): Promise<GeneratedFile[]> {
  const dir = documentDirectoryOrThrow();
  const names = await FileSystem.readDirectoryAsync(dir);

  const files: GeneratedFile[] = [];
  for (const name of names) {
    const ext = extensionOf(name);
    const format = EXT_TO_FORMAT[ext];
    if (!format) continue;

    const uri = `${dir}${name}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) continue;

    files.push({
      uri,
      filename: name,
      displayName: toDisplayName(name),
      ext,
      format,
      mimeType: FORMAT_META[format].mimeType,
      size: info.size,
      modifiedAt: modifiedAtOf(info.modificationTime, name),
    });
  }

  files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return files;
}

// ─── Rinomina ─────────────────────────────────────────────────────────────────

/**
 * Rinomina un file mantenendone l'estensione: cambiarla renderebbe il
 * contenuto illeggibile all'app che lo apre.
 *
 * Se il nome scelto e' gia' occupato viene aggiunto un contatore invece di
 * sollevare un errore o, peggio, sovrascrivere un altro documento.
 */
export async function renameGeneratedFile(
  file: GeneratedFile,
  newName: string
): Promise<GeneratedFile> {
  const dir = documentDirectoryOrThrow();
  const safe = sanitizeFileName(newName);
  if (!safe) {
    throw new Error('Il nome del file non puo\' essere vuoto.');
  }

  // L'estensione si toglie solo se e' davvero quella del file. Applicare uno
  // stripExtension cieco al nome scelto dall'utente tagliava all'ultimo punto:
  // "Report v1.2" diventava "Report v1", in silenzio.
  const lower = safe.toLowerCase();
  const suffix = `.${file.ext.toLowerCase()}`;
  const base = lower.endsWith(suffix) ? safe.slice(0, safe.length - suffix.length) : safe;
  if (!base.trim()) {
    throw new Error('Il nome del file non puo\' essere vuoto.');
  }

  const desired = `${base}.${file.ext}`;
  // Nome identico a quello attuale: non c'e' niente da fare, e non e' un errore.
  if (desired === file.filename) return file;

  let candidate = desired;
  let counter = 2;
  while (candidate !== file.filename) {
    const info = await FileSystem.getInfoAsync(`${dir}${candidate}`);
    if (!info.exists) break;
    candidate = `${base}_${counter}.${file.ext}`;
    counter += 1;
  }

  if (candidate === file.filename) {
    // La numerazione e' tornata sul nome che il file ha gia': il nome chiesto e'
    // occupato da un altro file e non c'e' variante libera diversa da questa.
    // Va detto, invece di ricaricare la lista come se fosse cambiato qualcosa.
    throw new Error(`Esiste gia\' un file chiamato "${desired}".`);
  }

  const to = `${dir}${candidate}`;
  await FileSystem.moveAsync({ from: file.uri, to });

  return {
    ...file,
    uri: to,
    filename: candidate,
    displayName: toDisplayName(candidate),
  };
}

// ─── Eliminazione ─────────────────────────────────────────────────────────────

/**
 * Elimina il file. `idempotent` evita che un doppio tap sulla conferma
 * trasformi un'eliminazione riuscita in un errore.
 */
export async function deleteGeneratedFile(file: GeneratedFile): Promise<void> {
  await FileSystem.deleteAsync(file.uri, { idempotent: true });
}

// ─── Salvataggio fuori dall'app ───────────────────────────────────────────────

/**
 * Copia il file in una cartella del dispositivo scelta dall'utente.
 *
 * E' l'unico punto dell'app in cui compare una richiesta di accesso ai file, ed
 * e' quella corretta per Android 13+: lo Storage Access Framework mostra il
 * selettore di sistema e concede l'accesso alla sola cartella scelta. Annullare
 * il selettore e' un esito normale, non un errore.
 *
 * Nota implementativa: `createFileAsync` vuole il nome SENZA estensione — la
 * aggiunge lui a partire dal mimeType. Passargli "documento.pdf" produrrebbe
 * "documento.pdf.pdf".
 */
export async function saveToDevice(file: GeneratedFile): Promise<SaveToDeviceResult> {
  if (Platform.OS !== 'android') {
    return { status: 'unsupported' };
  }

  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) {
    return { status: 'cancelled' };
  }

  const content = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const nameWithoutExtension = stripExtension(file.filename);
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    nameWithoutExtension,
    file.mimeType
  );

  await FileSystem.writeAsStringAsync(targetUri, content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { status: 'saved', folderName: describeSafFolder(permission.directoryUri) };
}

// ─── Formattazione per la UI ──────────────────────────────────────────────────

/** Dimensione leggibile: 84 KB, 1,2 MB. Sotto il KB si mostra "< 1 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return '< 1 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
