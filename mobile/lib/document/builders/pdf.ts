/**
 * builders/pdf.ts — Builder PDF dal DocumentModel.
 *
 * Usa expo-print (Print.printToFileAsync) sull'HTML prodotto da builders/html.ts.
 * Produce un PDF reale con pagine, margini, impaginazione e gestione overflow.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import type { DocumentModel } from '../model';
import { buildHtml } from './html';
import { safeName } from './shared';

export interface PdfBuildResult {
  filepath: string;
  filename: string;
}

/**
 * Genera un PDF reale dal DocumentModel.
 * Magic bytes: 25 50 44 46 (%PDF).
 */
export async function buildPdf(model: DocumentModel): Promise<PdfBuildResult> {
  const html = buildHtml(model, { forPrint: true, pageTitle: model.metadata.title });

  let sourceUri: string;
  try {
    const printed = await Print.printToFileAsync({ html });
    sourceUri = printed.uri;
  } catch (err) {
    throw new Error(`PDF generation failed: ${String(err)}`);
  }

  const filename = `${safeName(model.metadata.title)}_${Date.now()}.pdf`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: sourceUri, to: filepath });

  return { filepath, filename };
}

/** Genera l'HTML sorgente del PDF (per test/anteprima senza scrivere file). */
export function buildPdfHtml(model: DocumentModel): string {
  return buildHtml(model, { forPrint: true, pageTitle: model.metadata.title });
}