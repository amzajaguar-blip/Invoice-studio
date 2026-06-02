// ─── Signature Repository — Mock implementation ───

import type { SignatureRepository, CreateSignatureInput } from "@/repositories/interfaces/signature-repository";
import type { Signature, SignaturePosition } from "@/types/models/signature";

const MOCK_SIGNATURES: Signature[] = [
  {
    id: "sig-1",
    orgId: "org-1",
    name: "Firma Marco",
    type: "handwritten",
    svgData: "M10,50 Q40,20 70,50 T130,50",
    imageBase64: null,
    isDefault: true,
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "sig-2",
    orgId: "org-1",
    name: "Timbro Studio",
    type: "stamp",
    svgData: null,
    imageBase64: null,
    isDefault: false,
    createdAt: "2026-04-15T14:00:00Z",
  },
];

export function createSignatureRepositoryMock(): SignatureRepository {
  let signatures = [...MOCK_SIGNATURES];

  return {
    async list(_orgId: string): Promise<Signature[]> {
      await new Promise((r) => setTimeout(r, 300));
      return signatures;
    },

    async create(_orgId: string, input: CreateSignatureInput): Promise<Signature> {
      await new Promise((r) => setTimeout(r, 500));
      const sig: Signature = {
        id: `sig-${Date.now()}`,
        orgId: _orgId,
        name: input.name,
        type: input.type,
        svgData: input.svgData ?? null,
        imageBase64: input.imageBase64 ?? null,
        isDefault: signatures.length === 0,
        createdAt: new Date().toISOString(),
      };
      signatures = [sig, ...signatures];
      return sig;
    },

    async setDefault(signatureId: string): Promise<Signature> {
      await new Promise((r) => setTimeout(r, 200));
      signatures = signatures.map((s) => ({ ...s, isDefault: s.id === signatureId }));
      const sig = signatures.find((s) => s.id === signatureId);
      if (!sig) throw new Error("Signature not found");
      return sig;
    },

    async delete(signatureId: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 200));
      signatures = signatures.filter((s) => s.id !== signatureId);
    },

    async updatePosition(signatureId: string, _position: SignaturePosition): Promise<Signature> {
      await new Promise((r) => setTimeout(r, 300));
      const sig = signatures.find((s) => s.id === signatureId);
      if (!sig) throw new Error("Signature not found");
      return sig;
    },
  };
}
