import { getApplePublicKey } from "better-auth/social-providers";
import { decodeProtectedHeader, jwtVerify } from "jose";
import { getAppleIdentityTokenIssuer } from "./apple";
import { AppleAuthorizationError } from "./apple-rest";

const HEX_RADIX = 16;
const publicKeyPromises = new Map<string, ReturnType<typeof getApplePublicKey>>();

/** A rejected lookup is dropped so a temporary Apple outage can't poison the cache until a restart. */
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

async function getAvailableApplePublicKey(keyIdentifier: string) {
  try {
    return await getCachedApplePublicKey(keyIdentifier);
  } catch {
    throw new AppleAuthorizationError("unavailable");
  }
}

/** Only the raw nonce passes, so an intercepted token's claim sent back as the nonce fails. */
async function nonceMatches({ claim, nonce }: { claim: unknown; nonce: string }) {
  if (typeof claim !== "string") {
    return false;
  }

  const encodedNonce = new TextEncoder().encode(nonce);
  const digest = await crypto.subtle.digest("SHA-256", encodedNonce);

  const hashedNonce = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(HEX_RADIX).padStart(2, "0"))
    .join("");

  return claim === hashedNonce;
}

export async function verifyNativeAppleIdentityToken({
  clientIdentifier,
  nonce,
  token,
}: {
  clientIdentifier: string;
  nonce?: string;
  token: string;
}) {
  const issuer = getAppleIdentityTokenIssuer();

  if (!issuer) {
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
      { algorithms: ["RS256"], audience: clientIdentifier, issuer, maxTokenAge: "1h" },
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
