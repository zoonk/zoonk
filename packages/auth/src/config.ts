import { type BetterAuthOptions } from "better-auth/types";

export const BETTER_AUTH_BASE_PATH = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";

export const SESSION_EXPIRES_IN_DAYS = 30;
export const COOKIE_CACHE_MINUTES = 60;
export const IS_COOKIE_CACHE_ENABLED = process.env.AUTH_COOKIE_CACHE_ENABLED !== "false";

/**
 * Per IP, so a class of 40 behind one network can start as guests or sign in with email codes
 * together, with retry headroom. BotID or the apps' attestation still checks each request, and a
 * code allows 3 tries.
 */
export const SHARED_IP_SIGN_IN_RATE_LIMIT = { max: 60, window: 60 };

export const AUTH_ADVANCED_OPTIONS = {
  database: { generateId: "uuid", joins: true },
} satisfies NonNullable<BetterAuthOptions["advanced"]>;

/** Better Auth defaults to 100 members per organization. */
export const AUTH_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;
