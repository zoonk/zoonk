export function getEnvironment(): "development" | "e2e" | "preview" | "production" {
  if (process.env.E2E_TESTING === "true") {
    return "e2e";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  if (process.env.NODE_ENV === "production") {
    return "preview";
  }

  return "development";
}

export function isLocalhostSupported(): boolean {
  const env = getEnvironment();
  return env === "development" || env === "e2e";
}
