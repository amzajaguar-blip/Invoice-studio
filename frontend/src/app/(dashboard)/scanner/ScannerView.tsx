// ─── ScannerView — OCR Intake full workflow ───

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createScannerRepositorySupabase } from "@/repositories/supabase/scanner-repository.supabase";
import { OcrUploadZone } from "@/components/ocr/OcrUploadZone";
import { OcrReviewForm } from "@/components/ocr/OcrReviewForm";
import { CheckCircle, FileText, Loader2 } from "lucide-react";
import type { ScannerExtractedData } from "@/types/states/scanner";

// ─── OCR API response types (mirrors route.ts output) ───

interface OcrApiFieldData {
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

interface OcrApiConfidence {
  supplierName: number;
  vatNumber: number;
  invoiceNumber: number;
  invoiceDate: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  overall: number;
}

type WorkflowStep = "upload" | "converting" | "processing" | "review" | "saving" | "success";

interface ScannerViewProps {
  orgId: string;
}

// ─── P0-1: PDF → Image conversion helper ──────────────────────────────────

/**
 * Converts the first page of a PDF (base64 data URL) to a PNG image
 * at 2x scale for optimal OCR quality.
 *
 * Uses pdfjs-dist with a CDN-hosted worker to keep the bundle lean.
 * The dynamic import ensures pdfjs-dist is only loaded when a PDF is uploaded.
 */
async function convertPdfToImage(base64: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

  // Decode base64 data URL → Uint8Array
  const base64Data = base64.includes(",") ? base64.split(",")[1]! : base64;
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  return canvas.toDataURL("image/png");
}

// ─── Component ────────────────────────────────────────────────────────────

export function ScannerView({ orgId }: ScannerViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<WorkflowStep>("upload");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [fields, setFields] = useState<OcrApiFieldData | null>(null);
  const [confidence, setConfidence] = useState<OcrApiConfidence | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);

  // ─── Step 1: File ready → (convert PDF) → call OCR API ──────────────────

