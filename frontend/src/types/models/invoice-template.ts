// ─── Invoice template domain model ───
// Personalized invoice layouts, branding, and custom fields for freelancers.

export type TemplateLayout = "classic" | "modern" | "minimal" | "custom";

export type TemplateColorScheme = "light" | "dark" | "brand";

export interface InvoiceTemplate {
  id: string;
  orgId: string;
  name: string;
  isDefault: boolean;

  // Layout
  layout: TemplateLayout;
  colorScheme: TemplateColorScheme;
  primaryColor: string; // hex
  accentColor: string; // hex

  // Branding
  showLogo: boolean;
  logoPosition: "header_left" | "header_center" | "header_right";
  logoMaxHeight: number; // mm

  // Typography
  fontFamily: "inter" | "geist" | "roboto" | "lora" | "playfair";
  fontSizeBody: number; // pt
  fontSizeHeading: number; // pt

  // Content sections visibility
  showSenderDetails: boolean;
  showClientDetails: boolean;
  showPaymentTerms: boolean;
  showNotes: boolean;
  showThankYou: boolean;
  thankYouMessage: string | null;

  // Signature placement
  signaturePosition: "above_footer" | "below_items" | "footer" | "none";

  // Custom fields
  customFields: InvoiceCustomField[];

  // Footer
  footerText: string | null;

  createdAt: string;
  updatedAt: string | null;
}

export interface InvoiceCustomField {
  id: string;
  label: string;
  value: string;
  position: "header" | "body" | "footer";
  bold: boolean;
  italic: boolean;
}
