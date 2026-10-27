# Supabase authentication email templates

The application intentionally uses three email flows:

1. New account: clickable confirmation link.
2. Every later login: 6-digit OTP code.
3. Forgotten password: one short email with a clickable password-reset link.

Configure the templates in `Supabase Dashboard -> Authentication -> Email Templates`.

Each template picks the language stored at registration in the user's metadata
(`email_language`: en, de, fr, es or it, written by `app/interface/register/route.ts`).
Accounts without that field receive the English version (`{{ else }}` branch).

## 1. Confirm signup

Select **Confirm signup**.

Subject:

```text
{{ if eq .Data.email_language "de" }}Bestätigen Sie Ihr Brickwise-Konto{{ else if eq .Data.email_language "fr" }}Confirmez votre compte Brickwise{{ else if eq .Data.email_language "es" }}Confirma tu cuenta de Brickwise{{ else if eq .Data.email_language "it" }}Conferma il tuo account Brickwise{{ else }}Confirm your Brickwise account{{ end }}
```

HTML:

```html
{{ if eq .Data.email_language "de" }}
<div lang="de" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Bestätigen Sie Ihr Brickwise-Konto</h2>
  <p>Vielen Dank für Ihre Registrierung. Klicken Sie auf die Schaltfläche, um Ihre E-Mail-Adresse zu bestätigen und Ihr Konto zu aktivieren.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Konto bestätigen</a>
  </p>
  <p style="color:#5b6678;">Wenn Sie dieses Konto nicht erstellt haben, können Sie diese E-Mail ignorieren.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "fr" }}
<div lang="fr" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Confirmez votre compte Brickwise</h2>
  <p>Merci pour votre inscription. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Confirmer le compte</a>
  </p>
  <p style="color:#5b6678;">Si vous n’avez pas créé ce compte, vous pouvez ignorer cet e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "es" }}
<div lang="es" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Confirma tu cuenta de Brickwise</h2>
  <p>Gracias por registrarte. Haz clic en el botón para confirmar tu dirección de correo electrónico y activar tu cuenta.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Confirmar cuenta</a>
  </p>
  <p style="color:#5b6678;">Si no has creado esta cuenta, puedes ignorar este correo.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "it" }}
<div lang="it" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Conferma il tuo account Brickwise</h2>
  <p>Grazie per la registrazione. Fai clic sul pulsante qui sotto per confermare il tuo indirizzo e-mail e attivare l’account.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Conferma account</a>
  </p>
  <p style="color:#5b6678;">Se non hai creato questo account, puoi ignorare questa e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else }}
<div lang="en" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Confirm your Brickwise account</h2>
  <p>Thank you for registering. Click the button below to confirm your email address and activate your account.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Confirm account</a>
  </p>
  <p style="color:#5b6678;">If you did not create this account, you can ignore this email.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ end }}
```

This template must use `{{ .ConfirmationURL }}` and must not use `{{ .Token }}`.

## 2. Magic Link

Select **Magic Link**.

Subject:

```text
{{ if eq .Data.email_language "de" }}Ihr Brickwise-Sicherheitscode{{ else if eq .Data.email_language "fr" }}Votre code de sécurité Brickwise{{ else if eq .Data.email_language "es" }}Tu código de seguridad de Brickwise{{ else if eq .Data.email_language "it" }}Il tuo codice di sicurezza Brickwise{{ else }}Your Brickwise security code{{ end }}
```

HTML:

