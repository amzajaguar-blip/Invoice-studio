// ─── Signature domain model ───
// Digital signatures for invoices — Italian freelancer requirements (firma digitale / autografa)

export type SignatureType = "digital" | "handwritten" | "stamp";

export interface Signature {
  id: string;
  orgId: string;
  name: string; // display name for the signature
  type: SignatureType;
  /** SVG path data for handwritten signatures, null for digital/stamp. */
  svgData: string | null;
  /** Base64 PNG of the signature/stamp image. */
  imageBase64: string | null;
  /** Whether this is the default signature for new invoices. */
  isDefault: boolean;
  createdAt: string;
}

export interface SignaturePosition {
  /** Page section to place the signature. */
  section: "header" | "footer" | "above_total" | "below_total" | "custom";
  /** X offset from section anchor in mm. */
  x: number;
  /** Y offset from section anchor in mm. */
  y: number;
  /** Width in mm. */
  width: number;
  /** Opacity 0–1. */
  opacity: number;
}
