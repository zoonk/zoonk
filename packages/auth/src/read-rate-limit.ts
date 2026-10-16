import { type BetterAuthOptions } from "better-auth/types";

type RateLimitRules = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customRules"]>;

/**
 * Better Auth's endpoints that only read on a GET: the session, its accounts, organizations,
 * admin lookups and subscriptions, plus its health check and error page. The rest stay limited
 * by default: sign-ins, codes, tokens, callbacks and every change.
 */
const READ_ONLY_AUTH_PATHS = [
  "/admin/get-user",
  "/admin/list-users",
  "/error",
  "/get-session",
  "/list-accounts",
  "/list-sessions",
  "/ok",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/get-invitation",
  "/organization/list",
  "/organization/list-invitations",
  "/organization/list-members",
  "/organization/list-user-invitations",
  "/subscription/list",
];

/**
 * Rate-limit rules that let a GET of a read-only endpoint through without counting it: the limiter
 * keeps its count in the database, so every counted read would be a write. Any other method on
 * the same path, such as the session renewal's POST, is still counted.
 */
export const READ_ONLY_RATE_LIMIT_RULES: RateLimitRules = Object.fromEntries(
  READ_ONLY_AUTH_PATHS.map((path) => [
    path,
    (request: Request, rule) => (request.method === "GET" ? false : rule),
  ]),
);
