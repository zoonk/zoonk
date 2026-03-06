// When using Better Auth from apps, we use the default `api/auth` base path.
// However, in the API, we use a different base path, so this value can be overridden
export const BETTER_AUTH_BASE_PATH = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";

export const SESSION_EXPIRES_IN_DAYS = 30;
export const COOKIE_CACHE_MINUTES = 60;

// We don't want to limit the number of memberships or organizations
// So we use the maximum safe integer because Better Auth doesn't support infinity.
export const AUTH_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;
export const AUTH_ORGANIZATION_LIMIT = Number.MAX_SAFE_INTEGER;