```html
{{ if eq .Data.email_language "de" }}
<div lang="de" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Ihr Brickwise-Sicherheitscode</h2>
  <p>Verwenden Sie diesen einmaligen Code, um Ihre Anmeldung abzuschließen:</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#14213d;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;border-radius:8px;">{{ .Token }}</p>
  <p>Der Code ist nur kurze Zeit gültig. Geben Sie ihn niemals weiter.</p>
  <p style="color:#5b6678;">Wenn Sie diese Anmeldung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "fr" }}
<div lang="fr" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Votre code de sécurité Brickwise</h2>
  <p>Utilisez ce code à usage unique pour finaliser votre connexion :</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#14213d;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;border-radius:8px;">{{ .Token }}</p>
  <p>Ce code n’est valable que peu de temps. Ne le communiquez jamais à personne.</p>
  <p style="color:#5b6678;">Si vous n’avez pas demandé cette connexion, vous pouvez ignorer cet e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "es" }}
<div lang="es" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Tu código de seguridad de Brickwise</h2>
  <p>Usa este código de un solo uso para completar el inicio de sesión:</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#14213d;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;border-radius:8px;">{{ .Token }}</p>
  <p>El código solo es válido durante poco tiempo. No lo compartas nunca con nadie.</p>
  <p style="color:#5b6678;">Si no has solicitado este inicio de sesión, puedes ignorar este correo.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "it" }}
<div lang="it" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Il tuo codice di sicurezza Brickwise</h2>
  <p>Usa questo codice monouso per completare l’accesso:</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#14213d;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;border-radius:8px;">{{ .Token }}</p>
  <p>Il codice è valido solo per poco tempo. Non condividerlo mai con nessuno.</p>
  <p style="color:#5b6678;">Se non hai richiesto questo accesso, puoi ignorare questa e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else }}
<div lang="en" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Your Brickwise security code</h2>
  <p>Use this one-time code to complete your login:</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#14213d;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;border-radius:8px;">{{ .Token }}</p>
  <p>The code is valid only for a short time. Never share it with anyone.</p>
  <p style="color:#5b6678;">If you did not request this login, you can ignore this email.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ end }}
```

This template must use `{{ .Token }}` and must not use `{{ .ConfirmationURL }}`.

## 3. Reset password

Select **Reset password**.

Subject:

```text
{{ if eq .Data.email_language "de" }}Brickwise-Passwort zurücksetzen{{ else if eq .Data.email_language "fr" }}Réinitialisez votre mot de passe Brickwise{{ else if eq .Data.email_language "es" }}Restablece tu contraseña de Brickwise{{ else if eq .Data.email_language "it" }}Reimposta la password Brickwise{{ else }}Reset your Brickwise password{{ end }}
```

HTML:

```html
{{ if eq .Data.email_language "de" }}
<div lang="de" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Neues Passwort festlegen</h2>
  <p>Klicken Sie unten, um ein neues Passwort für Ihr Brickwise-Konto zu wählen.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Neues Passwort festlegen</a>
  </p>
  <p style="color:#5b6678;">Wenn Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "fr" }}
<div lang="fr" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Définir un nouveau mot de passe</h2>
  <p>Cliquez ci-dessous pour choisir un nouveau mot de passe pour votre compte Brickwise.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Définir le mot de passe</a>
  </p>
  <p style="color:#5b6678;">Si vous n’avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "es" }}
<div lang="es" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Establece una nueva contraseña</h2>
  <p>Haz clic abajo para elegir una nueva contraseña para tu cuenta de Brickwise.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Establecer contraseña</a>
  </p>
  <p style="color:#5b6678;">Si no has solicitado restablecer la contraseña, puedes ignorar este correo.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else if eq .Data.email_language "it" }}
<div lang="it" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Imposta una nuova password</h2>
  <p>Fai clic qui sotto per scegliere una nuova password per il tuo account Brickwise.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Imposta password</a>
  </p>
  <p style="color:#5b6678;">Se non hai richiesto il ripristino della password, puoi ignorare questa e-mail.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ else }}
<div lang="en" style="font-family:Arial,Helvetica,sans-serif;color:#14213d;line-height:1.6;max-width:560px;">
  <h2 style="margin:0 0 12px;">Set a new password</h2>
  <p>Click below to choose a new password for your Brickwise account.</p>
  <p style="margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#1667a8;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;">Set new password</a>
  </p>
  <p style="color:#5b6678;">If you did not request a password reset, you can ignore this email.</p>
  <p style="margin-top:32px;border-top:1px solid #dfe5ec;padding-top:16px;font-size:12px;color:#5b6678;">BRICKWISE LLC · info@brickwise-immo.de</p>
</div>
{{ end }}
```

The recovery template must contain `{{ .ConfirmationURL }}` inside the link's `href`.

## URL configuration

In `Authentication -> URL Configuration` set the production website as the Site URL and add this redirect URL:

```text
https://YOUR-DOMAIN/authentication/callback
```

For local testing also add:

```text
http://localhost:3000/authentication/callback
```

The production redirect allow list must include:

```text
https://www.brickwise-immo.de/authentication/callback
```

The application exchanges the confirmation link code for a session and redirects the confirmed client to `/dashboard`. Each later login first validates the password and then sends the OTP code without creating a new account.
