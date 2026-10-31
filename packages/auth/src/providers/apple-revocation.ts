import { decodeJwt } from "jose";
import { getAppleConfiguration } from "./apple";
import { revokeAppleToken } from "./apple-rest";

type StoredAppleAuthorization = { idToken: string | null; refreshToken: string | null };

/** Apple revokes a token only with its issuing client's identifier: the bundle ID or the Services ID. */
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

/** Best effort: answers false instead of throwing, so account deletion continues when Apple can't revoke. */
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
