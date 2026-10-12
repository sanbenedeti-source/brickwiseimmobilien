# Supabase authentication email templates

The application intentionally uses two different email flows:

1. New account: clickable confirmation link.
2. Every later login: 6-digit OTP code.
3. Forgotten password: one short email with a clickable password-reset link.

Configure both templates in `Supabase Dashboard -> Authentication -> Email Templates`.

## 1. Confirm signup

Select **Confirm signup**.

Subject:

```text
Confirm your Brickwise account
```

HTML:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <h2>Confirm your Brickwise account</h2>
  <p>Thank you for registering. Click the button below to confirm your email address and activate your account.</p>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">
      Confirm account
    </a>
  </p>
  <p style="color:#64748b;">If you did not create this account, you can ignore this email.</p>
</div>
```

This template must use `{{ .ConfirmationURL }}` and must not use `{{ .Token }}`.

## 2. Magic Link (login OTP)

Select **Magic Link**.

Subject:

```text
Your Brickwise security code
```

HTML:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <h2>Your Brickwise security code</h2>
  <p>Use this one-time code to complete your login:</p>
  <p style="display:inline-block;margin:24px 0;padding:18px 28px;background:#0f172a;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:8px;">
    {{ .Token }}
  </p>
  <p>The code is valid only for a short time. Never share it with anyone.</p>
  <p style="color:#64748b;">If you did not request this login, you can ignore this email.</p>
</div>
```

This template must use `{{ .Token }}` and must not use `{{ .ConfirmationURL }}`.

## 3. Reset password

Select **Reset password** in `Supabase Dashboard -> Authentication -> Email Templates`.

Subject:

```text
Reset your Brickwise password
```

HTML:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <h2>Set a new password</h2>
  <p>Click below to choose a new password for your Brickwise account.</p>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">
      Set new password
    </a>
  </p>
</div>
```

The recovery template must contain `{{ .ConfirmationURL }}` inside the link's
`href`. Plain text such as "Reset password" does not create a link by itself.

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
