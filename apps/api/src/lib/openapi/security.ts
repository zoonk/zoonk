import { isLocalhostSupported } from "@zoonk/utils/environment";

type SecurityRequirement = Record<string, string[]>;

export const PUBLIC_SECURITY: SecurityRequirement[] = [];

export const AUTHENTICATED_SECURITY: SecurityRequirement[] = [
  { bearerAuth: [] },
  { cookieAuth: [] },
];

export const OPTIONAL_AUTHENTICATION_SECURITY: SecurityRequirement[] = [
  {},
  ...AUTHENTICATED_SECURITY,
];

export const SECURITY_SCHEMES = {
  bearerAuth: {
    description: "Bearer token accepted by the deployed Better Auth bearer plugin.",
    scheme: "bearer",
    type: "http",
  },
  cookieAuth: {
    description: "Better Auth session cookie for the documented deployment environment.",
    in: "cookie",
    name: isLocalhostSupported()
      ? "better-auth.session_token"
      : "__Secure-better-auth.session_token",
    type: "apiKey",
  },
} as const;
