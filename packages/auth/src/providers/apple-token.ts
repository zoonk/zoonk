import { getApplePublicKey } from "better-auth/social-providers";
import { decodeProtectedHeader, jwtVerify } from "jose";
import { getAppleAccountIssuer, getAppleConfiguration } from "./apple";
import { AppleAuthorizationError } from "./apple-rest";

const HEX_RADIX = 16;
const publicKeyPromises = new Map<string, ReturnType<typeof getApplePublicKey>>();

/**
 * Reuses Apple's signing key while validating both identity tokens from one
 * native authorization. A rejected lookup is removed so a temporary Apple
 * outage cannot poison this process until it restarts.
 */
function getCachedApplePublicKey(keyIdentifier: string) {
  const cached = publicKeyPromises.get(keyIdentifier);

  if (cached) {
    return cached;
  }

  const pending = getApplePublicKey(keyIdentifier).catch((error: unknown) => {
    publicKeyPromises.delete(keyIdentifier);
    throw error;
  });

  publicKeyPromises.set(keyIdentifier, pending);

  return pending;
}

/**
 * Keeps a temporary failure to load Apple's signing keys distinct from a bad
 * user credential so clients can retry instead of treating the login as invalid.
 */
async function getAvailableApplePublicKey(keyIdentifier: string) {
  try {
    return await getCachedApplePublicKey(keyIdentifier);
  } catch {
    throw new AppleAuthorizationError("unavailable");
  }
}

/**
 * Authentication Services hashes the raw nonce before adding it to Apple's
 * request. Accepting both representations also matches Better Auth's Apple
 * verifier, which keeps this explicit verification aligned with sign-in.
 */
async function nonceMatches({ claim, nonce }: { claim: unknown; nonce: string }) {
  if (typeof claim !== "string") {
    return false;
  }

  if (claim === nonce) {
    return true;
  }

  const encodedNonce = new TextEncoder().encode(nonce);
  const digest = await crypto.subtle.digest("SHA-256", encodedNonce);

  const hashedNonce = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(HEX_RADIX).padStart(2, "0"))
    .join("");

  return claim === hashedNonce;
}

/**
 * Validates that an identity token was signed by Apple for this native app and
 * returns its trusted issuer and stable Apple subject. Together they form the
 * Better Auth 1.7 identity that must match the existing Apple Account row.
 */
export async function verifyNativeAppleIdentityToken({
  nonce,
  token,
}: {
  nonce?: string;
  token: string;
}) {
  const configuration = getAppleConfiguration();
  const accountIssuer = getAppleAccountIssuer();

  if (!configuration || !accountIssuer) {
    throw new AppleAuthorizationError("configuration");
  }

  try {
    const protectedHeader = decodeProtectedHeader(token);

    if (protectedHeader.alg !== "RS256" || !protectedHeader.kid) {
      throw new AppleAuthorizationError("invalidCredential");
    }

    const { payload } = await jwtVerify(
      token,
      await getAvailableApplePublicKey(protectedHeader.kid),
      {
        algorithms: ["RS256"],
        audience: configuration.appBundleIdentifier,
        issuer: accountIssuer,
        maxTokenAge: "1h",
      },
    );

    const validNonce = nonce ? await nonceMatches({ claim: payload.nonce, nonce }) : true;

    if (!payload.iss || !payload.sub || !validNonce) {
      throw new AppleAuthorizationError("invalidCredential");
    }

    return { issuer: payload.iss, subject: payload.sub };
  } catch (error) {
    if (error instanceof AppleAuthorizationError) {
      throw error;
    }

    throw new AppleAuthorizationError("invalidCredential");
  }
}
