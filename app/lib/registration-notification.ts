type Registration = { id: string; name: string; email: string; createdAt: string };

export async function notifyAdminOfRegistration(user: Registration) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD;
  const recipients = (process.env.ADMIN_EMAILS || "").split(/[,;\s]+/).filter(Boolean);
  if (!key || recipients.length === 0) throw new Error("Registration email configuration missing");

  const body = JSON.stringify({
    from: process.env.REGISTRATION_EMAIL_FROM || "Brickwise <notifications@brickwise-immo.de>",
    to: recipients,
    subject: "Brickwise – New registration",
    text: ["A new user registered on Brickwise.", "", `Name: ${user.name}`,
      `Email: ${user.email}`, `Date (UTC): ${user.createdAt}`, `ID: ${user.id}`, "",
      "This notice confirms that the account was created. Registration does not require email confirmation, so the email address has not been verified."].join("\n"),
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json",
          "Idempotency-Key": `registration/${user.id}` },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Registration email rejected (${response.status})`);
      }
      if (attempt === 2) throw new Error(`Registration email unavailable (${response.status})`);
    } catch (error) {
      if (attempt === 2 || (error instanceof Error && error.message.includes("rejected"))) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
}
