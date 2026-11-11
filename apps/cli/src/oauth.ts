import { secureUrl } from "./api-origin.ts";
import { type StoredLogin, isPlainToken } from "./credentials.ts";
import { type HttpResult, isRecord, postForm, unexpectedResponse } from "./http.ts";

const CLIENT_ID = "zoonk-cli";
const SCOPE = "staff:read offline_access";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
/** RFC 8628 section 3.2: clients poll every 5 seconds when the server names no interval. */
const DEFAULT_POLL_SECONDS = 5;
const OAUTH_ERROR_PATTERN = /^[a-z_]{1,64}$/u;
const USER_CODE_PATTERN = /^[\w-]{1,64}$/u;

/**
 * Better Auth's oauth-provider answers 400 with these, not RFC 7009's 200, when the refresh token
 * was already deleted or revoked, such as from Admin.
 */
const ALREADY_REVOKED_DESCRIPTIONS = new Set(["token not found", "refresh token revoked"]);

const ENDPOINTS = {
  deviceCode: "/v1/auth/device/code",
  revoke: "/v1/auth/oauth2/revoke",
  token: "/v1/auth/oauth2/token",
} as const;

export type DeviceCode = {
  deviceCode: string;
  expiresInSeconds: number;
  intervalSeconds: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
};

/** `error` is the OAuth error code, or the HTTP status when the answer names none. */
type Revocation = "alreadyRevoked" | "revoked" | "unconfirmed";

export type TokenResult = { login: StoredLogin; ok: true } | { error: string; ok: false };

function oauthError(result: HttpResult): string | null {
  const error = isRecord(result.body) ? result.body.error : null;
  return typeof error === "string" && OAUTH_ERROR_PATTERN.test(error) ? error : null;
}

function isAlreadyRevoked(result: HttpResult): boolean {
  const body = isRecord(result.body) ? result.body : {};

  return (
    body.error === "invalid_request" &&
    typeof body.error_description === "string" &&
    ALREADY_REVOKED_DESCRIPTIONS.has(body.error_description)
  );
}

function toLogin(result: HttpResult): StoredLogin {
  const body = result.body;

  if (
    !isRecord(body) ||
    !isPlainToken(body.access_token) ||
    !isPlainToken(body.refresh_token) ||
    typeof body.expires_in !== "number"
  ) {
    throw unexpectedResponse(result);
  }

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    refreshToken: body.refresh_token,
  };
}

function toTokenResult(result: HttpResult): TokenResult {
  if (result.ok) {
    return { login: toLogin(result), ok: true };
  }

  return { error: oauthError(result) ?? `HTTP ${result.status}`, ok: false };
}

export async function requestDeviceCode(origin: string): Promise<DeviceCode> {
  const result = await postForm(new URL(ENDPOINTS.deviceCode, origin), {
    client_id: CLIENT_ID,
    scope: SCOPE,
  });

  const body = isRecord(result.body) ? result.body : {};
  const verificationUri = secureUrl(body.verification_uri);
  const verificationUriComplete = secureUrl(body.verification_uri_complete);

  const hasUnsafeCompleteUri =
    body.verification_uri_complete !== undefined && !verificationUriComplete;

  if (
    !result.ok ||
    typeof body.device_code !== "string" ||
    typeof body.user_code !== "string" ||
    !USER_CODE_PATTERN.test(body.user_code) ||
    !verificationUri ||
    hasUnsafeCompleteUri ||
    typeof body.expires_in !== "number"
  ) {
    throw unexpectedResponse(result);
  }

  return {
    deviceCode: body.device_code,
    expiresInSeconds: body.expires_in,
    intervalSeconds: typeof body.interval === "number" ? body.interval : DEFAULT_POLL_SECONDS,
    userCode: body.user_code,
    verificationUri: verificationUri.href,
    verificationUriComplete: verificationUriComplete?.href,
  };
}

export async function exchangeDeviceCode({
  deviceCode,
  origin,
}: {
  deviceCode: string;
  origin: string;
}): Promise<TokenResult> {
  const result = await postForm(new URL(ENDPOINTS.token, origin), {
    client_id: CLIENT_ID,
    device_code: deviceCode,
    grant_type: DEVICE_CODE_GRANT,
  });

  return toTokenResult(result);
}

export async function refreshLogin({
  origin,
  refreshToken,
}: {
  origin: string;
  refreshToken: string;
}): Promise<TokenResult> {
  const result = await postForm(new URL(ENDPOINTS.token, origin), {
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return toTokenResult(result);
}

/** Revoking the refresh token also ends the access tokens issued with it. */
export async function revokeLogin({
  origin,
  refreshToken,
}: {
  origin: string;
  refreshToken: string;
}): Promise<Revocation> {
  const result = await postForm(new URL(ENDPOINTS.revoke, origin), {
    client_id: CLIENT_ID,
    token: refreshToken,
    token_type_hint: "refresh_token",
  }).catch(() => null);

  if (result?.ok) {
    return "revoked";
  }

  return result && isAlreadyRevoked(result) ? "alreadyRevoked" : "unconfirmed";
}
