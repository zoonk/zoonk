// When using Better Auth from apps, we use the default `api/auth` base path.
// However, in the API, we use a different base path, so this value can be overridden
export const BETTER_AUTH_BASE_PATH = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";
