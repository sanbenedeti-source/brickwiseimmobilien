import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "brickwise-immo.de",
          },
        ],
        destination: "https://www.brickwise-immo.de/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
      "frame-src https://www.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      ...["admin", "dashboard", "funding", "sign-in", "join", "forgot-password", "update-password", "authentication", "thank-you", "logout", "api", "interface", "documents"].map(segment => ({
        source: "/" + segment + "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      ],
    }];
  },
};

export default nextConfig;
