import { isLocalhostSupported } from "@zoonk/utils/environment";

/**
 * `pnpm start` and E2E builds run with `NODE_ENV=production`, where Better Auth refuses its own default.
 * Deployments set `BETTER_AUTH_SECRET`; local runs without one share this, so sessions survive restarts.
 */
const LOCAL_AUTH_SECRET = "zoonk-local-auth-secret-for-development-and-e2e-only";

export function getAuthSecret(): string | undefined {
  return process.env.BETTER_AUTH_SECRET || (isLocalhostSupported() ? LOCAL_AUTH_SECRET : undefined);
}
