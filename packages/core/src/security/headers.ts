type ResponseHeader = { key: string; value: string };

type RouteHeaders = { headers: ResponseHeader[]; source: string };

/** Spoken answers and calls require same-origin microphone access. */
const PUBLIC_APP_PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=(self)",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "hid=()",
  "bluetooth=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
  "browsing-topics=()",
].join(", ");

const PUBLIC_APP_SECURITY_HEADERS = [
  {
    headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: PUBLIC_APP_PERMISSIONS_POLICY },
    ],
    source: "/:path*",
  },
] satisfies RouteHeaders[];

/** @public */
export async function getPublicAppSecurityHeaders() {
  return PUBLIC_APP_SECURITY_HEADERS;
}
