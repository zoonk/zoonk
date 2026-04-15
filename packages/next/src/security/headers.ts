type ResponseHeader = {
  key: string;
  value: string;
};

type RouteHeaders = {
  headers: ResponseHeader[];
  source: string;
};

const PUBLIC_APP_PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
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
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Permissions-Policy",
        value: PUBLIC_APP_PERMISSIONS_POLICY,
      },
    ],
    source: "/:path*",
  },
] satisfies RouteHeaders[];

/**
 * Keeps the baseline security headers for our public apps in one place so the
 * policy stays consistent across `main`, `api`, and `editor`. The list is
 * intentionally limited to low-risk headers while CSP is handled separately.
 *
 * @public
 */
export async function getPublicAppSecurityHeaders() {
  return PUBLIC_APP_SECURITY_HEADERS;
}
