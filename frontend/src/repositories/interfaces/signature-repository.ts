// ─── Signature Repository interface ───
// NO API implementation. Mock only.

import type { Signature, SignaturePosition, SignatureType } from "@/types/models/signature";

export interface SignatureRepository {
  /** List all signatures for an organization. */
  list(orgId: string): Promise<Signature[]>;

  /** Upload/create a new signature. */
  create(
    orgId: string,
    input: CreateSignatureInput,
  ): Promise<Signature>;

  /** Set a signature as default. */
  setDefault(signatureId: string): Promise<Signature>;

  /** Delete a signature. */
  delete(signatureId: string): Promise<void>;

  /** Update signature position on invoice PDF. */
  updatePosition(
    signatureId: string,
    position: SignaturePosition,
  ): Promise<Signature>;
}

export interface CreateSignatureInput {
  name: string;
  type: SignatureType;
  svgData?: string;
  imageBase64?: string;
}
