/** Sends a short plain-text notice to the admin addresses in ADMIN_EMAILS through Resend.
 * The idempotency key stops a retried request from sending the same notice twice. */
export async function sendAdminEmail({ subject, lines, idempotencyKey }: { subject: string; lines: string[]; idempotencyKey: string }) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD;
  const recipients = (process.env.ADMIN_EMAILS || "").split(/[,;\s]+/).filter(Boolean);
  if (!key || recipients.length === 0) throw new Error("Admin email configuration missing");
  const body = JSON.stringify({
    from: process.env.REGISTRATION_EMAIL_FROM || "Brickwise <notifications@brickwise-immo.de>",
    to: recipients,
    subject,
    text: lines.join("\n"),
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return;
      if (response.status !== 429 && response.status < 500) throw new Error(`Admin email rejected (${response.status})`);
      if (attempt === 2) throw new Error(`Admin email unavailable (${response.status})`);
    } catch (error) {
      if (attempt === 2 || (error instanceof Error && error.message.includes("rejected"))) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}
