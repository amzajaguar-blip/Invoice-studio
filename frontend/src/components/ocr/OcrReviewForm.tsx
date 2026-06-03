"use client";

import { useState } from "react";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  XCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OcrExtractedFields {
  supplierName: string | null;
  vatNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  taxableAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string;
  rawText: string;
}

interface OcrConfidenceScores {
  supplierName: number;
  vatNumber: number;
  invoiceNumber: number;
  invoiceDate: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  overall: number;
}

interface OcrReviewFormProps {
  imageBase64: string;
  fileName: string;
  fields: OcrExtractedFields;
  confidence: OcrConfidenceScores;
  onConfirm: (correctedFields: OcrExtractedFields) => void;
  onSkip: () => void;
  isConfirming: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

type ConfidenceTier = "high" | "medium" | "low";

function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function getFieldContainerClass(tier: ConfidenceTier, isEmpty: boolean): string {
  if (tier === "high" && !isEmpty) {
    return "bg-green-500/10 border border-green-500/30";
  }
  if (tier === "medium" && !isEmpty) {
    return "bg-yellow-500/10 border border-yellow-500/30";
  }
  // low confidence OR empty field
  return "border border-red-500/50";
}

function getConfidenceBadgeClass(tier: ConfidenceTier): string {
  if (tier === "high") return "text-green-400 bg-green-500/15";
  if (tier === "medium") return "text-yellow-400 bg-yellow-500/15";
  return "text-red-400 bg-red-500/15";
}

function formatNumberValue(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseNumberValue(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF"] as const;

function isPdf(fileName: string): boolean {
  return /\.pdf$/i.test(fileName);
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * OCR Review & Correction Form.
 * Two-column layout: document preview on the left, editable fields on the right.
 * Each field shows a color-coded confidence indicator.
 */
export function OcrReviewForm({
  imageBase64,
  fileName,
  fields,
  confidence,
  onConfirm,
  onSkip,
  isConfirming,
}: OcrReviewFormProps) {
  const [supplierName, setSupplierName] = useState<string>(
    fields.supplierName ?? ""
  );
  const [vatNumber, setVatNumber] = useState<string>(fields.vatNumber ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    fields.invoiceNumber ?? ""
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    fields.invoiceDate ?? ""
  );
  const [taxableAmount, setTaxableAmount] = useState<string>(
    formatNumberValue(fields.taxableAmount)
  );
  const [vatAmount, setVatAmount] = useState<string>(
    formatNumberValue(fields.vatAmount)
  );
  const [totalAmount, setTotalAmount] = useState<string>(
    formatNumberValue(fields.totalAmount)
  );
  const [currency, setCurrency] = useState<string>(fields.currency ?? "EUR");

  const pdfFile = isPdf(fileName);

  // ─── Build field descriptors ──────────────────────────────────────────────────

  interface FieldDescriptor {
    key: keyof OcrConfidenceScores;
    label: string;
    value: string;
    tier: ConfidenceTier;
    isEmpty: boolean;
    type: "text" | "number" | "date" | "select";
    onChange: (v: string) => void;
    options?: readonly string[];
  }

  const fieldDescriptors: FieldDescriptor[] = [
    {
      key: "supplierName",
      label: "Nome Fornitore",
      value: supplierName,
      tier: getConfidenceTier(confidence.supplierName),
      isEmpty: supplierName.trim() === "",
      type: "text",
      onChange: setSupplierName,
    },
    {
      key: "vatNumber",
      label: "Partita IVA",
      value: vatNumber,
      tier: getConfidenceTier(confidence.vatNumber),
      isEmpty: vatNumber.trim() === "",
      type: "text",
      onChange: setVatNumber,
    },
    {
      key: "invoiceNumber",
      label: "Numero Fattura",
      value: invoiceNumber,
      tier: getConfidenceTier(confidence.invoiceNumber),
      isEmpty: invoiceNumber.trim() === "",
      type: "text",
      onChange: setInvoiceNumber,
    },
    {
      key: "invoiceDate",
      label: "Data Fattura",
      value: invoiceDate,
      tier: getConfidenceTier(confidence.invoiceDate),
      isEmpty: invoiceDate.trim() === "",
      type: "date",
      onChange: setInvoiceDate,
    },
    {
      key: "taxableAmount",
      label: "Imponibile",
      value: taxableAmount,
      tier: getConfidenceTier(confidence.taxableAmount),
      isEmpty: taxableAmount.trim() === "",
      type: "number",
      onChange: setTaxableAmount,
    },
    {
      key: "vatAmount",
      label: "IVA",
      value: vatAmount,
      tier: getConfidenceTier(confidence.vatAmount),
      isEmpty: vatAmount.trim() === "",
      type: "number",
      onChange: setVatAmount,
    },
    {
      key: "totalAmount",
      label: "Totale",
      value: totalAmount,
      tier: getConfidenceTier(confidence.totalAmount),
      isEmpty: totalAmount.trim() === "",
      type: "number",
      onChange: setTotalAmount,
    },
    {
      key: "totalAmount",
      label: "Valuta",
      value: currency,
      tier: "high", // currency is a select, not scored — treat as high
      isEmpty: false,
      type: "select",
      onChange: setCurrency,
      options: CURRENCY_OPTIONS,
    },
  ];

  // ─── Submit ────────────────────────────────────────────────────────────────────

  function handleConfirm() {
    const correctedFields: OcrExtractedFields = {
      supplierName: supplierName.trim() || null,
      vatNumber: vatNumber.trim() || null,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate || null,
      taxableAmount: parseNumberValue(taxableAmount),
      vatAmount: parseNumberValue(vatAmount),
      totalAmount: parseNumberValue(totalAmount),
      currency,
      rawText: fields.rawText,
    };
    onConfirm(correctedFields);
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Overall confidence banner */}
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-4 mb-4 flex items-center gap-3">
        {getConfidenceTier(confidence.overall) === "high" && (
          <>
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#f0f0f2]">
                Rilevamento OCR: Affidabilità alta
              </p>
              <p className="text-xs text-[#6b7280]">
                Confidenza complessiva: {Math.round(confidence.overall)}%
              </p>
            </div>
          </>
        )}
        {getConfidenceTier(confidence.overall) === "medium" && (
          <>
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#f0f0f2]">
                Rilevamento OCR: Affidabilità media
              </p>
              <p className="text-xs text-[#6b7280]">
                Confidenza complessiva: {Math.round(confidence.overall)}%
              </p>
            </div>
          </>
        )}
        {getConfidenceTier(confidence.overall) === "low" && (
          <>
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#f0f0f2]">
                Rilevamento OCR: Affidabilità bassa
              </p>
              <p className="text-xs text-[#6b7280]">
                Confidenza complessiva: {Math.round(confidence.overall)}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Document preview */}
        <div>
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#f0f0f2] font-[Georgia,serif] mb-3">
              Documento Originale
            </h3>
            {pdfFile ? (
              <div className="flex flex-col items-center justify-center py-20 bg-[#0d0e13] rounded-lg border border-[#1e2029]">
                <FileText className="w-20 h-20 text-[#6c63ff] mb-4" />
                <p className="text-[#f0f0f2] font-semibold text-sm mb-1">
                  Documento PDF
                </p>
                <p className="text-[#6b7280] text-xs text-center px-4 break-all">
                  {fileName}
                </p>
              </div>
            ) : (
              <div className="bg-[#0d0e13] rounded-lg overflow-hidden border border-[#1e2029]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageBase64}
                  alt={fileName}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
            )}
            <p className="text-xs text-[#4b5563] mt-2 truncate">{fileName}</p>
          </div>
        </div>

        {/* Right column: Editable fields */}
        <div>
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f0f0f2] font-[Georgia,serif] mb-4">
              Verifica e Correggi i Dati
            </h3>

            <div className="space-y-3">
              {fieldDescriptors.map((fd) => {
                const score =
                  fd.type !== "select"
                    ? confidence[fd.key as keyof OcrConfidenceScores]
                    : null;
                const isSelect = fd.type === "select";

                return (
                  <div key={fd.label}>
                    {/* Label row */}
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                        {fd.label}
                      </label>
                      {score !== null && fd.tier === "high" && !fd.isEmpty && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getConfidenceBadgeClass(fd.tier)}`}
                        >
                          <CheckCircle className="w-2.5 h-2.5" />
                          {Math.round(score)}%
                        </span>
                      )}
                      {score !== null && fd.tier === "medium" && !fd.isEmpty && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getConfidenceBadgeClass(fd.tier)}`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {Math.round(score)}%
                        </span>
                      )}
                      {score !== null && (fd.tier === "low" || fd.isEmpty) && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getConfidenceBadgeClass(fd.tier)}`}
                        >
                          <XCircle className="w-2.5 h-2.5" />
                          {Math.round(score)}%
                        </span>
                      )}
                      {isSelect && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getConfidenceBadgeClass("high")}`}
                        >
                          <CheckCircle className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Input */}
                    <div
                      className={`rounded-lg overflow-hidden ${getFieldContainerClass(fd.tier, fd.isEmpty)}`}
                    >
                      {fd.type === "select" ? (
                        <select
                          value={fd.value}
                          onChange={(e) => fd.onChange(e.target.value)}
                          className="w-full bg-transparent px-3 py-2.5 text-sm text-[#f0f0f2] focus:outline-none focus:ring-1 focus:ring-[#6c63ff] transition-shadow appearance-none cursor-pointer"
                        >
                          {(fd.options ?? []).map((opt) => (
                            <option key={opt} value={opt} className="bg-[#111318]">
                              {opt === "EUR"
                                ? "EUR"
                                : opt === "USD"
                                  ? "USD"
                                  : opt === "GBP"
                                    ? "GBP"
                                    : "CHF"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={fd.type}
                          value={fd.value}
                          onChange={(e) => fd.onChange(e.target.value)}
                          placeholder={fd.isEmpty ? "—" : undefined}
                          step={fd.type === "number" ? "0.01" : undefined}
                          min={fd.type === "number" ? 0 : undefined}
                          className="w-full bg-transparent px-3 py-2.5 text-sm text-[#f0f0f2] placeholder-[#4b5563] focus:outline-none focus:ring-1 focus:ring-[#6c63ff] transition-shadow"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw text (collapsible) */}
          {fields.rawText && (
            <details className="mt-4 bg-[#111318] border border-[#1e2029] rounded-xl p-4 group">
              <summary className="text-xs font-medium text-[#6b7280] cursor-pointer hover:text-[#9ca3af] transition-colors select-none">
                Testo originale rilevato dall&rsquo;OCR
              </summary>
              <pre className="mt-3 text-xs text-[#9ca3af] whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-[#0d0e13] p-3 rounded-lg border border-[#1e2029]">
                {fields.rawText}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onSkip}
              disabled={isConfirming}
              className="flex-1 py-2.5 rounded-xl text-sm text-[#6b7280] hover:text-[#e5e7eb] bg-transparent border border-[#1e2029] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salta OCR e inserisci a mano
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvataggio&hellip;
                </>
              ) : (
                "Conferma e Salva Fattura"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OcrReviewForm;
