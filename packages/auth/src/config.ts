import { type BetterAuthOptions } from "better-auth/types";

// When using Better Auth from apps, we use the default `api/auth` base path.
// However, in the API, we use a different base path, so this value can be overridden
export const BETTER_AUTH_BASE_PATH = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";

export const SESSION_EXPIRES_IN_DAYS = 30;

/**
 * How long a browser reads its signed copy of the session (Better Auth's cookie cache) instead of
 * the database, and so how long a session ended on the server can still read as signed in there.
 * A render can't set cookies, so a page in use asks for a new copy before it runs out
 * (`session-refresh.ts`).
 */
export const COOKIE_CACHE_MINUTES = 60;
export const IS_COOKIE_CACHE_ENABLED = process.env.AUTH_COOKIE_CACHE_ENABLED !== "false";

/** A class of 40 can start together with retry headroom; BotID still guards guest creation. */
export const GUEST_SIGN_IN_RATE_LIMIT = { max: 60, window: 60 };

export const AUTH_ADVANCED_OPTIONS = {
  database: { generateId: "uuid", joins: true },
} satisfies NonNullable<BetterAuthOptions["advanced"]>;

// We don't want to limit the number of memberships or organizations
// So we use the maximum safe integer because Better Auth doesn't support infinity.
export const AUTH_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;
export const AUTH_ORGANIZATION_LIMIT = Number.MAX_SAFE_INTEGER;
