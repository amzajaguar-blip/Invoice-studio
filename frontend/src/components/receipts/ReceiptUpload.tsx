"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, Upload, X } from "lucide-react";

interface ReceiptUploadProps {
  onUpload?: (file: File, preview: string) => void;
  isProcessing?: boolean;
  /**
   * Max file size in bytes. Default: 10 MB.
   */
  maxBytes?: number;
}

/**
 * Drag-and-drop receipt upload with preview + size/type validation.
 * Themed for InvoiceStudio dark UI. No external deps.
 */
export function ReceiptUpload({ onUpload, isProcessing = false, maxBytes = 10 * 1024 * 1024 }: ReceiptUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(selected: File) {
    setError(null);

    if (!selected.type.startsWith("image/")) {
      setError("Seleziona un'immagine (JPG, PNG, etc.)");
      return;
    }

    if (selected.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      setError(`L'immagine è troppo grande (max ${maxMB}MB)`);
      return;
    }

    setFile(selected);
    setFileName(selected.name);

    const reader = new FileReader();
    reader.onload = (e) => setPreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) handleFileSelect(e.target.files[0]);
  }

  function handleUpload() {
    if (!file) {
      setError("Seleziona prima un'immagine");
      return;
    }
    if (preview && onUpload) onUpload(file, preview);
  }

  function handleClear() {
    setPreview(null);
    setFileName("");
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#f0f0f2] font-[Georgia,serif] mb-4">
          <Camera className="w-5 h-5 inline-block mr-1 align-text-bottom" /> Carica Ricevuta
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
            <div className="text-5xl mb-3">⬆️</div>
            <p className="text-[#f0f0f2] font-semibold mb-1">Trascina qui la ricevuta</p>
            <p className="text-[#6b7280] text-sm mb-3">oppure clicca per selezionare</p>
            <p className="text-xs text-[#4b5563]">
              JPG, PNG • Max {Math.round(maxBytes / (1024 * 1024))}MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-[#0d0e13] rounded-xl overflow-hidden border border-[#1e2029]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Anteprima ricevuta"
                className="w-full h-auto max-h-96 object-contain"
              />
              <div className="absolute top-2 right-2 bg-[#22c55e] text-white rounded-full p-1.5 text-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="bg-[#0d0e13] p-3 rounded-lg border border-[#1e2029]">
              <p className="text-xs text-[#6b7280]">File selezionato:</p>
              <p className="text-sm font-semibold text-[#f0f0f2] truncate">{fileName}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium text-sm border-none cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? <span className="flex items-center gap-1 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Elaborazione...</span> : <span className="flex items-center gap-1 justify-center"><Upload className="w-3.5 h-3.5" /> Carica e Analizza</span>}
              </button>
              <button
                onClick={handleClear}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-[#0d0e13] border border-[#1e2029] text-[#9ca3af] hover:text-[#f0f0f2] text-sm cursor-pointer transition-colors disabled:opacity-60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiptUpload;
