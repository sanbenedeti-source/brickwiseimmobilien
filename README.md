# Global Fractional Real Estate

Next.js project for a cross-border real estate participation platform with
property pages, contact forms, investor dashboard, funding workflow, and admin
tools.

## Getting Started

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in the browser.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Configuration

Supabase credentials are configured through `.env`. Make sure the required
`NEXT_PUBLIC_SUPABASE_*` variables are set before testing login, registration,
contact requests, dashboard, or admin features.

## Deployment

The project can be deployed as a Next.js app on Vercel or a comparable hosting
platform. Configure `NEXT_PUBLIC_SITE_URL` for the active production domain.
