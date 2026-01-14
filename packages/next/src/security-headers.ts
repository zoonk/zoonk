import type { Header } from "next/dist/lib/load-custom-routes";

const isDev = process.env.NODE_ENV === "development";

type CSPOptions = {
  imgSrc?: string[];
  scriptSrc?: string[];
  connectSrc?: string[];
};

export function createSecurityHeaders(options: CSPOptions = {}): Header[] {
  const imgSrc = ["'self'", "blob:", "data:", ...(options.imgSrc ?? [])];
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(options.scriptSrc ?? [])];
  const connectSrc = ["'self'", ...(options.connectSrc ?? [])];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return [
    {
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
      source: "/(.*)",
    },
  ];
}
