/**
 * Next.js builds for production wherever it runs, so `VERCEL_ENV` names the environment; `pnpm dev`
 * and `pnpm start` set it to development. Without it a production build fails closed as a preview,
 * so a deployment missing Vercel's variables never gets local sign-in.
 */
export function getEnvironment(): "development" | "e2e" | "preview" | "production" {
  if (process.env.E2E_TESTING === "true") {
    return "e2e";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  if (process.env.VERCEL_ENV === "development") {
    return "development";
  }

  if (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "production") {
    return "preview";
  }

  return "development";
}

export function isLocalhostSupported(): boolean {
  const env = getEnvironment();
  return env === "development" || env === "e2e";
}
