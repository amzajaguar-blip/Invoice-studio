"use client";

import { useRef, useState, useEffect } from "react";
import { Upload, FileText, X, AlertCircle, Loader2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OcrUploadZoneProps {
  onFileReady: (base64: string, fileName: string) => void;
  isProcessing: boolean;
  maxBytes?: number; // default 20 * 1024 * 1024
  error?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,image/*";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function isValidExtension(name: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * Drag-and-drop OCR upload zone.
 * Accepts PDF, JPG, PNG, WEBP; reads as base64 data URL.
 * Dark theme matching the existing ReceiptUpload component.
 */
export function OcrUploadZone({
  onFileReady,
  isProcessing = false,
  maxBytes = 20 * 1024 * 1024,
  error = null,
}: OcrUploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isPdf, setIsPdf] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Estrazione dati in corso...");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isProcessing) return;
    const messages = [
      "Analisi immagine in corso...",
      "Identificazione fornitore...",
      "Ricerca importi e IVA...",
      "Verifica affidabilità dati OCR...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setProcessingMessage(messages[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const displayError = error ?? localError;

  // ─── File handling ─────────────────────────────────────────────────────────────

  function handleFileSelect(selected: File) {
    setLocalError(null);

    if (!isValidExtension(selected.name)) {
      setLocalError("Formato non supportato. Carica un PDF, JPG, PNG o WEBP.");
      return;
    }

    if (selected.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      setLocalError(`Il file è troppo grande (massimo ${maxMB}MB).`);
      return;
    }

    setIsPdf(isPdfFile(selected.name));
    setFileName(selected.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string) ?? "";
      setPreview(base64);
    };
    reader.onerror = () => {
      setLocalError("Errore durante la lettura del file. Riprova.");
    };
    reader.readAsDataURL(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  }

  function handleAnalyze() {
    if (!preview || !fileName) {
      setLocalError("Seleziona prima un documento.");
      return;
    }
    onFileReady(preview, fileName);
  }

  function handleClear() {
    setPreview(null);
    setFileName("");
    setIsPdf(false);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#f0f0f2] font-[Georgia,serif] mb-4">
          Carica Fattura per OCR
        </h2>

        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-[#6c63ff] bg-[#6c63ff]/5"
                : "border-[#1e2029] hover:border-[#6c63ff]/50 hover:bg-[#0d0e13]"
            }`}
          >
            <div className="flex justify-center mb-3">
              <Upload className="w-12 h-12 text-[#4b5563]" />
            </div>
            <p className="text-[#f0f0f2] font-semibold mb-1">
              Trascina qui la fattura
            </p>
            <p className="text-[#6b7280] text-sm mb-3">
              oppure clicca per selezionare
            </p>
            <p className="text-xs text-[#4b5563]">
              PDF, JPG, PNG, WEBP &middot; Max {Math.round(maxBytes / (1024 * 1024))}MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative bg-[#0d0e13] rounded-xl overflow-hidden border border-[#1e2029]">
              {isPdf ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <FileText className="w-16 h-16 text-[#6c63ff] mb-3" />
                  <p className="text-[#f0f0f2] font-semibold text-sm mb-1">
                    Documento PDF
                  </p>
                  <p className="text-[#6b7280] text-xs truncate max-w-full px-4">
                    {fileName}
                  </p>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt="Anteprima documento"
                  className="w-full h-auto max-h-96 object-contain"
                />
              )}
              <div className="absolute top-2 right-2 bg-[#22c55e] text-white rounded-full p-1.5">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* File info */}
            <div className="bg-[#0d0e13] p-3 rounded-lg border border-[#1e2029]">
              <p className="text-xs text-[#6b7280]">Documento selezionato:</p>
              <p className="text-sm font-semibold text-[#f0f0f2] truncate">
                {fileName}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium text-sm border-none cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {processingMessage}
                  </>
                ) : (
                  "Analizza"
                )}
              </button>
              <button
                onClick={handleClear}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-[#0d0e13] border border-[#1e2029] text-[#9ca3af] hover:text-[#f0f0f2] text-sm cursor-pointer transition-colors disabled:opacity-60"
                aria-label="Rimuovi file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default OcrUploadZone;
