/**
 * templates/index.ts — Registry dei 15 template documentali.
 *
 * Ogni template è un preset di struttura + stile applicato al DocumentModel,
 * NON una raccolta di temi estetici. Il template definisce: page setup,
 * stili (font, heading scale, margini), header/footer, numerazione pagine,
 * e uno scheletro di blocchi che il parser/comprensione riempie.
 */

import type {
  TemplatePreset,
  DocumentType,
  PageSetup,
  DocumentStyles,
  HeaderFooter,
  PageNumbering,
  BlockElement,
} from '../model';
import { text, paragraph, heading, pageBreak, horizontalRule } from '../model';

// ============================================================
// STILI CONDIVISI
// ============================================================

const SERIF = 'Georgia';
const SANS = 'Helvetica';
const MONO = 'Monospace';

/** Margini standard A4 (pt) */
const MARGINS_STANDARD = { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 };

/** Footer standard con numerazione pagina */
function standardFooter(company = 'Milo Office'): HeaderFooter {
  return {
    blocks: [
      paragraph(
        [text(company, { size: 8, color: '9CA3AF' })],
        { alignment: 'center', spaceAfter: 2 }
      ),
    ],
  };
}

function standardPageNumbering(): PageNumbering {
  return {
    format: 'decimal',
    prefix: 'Pag. ',
    position: 'footer',
    alignment: 'center',
    showOnFirstPage: true,
    font: { family: SANS, size: 8, color: '9CA3AF' },
  };
}

/** Heading scale per documenti formali */
function formalHeadingStyles(): DocumentStyles['paragraphStyles'] {
  return {
    heading1: { spaceBefore: 24, spaceAfter: 12, keepWithNext: true, lineSpacing: 1.2 },
    heading2: { spaceBefore: 18, spaceAfter: 8, keepWithNext: true, lineSpacing: 1.2 },
    heading3: { spaceBefore: 12, spaceAfter: 6, keepWithNext: true, lineSpacing: 1.2 },
    body: { spaceAfter: 6, lineSpacing: 1.15, alignment: 'justify' },
    caption: { spaceBefore: 4, spaceAfter: 8, alignment: 'center', lineSpacing: 1.1 },
    footer: { alignment: 'center', lineSpacing: 1.0, spaceBefore: 12 },
    signature: { spaceBefore: 36, spaceAfter: 12, alignment: 'left' },
  };
}

// ============================================================
// DEFINIZIONE TEMPLATE
// ============================================================

