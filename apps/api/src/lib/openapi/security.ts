import { getSessionCookieName } from "@zoonk/auth/cookies";
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

export function createSecuritySchemes({ cookieName }: { cookieName: string }) {
  return {
    bearerAuth: {
      description: "Zoonk session token sent in the Authorization header.",
      scheme: "bearer",
      type: "http",
    },
    cookieAuth: {
      description: "Zoonk browser session cookie.",
      in: "cookie",
      name: cookieName,
      type: "apiKey",
    },
  } as const;
}

export const SECURITY_SCHEMES = createSecuritySchemes({
  cookieName: getSessionCookieName({ secure: !isLocalhostSupported() }),
});
