import { decodeJwt } from "jose";
import { getAppleConfiguration } from "./apple";
import { revokeAppleToken } from "./apple-rest";

type StoredAppleAuthorization = { idToken: string | null; refreshToken: string | null };

/**
 * Resolves which configured Apple client issued a previously verified token.
 * Native grants use the bundle identifier while web grants use the Services
 * ID, and Apple requires the matching identifier when a refresh token is
 * revoked.
 */
function getStoredAppleClientIdentifier(idToken: string) {
  const configuration = getAppleConfiguration();

  if (!configuration) {
    return null;
  }

  const audience = decodeJwt(idToken).aud;
  const audiences = Array.isArray(audience) ? audience : [audience];

  return (
    [configuration.appBundleIdentifier, configuration.clientId].find((clientIdentifier) =>
      audiences.includes(clientIdentifier),
    ) ?? null
  );
}

/**
 * Best-effort revokes an Apple grant already stored on Better Auth's Account
 * row. Deletion must continue when credentials are missing, Apple is down, or
 * a legacy row cannot identify its issuing client, so callers receive a
 * boolean outcome instead of a provider exception.
 */
export async function revokeStoredAppleAuthorization({
  idToken,
  refreshToken,
}: StoredAppleAuthorization) {
  if (!idToken || !refreshToken) {
    return false;
  }

  try {
    const clientIdentifier = getStoredAppleClientIdentifier(idToken);

    if (!clientIdentifier) {
      return false;
    }

    await revokeAppleToken({ clientIdentifier, token: refreshToken, tokenType: "refresh_token" });
    return true;
  } catch {
    return false;
  }
}
