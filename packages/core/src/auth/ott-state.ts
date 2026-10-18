export const ONE_TIME_TOKEN_LOGIN_STATE_COOKIE = "zoonk-ott-login-state";
export const ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS = 10 * 60;

const LOGIN_STATE_BYTE_LENGTH = 32;
const HEX_RADIX = 16;

/** Encodes each random byte with a fixed width so the complete state can safely travel through cookies and URLs. */
function byteToHex(byte: number): string {
  return byte.toString(HEX_RADIX).padStart(2, "0");
}

/**
 * Creates the unpredictable state value that starts a login flow, on the server or in the browser.
 * `getRandomValues` remains available on insecure HTTP origins such as LAN development hosts, where
 * browsers do not expose `randomUUID`.
 */
export function createLoginState(): string {
  const randomBytes = globalThis.crypto.getRandomValues(new Uint8Array(LOGIN_STATE_BYTE_LENGTH));

  return Array.from(randomBytes, byteToHex).join("");
}

/**
 * Adds the browser-local state value to the app callback URL before it is sent
 * to the central auth app. The callback later compares this query value with
 * the login-state cookie to prove the same browser started the login flow.
 */
export function addLoginStateToCallbackUrl({
  callbackUrl,
  state,
}: {
  callbackUrl: string;
  state: string;
}): string {
  const url = new URL(callbackUrl);
  url.searchParams.set("state", state);
  return url.toString();
}
