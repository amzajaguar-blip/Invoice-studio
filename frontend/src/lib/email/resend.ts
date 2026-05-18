import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendInvoiceEmailParams {
  to: string;
  subject: string;
  invoiceNumber: string;
  clientName: string;
  paymentLink: string;
  dueDate: string;
  totalFormatted: string;
  notes?: string | null;
}

/**
 * Sends an invoice email with the payment link to a client.
 * Uses Resend's transactional email service.
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const { to, subject, invoiceNumber, clientName, paymentLink, dueDate, totalFormatted, notes } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0a0b0f; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0b0f; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111318; border-radius:16px; border:1px solid #1f2128; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px; text-align:center;">
              <span style="font-size:22px; font-weight:700; color:#f0f0f2; font-family:Georgia,serif; letter-spacing:-0.5px;">
                Invoice<span style="color:#6c63ff;">Studio</span>
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h2 style="font-size:20px; color:#f0f0f2; margin:0 0 12px; font-family:Georgia,serif;">
                Fattura ${escapeHtml(invoiceNumber)}
              </h2>
              <p style="font-size:15px; color:#d1d5db; margin:0 0 8px; line-height:1.6;">
                Ciao ${escapeHtml(clientName)},
              </p>
              <p style="font-size:15px; color:#d1d5db; margin:0 0 24px; line-height:1.6;">
                Hai ricevuto una fattura di <strong style="color:#f0f0f2;">${escapeHtml(totalFormatted)}</strong> con scadenza <strong style="color:#f0f0f2;">${escapeHtml(dueDate)}</strong>.
              </p>
              ${notes ? `<p style="font-size:14px; color:#6b7280; margin:0 0 24px; line-height:1.6; background-color:#1a1d24; padding:12px 16px; border-radius:8px; border-left:3px solid #6c63ff;">${escapeHtml(notes)}</p>` : ""}
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="background-color:#6c63ff; border-radius:12px; padding:14px 36px;">
                    <a href="${escapeHtml(paymentLink)}" style="color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; display:inline-block; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Paga ora con Carta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; color:#6b7280; margin:0; line-height:1.6; text-align:center;">
                Puoi pagare direttamente online con carta di credito o debito tramite Stripe.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px; background-color:#0a0b0f; border-top:1px solid #1f2128;">
              <p style="font-size:12px; color:#6b7280; margin:0; text-align:center; line-height:1.5;">
                InvoiceStudio — Fatture professionali per freelancer italiani<br>
                <a href="${escapeHtml(appUrl)}/privacy" style="color:#6b7280;">Privacy</a> · 
                <a href="${escapeHtml(appUrl)}/terms" style="color:#6b7280;">Termini</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const { data, error } = await resend.emails.send({
    from: "InvoiceStudio <fatture@invoicestudio.app>",
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("Resend send error:", error);
    throw error;
  }

  return data;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