const templates: Record<DocumentType, TemplatePreset> = {
  // ── REPORT AZIENDALE ────────────────────────────────────────────────
  report: {
    type: 'report',
    label: 'Report aziendale',
    description: 'Relazione strutturata con copertina, sintesi, sezioni e conclusioni.',
    icon: 'bar-chart-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 6, lineSpacing: 1.15 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: {
        strong: { bold: true },
        emphasis: { italic: true },
        hyperlink: { color: '0066CC', underline: true },
      },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
          alternateRowColors: ['FFFFFF', 'FAFAFA'],
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Titolo del report')], { alignment: 'center' }),
      paragraph([text('Sottotitolo / periodo di riferimento')], { alignment: 'center', spaceAfter: 24 }),
      horizontalRule(),
      heading(2, [text('Sintesi')]),
      paragraph([text('Sintesi esecutiva del report.')]),
      heading(2, [text('Introduzione')]),
      paragraph([text('Contesto e obiettivi.')]),
      heading(2, [text('Analisi')]),
      paragraph([text('Sezione principale con dati e tabelle.')]),
      heading(2, [text('Conclusioni')]),
      paragraph([text('Conclusioni e raccomandazioni.')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'subtitle', label: 'Sottotitolo', type: 'text' },
      { key: 'summary', label: 'Sintesi', type: 'textarea' },
      { key: 'sections', label: 'Sezioni', type: 'table' },
    ],
    optionalFields: [
      { key: 'author', label: 'Autore', type: 'text' },
      { key: 'date', label: 'Data', type: 'date' },
    ],
  },

  // ── FATTURA ─────────────────────────────────────────────────────────
  invoice: {
    type: 'invoice',
    label: 'Fattura',
    description: 'Documento fiscale con dati azienda, cliente, righe e totali.',
    icon: 'receipt-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 60, right: 60, bottom: 60, left: 60, header: 30, footer: 30 },
    },
    styles: {
      defaultFont: { family: SANS, size: 10, color: '222222' },
      defaultParagraph: { alignment: 'left', spaceAfter: 4, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: {
        strong: { bold: true },
        emphasis: { italic: true },
      },
      tableStyles: {
        invoice: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'E5E7EB' },
          cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
          headerColor: 'F5F5F5',
          footerColor: 'E6F4FE',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('FATTURA')], { alignment: 'center' }),
      paragraph([text('N°: ', { bold: true }), text('—'), text('   Data: ', { bold: true }), text('—')], { alignment: 'center' }),
      paragraph([text('Emittente: ', { bold: true }), text('—')]),
      paragraph([text('Cliente: ', { bold: true }), text('—')]),
      heading(2, [text('Voci')]),
      paragraph([text('(tabella righe)')]),
      paragraph([text('TOTALE: ', { bold: true, size: 14 }), text('—', { bold: true, size: 14 })], { alignment: 'right' }),
    ],
    requiredFields: [
      { key: 'number', label: 'Numero fattura', type: 'text', validation: { required: true } },
      { key: 'date', label: 'Data', type: 'date', validation: { required: true } },
      { key: 'issuer', label: 'Emittente', type: 'text', validation: { required: true } },
      { key: 'client', label: 'Cliente', type: 'text', validation: { required: true } },
      { key: 'lineItems', label: 'Righe', type: 'table', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'vatRate', label: 'Aliquota IVA', type: 'number' },
      { key: 'notes', label: 'Note', type: 'textarea' },
      { key: 'dueDate', label: 'Scadenza', type: 'date' },
    ],
  },

  // ── PREVENTIVO ──────────────────────────────────────────────────────
  quote: {
    type: 'quote',
    label: 'Preventivo',
    description: 'Offerta commerciale con voci, prezzi e validità.',
    icon: 'pricetag-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 60, right: 60, bottom: 60, left: 60, header: 30, footer: 30 },
    },
    styles: {
      defaultFont: { family: SANS, size: 10, color: '222222' },
      defaultParagraph: { alignment: 'left', spaceAfter: 4, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {
        invoice: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'E5E7EB' },
          cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
          headerColor: 'F5F5F5',
          footerColor: 'E6F4FE',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('PREVENTIVO')], { alignment: 'center' }),
      paragraph([text('N°: ', { bold: true }), text('—'), text('   Valido fino al: ', { bold: true }), text('—')], { alignment: 'center' }),
      paragraph([text('Cliente: ', { bold: true }), text('—')]),
      heading(2, [text('Voci')]),
      paragraph([text('(tabella righe)')]),
      paragraph([text('TOTALE: ', { bold: true, size: 14 }), text('—', { bold: true, size: 14 })], { alignment: 'right' }),
    ],
    requiredFields: [
      { key: 'number', label: 'Numero preventivo', type: 'text', validation: { required: true } },
      { key: 'client', label: 'Cliente', type: 'text', validation: { required: true } },
      { key: 'lineItems', label: 'Righe', type: 'table', validation: { required: true } },
      { key: 'validUntil', label: 'Valido fino al', type: 'date', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },

  // ── CURRICULUM ──────────────────────────────────────────────────────
  cv: {
    type: 'cv',
    label: 'Curriculum',
    description: 'CV con dati personali, profilo, esperienza, formazione e competenze.',
    icon: 'person-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 60, right: 60, bottom: 60, left: 60, header: 30, footer: 30 },
    },
    styles: {
      defaultFont: { family: SANS, size: 10.5, color: '11181C' },
      defaultParagraph: { alignment: 'left', spaceAfter: 4, lineSpacing: 1.25 },
      paragraphStyles: {
        heading1: { spaceBefore: 0, spaceAfter: 4, keepWithNext: true, lineSpacing: 1.1 },
        heading2: { spaceBefore: 14, spaceAfter: 6, keepWithNext: true, lineSpacing: 1.15 },
        heading3: { spaceBefore: 10, spaceAfter: 4, keepWithNext: true, lineSpacing: 1.15 },
        body: { spaceAfter: 4, lineSpacing: 1.25 },
        caption: { spaceBefore: 4, spaceAfter: 8, alignment: 'center' },
        footer: { alignment: 'center', lineSpacing: 1.0 },
        signature: { spaceBefore: 24, spaceAfter: 12 },
      },
      characterStyles: {
        strong: { bold: true },
        emphasis: { italic: true },
        hyperlink: { color: '0066CC', underline: true },
      },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'none', width: 0 },
          cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Nome Cognome')], { alignment: 'center' }),
      paragraph([text('Ruolo professionale')], { alignment: 'center', spaceAfter: 8 }),
      paragraph([text('Email · Telefono · Città')], { alignment: 'center', spaceAfter: 16 }),
      heading(2, [text('Profilo')]),
      paragraph([text('Breve profilo professionale.')]),
      heading(2, [text('Esperienza')]),
      paragraph([text('(elenco esperienze)')]),
      heading(2, [text('Formazione')]),
      paragraph([text('(elenco titoli di studio)')]),
      heading(2, [text('Competenze')]),
      paragraph([text('(elenco competenze)')]),
      heading(2, [text('Lingue')]),
      paragraph([text('(elenco lingue)')]),
    ],
    requiredFields: [
      { key: 'name', label: 'Nome e cognome', type: 'text', validation: { required: true } },
      { key: 'role', label: 'Ruolo', type: 'text' },
      { key: 'contact', label: 'Contatti', type: 'text' },
      { key: 'profile', label: 'Profilo', type: 'textarea' },
      { key: 'experience', label: 'Esperienza', type: 'table' },
      { key: 'education', label: 'Formazione', type: 'table' },
      { key: 'skills', label: 'Competenze', type: 'multiselect' },
    ],
    optionalFields: [
      { key: 'languages', label: 'Lingue', type: 'table' },
      { key: 'certifications', label: 'Certificazioni', type: 'table' },
      { key: 'photo', label: 'Foto', type: 'image' },
    ],
  },

  // ── LETTERA DI PRESENTAZIONE ────────────────────────────────────────
  coverLetter: {
    type: 'coverLetter',
    label: 'Lettera di presentazione',
    description: 'Lettera formale di candidatura.',
    icon: 'mail-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 },
    },
    styles: {
      defaultFont: { family: SERIF, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 8, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {},
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      paragraph([text('Mittente', { bold: true })]),
      paragraph([text('Indirizzo mittente')]),
      paragraph([text('Destinatario', { bold: true })], { spaceBefore: 16 }),
      paragraph([text('Indirizzo destinatario')]),
      paragraph([text('Luogo, data')], { alignment: 'right', spaceBefore: 16 }),
      paragraph([text('Oggetto: ', { bold: true }), text('—')], { spaceBefore: 16 }),
      paragraph([text('Corpo della lettera.')], { spaceBefore: 8 }),
      paragraph([text('Distinti saluti,')], { spaceBefore: 24 }),
      paragraph([text('Firma')], { spaceBefore: 24 }),
    ],
    requiredFields: [
      { key: 'sender', label: 'Mittente', type: 'text', validation: { required: true } },
      { key: 'recipient', label: 'Destinatario', type: 'text', validation: { required: true } },
      { key: 'subject', label: 'Oggetto', type: 'text', validation: { required: true } },
      { key: 'body', label: 'Corpo', type: 'textarea', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'date', label: 'Data', type: 'date' },
      { key: 'place', label: 'Luogo', type: 'text' },
    ],
  },

  // ── LETTERA COMMERCIALE ─────────────────────────────────────────────
  businessLetter: {
    type: 'businessLetter',
    label: 'Lettera commerciale',
    description: 'Comunicazione commerciale formale.',
    icon: 'briefcase-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 },
    },
    styles: {
      defaultFont: { family: SERIF, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 8, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {},
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      paragraph([text('Mittente', { bold: true })]),
      paragraph([text('Destinatario', { bold: true })], { spaceBefore: 16 }),
      paragraph([text('Luogo, data')], { alignment: 'right', spaceBefore: 16 }),
      paragraph([text('Oggetto: ', { bold: true }), text('—')], { spaceBefore: 16 }),
      paragraph([text('Corpo della lettera.')], { spaceBefore: 8 }),
      paragraph([text('Cordiali saluti,')], { spaceBefore: 24 }),
      paragraph([text('Firma')], { spaceBefore: 24 }),
    ],
    requiredFields: [
      { key: 'sender', label: 'Mittente', type: 'text', validation: { required: true } },
      { key: 'recipient', label: 'Destinatario', type: 'text', validation: { required: true } },
      { key: 'subject', label: 'Oggetto', type: 'text', validation: { required: true } },
      { key: 'body', label: 'Corpo', type: 'textarea', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'date', label: 'Data', type: 'date' },
      { key: 'place', label: 'Luogo', type: 'text' },
    ],
  },

  // ── VERBALE DI RIUNIONE ─────────────────────────────────────────────
  meetingMinutes: {
    type: 'meetingMinutes',
    label: 'Verbale di riunione',
    description: 'Verbale con partecipanti, ordine del giorno e decisioni.',
    icon: 'people-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 6, lineSpacing: 1.15 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Verbale di riunione')], { alignment: 'center' }),
      paragraph([text('Data: ', { bold: true }), text('—'), text('   Luogo: ', { bold: true }), text('—')], { alignment: 'center' }),
      heading(2, [text('Partecipanti')]),
      paragraph([text('(elenco partecipanti)')]),
      heading(2, [text('Ordine del giorno')]),
      paragraph([text('(punti all\'ordine del giorno)')]),
      heading(2, [text('Discussione')]),
      paragraph([text('(resoconto)')]),
      heading(2, [text('Decisioni')]),
      paragraph([text('(decisioni prese)')]),
      heading(2, [text('Azioni')]),
      paragraph([text('(azioni da intraprendere)')]),
    ],
    requiredFields: [
      { key: 'date', label: 'Data', type: 'date', validation: { required: true } },
      { key: 'place', label: 'Luogo', type: 'text' },
      { key: 'attendees', label: 'Partecipanti', type: 'table', validation: { required: true } },
      { key: 'agenda', label: 'Ordine del giorno', type: 'table' },
      { key: 'decisions', label: 'Decisioni', type: 'table' },
    ],
    optionalFields: [
      { key: 'actions', label: 'Azioni', type: 'table' },
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },

  // ── PROPOSTA PROGETTUALE ────────────────────────────────────────────
  proposal: {
    type: 'proposal',
    label: 'Proposta progettuale',
    description: 'Proposta di progetto con obiettivi, fasi e costi.',
    icon: 'git-branch-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 6, lineSpacing: 1.15 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
          alternateRowColors: ['FFFFFF', 'FAFAFA'],
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Proposta progettuale')], { alignment: 'center' }),
      paragraph([text('Sottotitolo')], { alignment: 'center', spaceAfter: 24 }),
      heading(2, [text('Obiettivi')]),
      paragraph([text('Obiettivi del progetto.')]),
      heading(2, [text('Ambito')]),
      paragraph([text('Ambito e confini.')]),
      heading(2, [text('Fasi e tempistiche')]),
      paragraph([text('(tabella fasi)')]),
      heading(2, [text('Costi')]),
      paragraph([text('(tabella costi)')]),
      heading(2, [text('Conclusioni')]),
      paragraph([text('Conclusioni.')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'objectives', label: 'Obiettivi', type: 'textarea', validation: { required: true } },
      { key: 'phases', label: 'Fasi', type: 'table' },
      { key: 'costs', label: 'Costi', type: 'table' },
    ],
    optionalFields: [
      { key: 'scope', label: 'Ambito', type: 'textarea' },
      { key: 'conclusion', label: 'Conclusioni', type: 'textarea' },
    ],
  },

  // ── CONTRATTO ───────────────────────────────────────────────────────
  contract: {
    type: 'contract',
    label: 'Documento contrattuale',
    description: 'Contratto con parti, clausole e firme.',
    icon: 'document-lock-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 },
    },
    styles: {
      defaultFont: { family: SERIF, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 8, lineSpacing: 1.4 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {},
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('CONTRATTO')], { alignment: 'center' }),
      paragraph([text('Tra: ', { bold: true }), text('—')]),
      paragraph([text('E: ', { bold: true }), text('—')], { spaceBefore: 8 }),
      heading(2, [text('Premesse')]),
      paragraph([text('Premesse del contratto.')]),
      heading(2, [text('Oggetto')]),
      paragraph([text('Oggetto del contratto.')]),
      heading(2, [text('Clausole')]),
      paragraph([text('(clausole numerate)')]),
      heading(2, [text('Durata')]),
      paragraph([text('Durata e termini.')]),
      heading(2, [text('Firme')]),
      paragraph([text('(sezioni firma)')]),
    ],
    requiredFields: [
      { key: 'partyA', label: 'Parte A', type: 'text', validation: { required: true } },
      { key: 'partyB', label: 'Parte B', type: 'text', validation: { required: true } },
      { key: 'object', label: 'Oggetto', type: 'textarea', validation: { required: true } },
      { key: 'clauses', label: 'Clausole', type: 'table', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'premises', label: 'Premesse', type: 'textarea' },
      { key: 'duration', label: 'Durata', type: 'text' },
      { key: 'signatures', label: 'Firme', type: 'table' },
    ],
  },

  // ── RELAZIONE PROFESSIONALE ─────────────────────────────────────────
  professionalReport: {
    type: 'professionalReport',
    label: 'Relazione professionale',
    description: 'Relazione tecnica con copertina, sintesi e appendici.',
    icon: 'document-text-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 6, lineSpacing: 1.15 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true }, hyperlink: { color: '0066CC', underline: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
          alternateRowColors: ['FFFFFF', 'FAFAFA'],
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Relazione professionale')], { alignment: 'center' }),
      paragraph([text('Sottotitolo')], { alignment: 'center', spaceAfter: 24 }),
      heading(2, [text('Sintesi')]),
      paragraph([text('Sintesi.')]),
      heading(2, [text('Introduzione')]),
      paragraph([text('Introduzione.')]),
      heading(2, [text('Sezioni principali')]),
      paragraph([text('(sezioni)')]),
      heading(2, [text('Conclusioni')]),
      paragraph([text('Conclusioni.')]),
      heading(2, [text('Raccomandazioni')]),
      paragraph([text('Raccomandazioni.')]),
      heading(2, [text('Appendici')]),
      paragraph([text('(appendici)')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'summary', label: 'Sintesi', type: 'textarea' },
      { key: 'sections', label: 'Sezioni', type: 'table' },
    ],
    optionalFields: [
      { key: 'recommendations', label: 'Raccomandazioni', type: 'textarea' },
      { key: 'appendices', label: 'Appendici', type: 'table' },
    ],
  },

  // ── DOCUMENTO SEMPLICE ──────────────────────────────────────────────
  simple: {
    type: 'simple',
    label: 'Documento semplice',
    description: 'Documento generico con titolo e testo libero.',
    icon: 'document-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 6, lineSpacing: 1.15 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Titolo')], { alignment: 'center' }),
      paragraph([text('Contenuto del documento.')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'body', label: 'Contenuto', type: 'textarea', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'subtitle', label: 'Sottotitolo', type: 'text' },
    ],
  },

  // ── DOCUMENTO ACCADEMICO ────────────────────────────────────────────
  academic: {
    type: 'academic',
    label: 'Documento accademico',
    description: 'Paper con abstract, sezioni, riferimenti e bibliografia.',
    icon: 'school-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 90, header: 36, footer: 36 },
    },
    styles: {
      defaultFont: { family: SERIF, size: 12, color: '11181C' },
      defaultParagraph: { alignment: 'justify', spaceAfter: 8, lineSpacing: 1.5 },
      paragraphStyles: {
        heading1: { spaceBefore: 24, spaceAfter: 12, keepWithNext: true, lineSpacing: 1.2 },
        heading2: { spaceBefore: 18, spaceAfter: 8, keepWithNext: true, lineSpacing: 1.2 },
        heading3: { spaceBefore: 12, spaceAfter: 6, keepWithNext: true, lineSpacing: 1.2 },
        body: { spaceAfter: 8, lineSpacing: 1.5, alignment: 'justify' },
        caption: { spaceBefore: 4, spaceAfter: 8, alignment: 'center' },
        footer: { alignment: 'center', lineSpacing: 1.0 },
        signature: { spaceBefore: 24, spaceAfter: 12 },
      },
      characterStyles: { strong: { bold: true }, emphasis: { italic: true }, hyperlink: { color: '0066CC', underline: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Titolo del paper')], { alignment: 'center' }),
      paragraph([text('Autore · Istituzione')], { alignment: 'center', spaceAfter: 16 }),
      heading(2, [text('Abstract')]),
      paragraph([text('Abstract.')]),
      heading(2, [text('Introduzione')]),
      paragraph([text('Introduzione.')]),
      heading(2, [text('Metodologia')]),
      paragraph([text('Metodologia.')]),
      heading(2, [text('Risultati')]),
      paragraph([text('Risultati.')]),
      heading(2, [text('Conclusioni')]),
      paragraph([text('Conclusioni.')]),
      heading(2, [text('Bibliografia')]),
      paragraph([text('(riferimenti)')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'author', label: 'Autore', type: 'text', validation: { required: true } },
      { key: 'abstract', label: 'Abstract', type: 'textarea', validation: { required: true } },
      { key: 'sections', label: 'Sezioni', type: 'table' },
    ],
    optionalFields: [
      { key: 'institution', label: 'Istituzione', type: 'text' },
      { key: 'references', label: 'Bibliografia', type: 'table' },
    ],
  },

  // ── CHECKLIST ───────────────────────────────────────────────────────
  checklist: {
    type: 'checklist',
    label: 'Checklist',
    description: 'Elenco di attività spuntabili.',
    icon: 'checkbox-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'left', spaceAfter: 4, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {},
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Checklist')], { alignment: 'center' }),
      paragraph([text('(elenco attività spuntabili)')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'items', label: 'Attività', type: 'table', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },

  // ── NOTE ────────────────────────────────────────────────────────────
  notes: {
    type: 'notes',
    label: 'Note',
    description: 'Appunti liberi con titolo e testo.',
    icon: 'create-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: MARGINS_STANDARD,
    },
    styles: {
      defaultFont: { family: SANS, size: 11, color: '11181C' },
      defaultParagraph: { alignment: 'left', spaceAfter: 6, lineSpacing: 1.3 },
      paragraphStyles: formalHeadingStyles(),
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {},
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Note')], { alignment: 'center' }),
      paragraph([text('Appunti.')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'body', label: 'Contenuto', type: 'textarea', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'date', label: 'Data', type: 'date' },
    ],
  },

  // ── STAMPA PRESENTAZIONE ────────────────────────────────────────────
  presentationPrint: {
    type: 'presentationPrint',
    label: 'Stampa presentazione',
    description: 'Slide stampabili in formato documento.',
    icon: 'easel-outline',
    pageSetup: {
      size: 'A4',
      orientation: 'landscape',
      margins: { top: 40, right: 40, bottom: 40, left: 40, header: 20, footer: 20 },
    },
    styles: {
      defaultFont: { family: SANS, size: 14, color: '11181C' },
      defaultParagraph: { alignment: 'left', spaceAfter: 8, lineSpacing: 1.2 },
      paragraphStyles: {
        heading1: { spaceBefore: 0, spaceAfter: 12, keepWithNext: true, lineSpacing: 1.1 },
        heading2: { spaceBefore: 12, spaceAfter: 8, keepWithNext: true, lineSpacing: 1.1 },
        heading3: { spaceBefore: 8, spaceAfter: 6, keepWithNext: true, lineSpacing: 1.1 },
        body: { spaceAfter: 8, lineSpacing: 1.2 },
        caption: { spaceBefore: 4, spaceAfter: 8, alignment: 'center' },
        footer: { alignment: 'center', lineSpacing: 1.0 },
        signature: { spaceBefore: 24, spaceAfter: 12 },
      },
      characterStyles: { strong: { bold: true }, emphasis: { italic: true } },
      tableStyles: {
        default: {
          width: '100%',
          cellBorder: { style: 'single', width: 0.5, color: 'CCCCCC' },
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          headerColor: 'F4F4F5',
        },
      },
    },
    header: undefined,
    footer: standardFooter(),
    pageNumbering: standardPageNumbering(),
    skeleton: [
      heading(1, [text('Titolo presentazione')], { alignment: 'center' }),
      pageBreak(),
      heading(2, [text('Slide 1')]),
      paragraph([text('Contenuto slide.')]),
      pageBreak(),
      heading(2, [text('Slide 2')]),
      paragraph([text('Contenuto slide.')]),
    ],
    requiredFields: [
      { key: 'title', label: 'Titolo', type: 'text', validation: { required: true } },
      { key: 'slides', label: 'Slide', type: 'table', validation: { required: true } },
    ],
    optionalFields: [
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },
};

// ============================================================
// API PUBBLICA
// ============================================================

/** Elenco ordinato dei tipi documento (per UI) */
export const DOCUMENT_TYPES: DocumentType[] = [
  'report',
  'invoice',
  'quote',
  'cv',
  'coverLetter',
  'businessLetter',
  'meetingMinutes',
  'proposal',
  'contract',
  'professionalReport',
  'simple',
  'academic',
  'checklist',
  'notes',
  'presentationPrint',
];

/** Recupera un template per tipo */
export function getTemplate(type: DocumentType): TemplatePreset {
  return templates[type];
}

/** Recupera tutti i template */
export function getAllTemplates(): TemplatePreset[] {
  return DOCUMENT_TYPES.map((t) => templates[t]);
}

/** Verifica che un tipo sia valido */
export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && value in templates;
}

/** Normalizza un valore arbitrario in un DocumentType (fallback 'simple') */
export function parseDocumentType(value: unknown, fallback: DocumentType = 'simple'): DocumentType {
  return isDocumentType(value) ? value : fallback;
}

/** Applica il preset di un template a un DocumentModel parziale */
export function applyTemplate(
  type: DocumentType,
  model: Partial<import('../model').DocumentModel>
): import('../model').DocumentModel {
  const tpl = templates[type];
  return {
    metadata: {
      title: model.metadata?.title ?? tpl.label,
      creator: 'Milo Office',
      company: 'Milo Office',
      language: 'it-IT',
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...model.metadata,
    },
    pageSetup: {
      ...(model.pageSetup ?? {}),
      ...tpl.pageSetup,
    } as import('../model').PageSetup,
    header: model.header ?? tpl.header,
    footer: model.footer ?? tpl.footer,
    pageNumbering: model.pageNumbering ?? tpl.pageNumbering,
    blocks: model.blocks ?? tpl.skeleton,
    styles: {
      ...tpl.styles,
      ...(model.styles ?? {}),
    },
    formatOptions: model.formatOptions,
  };
}