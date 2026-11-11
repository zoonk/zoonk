import { type StoredLogin } from "./credentials.ts";
import { CliError } from "./errors.ts";
import { type HttpResult, isRecord, postForm } from "./http.ts";

const CLIENT_ID = "zoonk-cli";
const SCOPE = "staff:read offline_access";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
/** RFC 8628 section 3.2: clients poll every 5 seconds when the server names no interval. */
const DEFAULT_POLL_SECONDS = 5;
const FIRST_SERVER_ERROR = 500;

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

export type TokenResult = { login: StoredLogin; ok: true } | { error: string; ok: false };

function unexpectedResponse(result: HttpResult): CliError {
  return new CliError(`The server answered with an unexpected response (HTTP ${result.status}).`);
}

function oauthError(result: HttpResult): string | null {
  return isRecord(result.body) && typeof result.body.error === "string" ? result.body.error : null;
}

function toLogin(result: HttpResult): StoredLogin {
  const body = result.body;

  if (
    !isRecord(body) ||
    typeof body.access_token !== "string" ||
    typeof body.refresh_token !== "string" ||
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

  const error = oauthError(result);

  if (!error) {
    throw unexpectedResponse(result);
  }

  return { error, ok: false };
}

export async function requestDeviceCode(origin: string): Promise<DeviceCode> {
  const result = await postForm(new URL(ENDPOINTS.deviceCode, origin), {
    client_id: CLIENT_ID,
    scope: SCOPE,
  });

  const body = result.body;

  if (
    !result.ok ||
    !isRecord(body) ||
    typeof body.device_code !== "string" ||
    typeof body.user_code !== "string" ||
    typeof body.verification_uri !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw unexpectedResponse(result);
  }

  return {
    deviceCode: body.device_code,
    expiresInSeconds: body.expires_in,
    intervalSeconds: typeof body.interval === "number" ? body.interval : DEFAULT_POLL_SECONDS,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    verificationUriComplete:
      typeof body.verification_uri_complete === "string"
        ? body.verification_uri_complete
        : undefined,
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

  if (result.status >= FIRST_SERVER_ERROR) {
    throw unexpectedResponse(result);
  }

  return toTokenResult(result);
}

/** Revoking the refresh token also ends the access tokens issued with it. */
export async function revokeLogin({
  origin,
  refreshToken,
}: {
  origin: string;
  refreshToken: string;
}): Promise<void> {
  const result = await postForm(new URL(ENDPOINTS.revoke, origin), {
    client_id: CLIENT_ID,
    token: refreshToken,
    token_type_hint: "refresh_token",
  });

  if (result.status >= FIRST_SERVER_ERROR) {
    throw unexpectedResponse(result);
  }
}
