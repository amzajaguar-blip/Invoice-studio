/**
 * builders/txt.ts — Builder TXT (testo semplice UTF-8) dal DocumentModel.
 *
 * Output minimale: solo testo leggibile, senza formattazione.
 * Utile per compatibilità, lettori schermo, diff, versioning.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentModel } from '../model';
import { inlineToText, documentToText, safeName } from './shared';

export interface TxtBuildResult {
  filepath: string;
  filename: string;
}

/**
 * Genera un file TXT (UTF-8) dal DocumentModel.
 * Nessuna formattazione, solo testo piatto con separatori leggibili.
 */
export async function buildTxt(model: DocumentModel): Promise<TxtBuildResult> {
  const lines: string[] = [];

  // Metadati
  lines.push(model.metadata.title.toUpperCase());
  if (model.metadata.subtitle) lines.push(model.metadata.subtitle);
  lines.push('');

  if (model.metadata.author) lines.push(`Autore: ${model.metadata.author}`);
  if (model.metadata.company) lines.push(`Azienda: ${model.metadata.company}`);
  if (model.metadata.createdAt) lines.push(`Creato: ${model.metadata.createdAt.toLocaleDateString('it-IT')}`);
  lines.push('');

  // Contenuto
  const body = documentToText(model);
  lines.push(body);

  // Footer
  lines.push('');
  lines.push(`---`);
  lines.push(`Generato da ${model.metadata.creator ?? 'Milo Office'}`);

  const content = lines.join('\n');
  const filename = `${safeName(model.metadata.title)}_${Date.now()}.txt`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filepath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { filepath, filename };
}

/** Genera il contenuto TXT come stringa (per test/anteprima). */
export function buildTxtString(model: DocumentModel): string {
  const lines: string[] = [];
  lines.push(model.metadata.title.toUpperCase());
  if (model.metadata.subtitle) lines.push(model.metadata.subtitle);
  lines.push('');
  if (model.metadata.author) lines.push(`Autore: ${model.metadata.author}`);
  if (model.metadata.company) lines.push(`Azienda: ${model.metadata.company}`);
  if (model.metadata.createdAt) lines.push(`Creato: ${model.metadata.createdAt.toLocaleDateString('it-IT')}`);
  lines.push('');
  lines.push(documentToText(model));
  lines.push('');
  lines.push('---');
  lines.push(`Generato da ${model.metadata.creator ?? 'Milo Office'}`);
  return lines.join('\n');
}