/**
 * Where the code runs, not how it was built: only Vercel deployments are preview or production, so
 * a production build served on this machine (`pnpm start`) keeps local sign-in, mail and origins.
 */
export function getEnvironment(): "development" | "e2e" | "preview" | "production" {
  if (process.env.E2E_TESTING === "true") {
    return "e2e";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  // Vercel custom environments report "preview" too.
  if (process.env.VERCEL_ENV === "preview") {
    return "preview";
  }

  return "development";
}

export function isLocalhostSupported(): boolean {
  const env = getEnvironment();
  return env === "development" || env === "e2e";
}