  const handleFileReady = useCallback(async (base64: string, name: string) => {
    setImageBase64(base64);
    setFileName(name);
    setApiError(null);

    let processedBase64 = base64;

    // P0-1: Detect PDF → convert page 1 to PNG before OCR
    const isPdf = /\.pdf$/i.test(name);
    if (isPdf) {
      setStep("converting");
      try {
        processedBase64 = await convertPdfToImage(base64);
        setImageBase64(processedBase64);
      } catch {
        setApiError(
          "Conversione PDF fallita. Assicurati che il file non sia corrotto o protetto da password.",
        );
        setStep("upload");
        return;
      }
    }

    setStep("processing");

    try {
      const response = await fetch("/api/ocr/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: processedBase64 }),
      });

      const json = (await response.json()) as {
        success: boolean;
        data?: OcrApiFieldData & { confidence: OcrApiConfidence };
        error?: string;
        detail?: string;
      };

      if (!json.success || !json.data) {
        setApiError(json.error ?? "Elaborazione OCR fallita");
        setStep("upload");
        return;
      }

      setFields(json.data);
      setConfidence(json.data.confidence);
      setStep("review");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Errore di rete durante l'OCR");
      setStep("upload");
    }
  }, []);

  // ─── Step 2: User confirmed/corrected → save invoice ────────────────────

  const handleConfirm = useCallback(
    async (corrected: OcrApiFieldData) => {
      setStep("saving");

      const supabase = createClient();
      const repo = createScannerRepositorySupabase(supabase, orgId);

      const extractedData: ScannerExtractedData = {
        clientName: corrected.supplierName,
        clientEmail: null,
        clientVatNumber: corrected.vatNumber,
        invoiceNumber: corrected.invoiceNumber,
        issueDate: corrected.invoiceDate,
        dueDate: null,
        total: corrected.totalAmount,
        currency: corrected.currency,
        items: corrected.totalAmount
          ? [
              {
                description: "Servizi professionali",
                quantity: 1,
                unitPrice: corrected.totalAmount,
              },
            ]
          : [],
        rawText: corrected.rawText,
      };

      // P0-2: Build confidence map for OCR audit trail
      const ocrConfidence: Record<string, number> | undefined = confidence
        ? {
            supplierName: confidence.supplierName ?? 0,
            vatNumber: confidence.vatNumber ?? 0,
            invoiceNumber: confidence.invoiceNumber ?? 0,
            invoiceDate: confidence.invoiceDate ?? 0,
            taxableAmount: confidence.taxableAmount ?? 0,
            vatAmount: confidence.vatAmount ?? 0,
            totalAmount: confidence.totalAmount ?? 0,
            overall: confidence.overall ?? 0,
          }
        : undefined;

      try {
        const result = await repo.confirmAndCreateInvoice(orgId, extractedData, ocrConfidence);
        setSavedInvoiceId(result.invoiceId);
        setStep("success");
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Errore durante il salvataggio della fattura");
        setStep("review");
      }
    },
    [orgId, confidence],
  );

  // ─── Skip OCR → navigate to manual invoice creation ─────────────────────

  const handleSkip = useCallback(() => {
    router.push("/invoices");
  }, [router]);

  // ─── Go to created invoice ───────────────────────────────────────────────

  const handleGoToInvoice = useCallback(() => {
    router.push("/invoices");
  }, [router]);

  // ─── Retry (back to upload) ───────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setStep("upload");
    setApiError(null);
    setFields(null);
    setConfidence(null);
    setImageBase64("");
    setFileName("");
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Importa Documento (OCR)
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Carica una fattura e lascia che l&rsquo;OCR estragga i dati per te
          </p>
        </div>
      </div>

      {/* Step: Converting PDF → Image */}
      {step === "converting" && (
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <FileText className="w-12 h-12 text-[#6c63ff]" />
            </div>
            <div>
              <p className="text-[#f0f0f2] font-semibold text-sm mb-1">
                Conversione PDF in corso&hellip;
              </p>
              <p className="text-[#6b7280] text-xs truncate max-w-xs mx-auto">
                {fileName}
              </p>
            </div>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-[#6c63ff] animate-spin" />
            </div>
            <p className="text-xs text-[#4b5563]">
              Il PDF verrà convertito in immagine per l&rsquo;elaborazione OCR
            </p>
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {(step === "upload" || step === "processing") && (
        <OcrUploadZone
          onFileReady={handleFileReady}
          isProcessing={step === "processing"}
          error={apiError}
          maxBytes={20 * 1024 * 1024}
        />
      )}

      {/* Step: Review */}
      {step === "review" && fields && confidence && (
        <OcrReviewForm
          imageBase64={imageBase64}
          fileName={fileName}
          fields={fields}
          confidence={confidence}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          isConfirming={false}
        />
      )}

      {/* Step: Saving */}
      {step === "saving" && fields && confidence && (
        <OcrReviewForm
          imageBase64={imageBase64}
          fileName={fileName}
          fields={fields}
          confidence={confidence}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          isConfirming={true}
        />
      )}

      {/* Step: Success */}
      {step === "success" && (
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
              Fattura Importata con Successo!
            </h3>
            <p className="text-[#9ca3af] text-sm">
              I dati sono stati salvati. Puoi ora visualizzare, modificare o inviare la
              fattura dalla lista fatture.
            </p>
            {savedInvoiceId && (
              <p className="text-xs text-[#6b7280] font-mono">
                ID: {savedInvoiceId}
              </p>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 rounded-xl text-sm bg-[#0d0e13] border border-[#1e2029] text-[#e5e7eb] hover:bg-[#1e2029] cursor-pointer transition-colors"
              >
                Importa un&rsquo;altra fattura
              </button>
              <button
                onClick={handleGoToInvoice}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#6c63ff] hover:bg-[#5b52e0] cursor-pointer border-none transition-colors"
              >
                Vai alle fatture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
