# Domain Setup: brickwise-immo.de

Project URL:

```text
https://www.brickwise-immo.de
```

## 1. Connect Hosting

If the project is deployed on Vercel:

1. Open the Vercel dashboard.
2. Select the Brickwise project.
3. Go to `Settings -> Domains`.
4. Add:

```text
www.brickwise-immo.de
brickwise-immo.de
```

5. Set `www.brickwise-immo.de` as the primary domain.

## 2. DNS Records

At the registrar:

```text
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

For the root domain:

```text
Type: A
Name: @
Value: 76.76.21.21
```

The code redirects the root domain to the primary `www` domain.

## 3. Environment Variable

In the hosting environment:

```env
NEXT_PUBLIC_SITE_URL=https://www.brickwise-immo.de
```

## 4. Supabase Auth URLs

In Supabase, open `Authentication -> URL Configuration`.

Set:

```text
Site URL:
https://www.brickwise-immo.de
```

Add redirect URLs:

```text
https://www.brickwise-immo.de/authentication/callback
https://www.brickwise-immo.de/sign-in/two-factor
http://localhost:3000/authentication/callback
http://localhost:3001/authentication/callback
```

## 5. Verify

After DNS propagation:

```bash
npm run build
```

Then open:

```text
https://www.brickwise-immo.de
```
