import { API_URL } from "@zoonk/utils/url";
import { type NativeAppleClient } from "./native-apple-contract";
import { getAppleConfiguration } from "./providers/apple";
import { AppleAuthorizationError } from "./providers/apple-rest";

/**
 * Where Apple form-posts the authorization the Android app asks for with the
 * Services ID: the API's stateless reflector (`/auth/apple/android`), which
 * hands it to the app. Apple binds the code to this address, so the exchange
 * sends it too.
 */
const WEB_REDIRECT_URI = new URL("/auth/apple/android", API_URL).toString();

/**
 * Picks the configured identifier for the client that issued the credentials,
 * never one taken from the request, so token verification, code exchange and
 * revocation all use the same one.
 */
export function getAppleClient(client: NativeAppleClient): {
  clientIdentifier: string;
  redirectURI?: string;
} {
  const configuration = getAppleConfiguration();

  if (!configuration) {
    throw new AppleAuthorizationError("configuration");
  }

  return client === "web"
    ? { clientIdentifier: configuration.clientId, redirectURI: WEB_REDIRECT_URI }
    : { clientIdentifier: configuration.appBundleIdentifier };
}
