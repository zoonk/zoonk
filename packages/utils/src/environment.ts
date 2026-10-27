/**
 * Where the code runs. A production build counts as a deployment unless `pnpm start` marks it as
 * served on this machine (`ZOONK_LOCAL_PRODUCTION`), so a deployment missing Vercel's variables
 * still fails closed while a local production build keeps local sign-in, mail and origins.
 */
export function getEnvironment(): "development" | "e2e" | "preview" | "production" {
  if (process.env.E2E_TESTING === "true") {
    return "e2e";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  // Vercel custom environments report "preview" too.
  if (
    process.env.VERCEL_ENV === "preview" ||
    (process.env.NODE_ENV === "production" && process.env.ZOONK_LOCAL_PRODUCTION !== "true")
  ) {
    return "preview";
  }

  return "development";
}

export function isLocalhostSupported(): boolean {
  const env = getEnvironment();
  return env === "development" || env === "e2e";
}
