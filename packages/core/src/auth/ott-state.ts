export const ONE_TIME_TOKEN_LOGIN_STATE_COOKIE = "zoonk-ott-login-state";
export const ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS = 10 * 60;

const LOGIN_STATE_BYTE_LENGTH = 32;
const HEX_RADIX = 16;

function byteToHex(byte: number): string {
  return byte.toString(HEX_RADIX).padStart(2, "0");
}

/** Unlike `randomUUID`, `getRandomValues` works on insecure LAN development origins. */
export function createLoginState(): string {
  const randomBytes = globalThis.crypto.getRandomValues(new Uint8Array(LOGIN_STATE_BYTE_LENGTH));

  return Array.from(randomBytes, byteToHex).join("");
}

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
