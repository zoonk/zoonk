export const ONE_TIME_TOKEN_LOGIN_STATE_COOKIE = "zoonk-ott-login-state";
export const ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS = 10 * 60;

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
