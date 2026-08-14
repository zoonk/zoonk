import { z } from "zod";
import { type AppleConfiguration, getAppleClientSecret, getAppleConfiguration } from "./apple";

const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REQUEST_TIMEOUT_MS = 10_000;
const HTTP_SERVER_ERROR_THRESHOLD = 500;

const appleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  id_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

const appleErrorResponseSchema = z.object({ error: z.string() });

export type AppleAuthorization = {
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
};

export type AppleAuthorizationFailure = "configuration" | "invalidCredential" | "unavailable";

export class AppleAuthorizationError extends Error {
  readonly reason: AppleAuthorizationFailure;

  constructor(reason: AppleAuthorizationFailure) {
    super(`Apple authorization failed: ${reason}`);
    this.name = "AppleAuthorizationError";
    this.reason = reason;
  }
}

type AppleRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AppleRESTDependencies = {
  configuration: AppleConfiguration | null;
  getClientSecret: typeof getAppleClientSecret;
  request: AppleRequest;
  requestTimeoutMs?: number;
};

const liveDependencies: AppleRESTDependencies = {
  configuration: getAppleConfiguration(),
  getClientSecret: getAppleClientSecret,
  request: fetch,
};

/**
 * Rejects an incomplete Apple server setup before accepting a native
 * authorization code that can only be exchanged once.
 */
function requireAppleConfiguration(configuration: AppleConfiguration | null) {
  if (!configuration) {
    throw new AppleAuthorizationError("configuration");
  }

  return configuration;
}

/**
 * Executes one Apple REST request and separates provider availability from an
 * invalid user credential without exposing Apple's response text to clients.
 */
async function requestApple({
  body,
  dependencies,
  url,
}: {
  body: URLSearchParams;
  dependencies: AppleRESTDependencies;
  url: string;
}) {
  try {
    return await dependencies.request(url, {
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(dependencies.requestTimeoutMs ?? APPLE_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppleAuthorizationError("unavailable");
  }
}

/**
 * Maps Apple's small OAuth error vocabulary to outcomes the API can act on.
 * A reused or expired code is recoverable through a new native authorization;
 * other 4xx responses indicate server-side Apple configuration drift.
 */
async function getAppleFailure(response: Response): Promise<AppleAuthorizationError> {
  if (response.status >= HTTP_SERVER_ERROR_THRESHOLD) {
    return new AppleAuthorizationError("unavailable");
  }

  const payload = appleErrorResponseSchema.safeParse(await response.json().catch(() => null));

  return new AppleAuthorizationError(
    payload.success && payload.data.error === "invalid_grant"
      ? "invalidCredential"
      : "configuration",
  );
}

/**
 * Exchanges the five-minute, single-use code produced by Authentication
 * Services. Native requests omit redirect_uri and use the bundle identifier
 * for both client_id and the client-secret subject.
 */
export async function exchangeNativeAppleAuthorizationCode({
  authorizationCode,
  dependencies = liveDependencies,
}: {
  authorizationCode: string;
  dependencies?: AppleRESTDependencies;
}): Promise<AppleAuthorization> {
  const configuration = requireAppleConfiguration(dependencies.configuration);
  const clientIdentifier = configuration.appBundleIdentifier;
  const clientSecret = await dependencies.getClientSecret({ clientIdentifier, configuration });

  const body = new URLSearchParams({
    client_id: clientIdentifier,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });

  const response = await requestApple({ body, dependencies, url: APPLE_TOKEN_URL });

  if (!response.ok) {
    throw await getAppleFailure(response);
  }

  const payload = appleTokenResponseSchema.safeParse(await response.json().catch(() => null));

  if (!payload.success) {
    throw new AppleAuthorizationError("unavailable");
  }

  return {
    accessToken: payload.data.access_token,
    expiresIn: payload.data.expires_in,
    idToken: payload.data.id_token,
    refreshToken: payload.data.refresh_token,
  };
}

/**
 * Invalidates the Apple authorization created for one client identifier.
 * Apple returns 200 both for the first successful revocation and for a token
 * that was already revoked, which makes deletion retries safe.
 */
export async function revokeAppleToken({
  clientIdentifier,
  dependencies = liveDependencies,
  token,
  tokenType,
}: {
  clientIdentifier: string;
  dependencies?: AppleRESTDependencies;
  token: string;
  tokenType: "access_token" | "refresh_token";
}) {
  const configuration = requireAppleConfiguration(dependencies.configuration);
  const clientSecret = await dependencies.getClientSecret({ clientIdentifier, configuration });

  const body = new URLSearchParams({
    client_id: clientIdentifier,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenType,
  });

  const response = await requestApple({ body, dependencies, url: APPLE_REVOKE_URL });

  if (!response.ok) {
    throw await getAppleFailure(response);
  }
}
