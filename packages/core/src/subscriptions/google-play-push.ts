import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { getGooglePlayServiceAccount } from "./google-play-api";
import { GooglePlayError } from "./google-play-error";

/** The keys Google signs its OpenID Connect ID tokens with, Pub/Sub's push tokens among them. */
const googleSigningKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * Pub/Sub signs each push with an ID token for the push subscription's service account and
 * audience. Only Zoonk's own service account (the one reading Play purchases) may push.
 */
export async function verifyGooglePlayPush({
  audience,
  authorization,
}: {
  audience: string;
  authorization: string | null;
}) {
  const token = /^Bearer (?<token>\S+)$/u.exec(authorization ?? "")?.groups?.token;

  if (!token) {
    throw new GooglePlayError("unauthorized");
  }

  const { email } = getGooglePlayServiceAccount();

  try {
    const { payload } = await jwtVerify(token, googleSigningKeys, {
      audience,
      issuer: GOOGLE_ISSUERS,
    });

    if (payload.email !== email || payload.email_verified !== true) {
      throw new GooglePlayError("unauthorized");
    }
  } catch (error) {
    /** Google's signing keys not loading in time is an outage, not a forged push. */
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
      throw new GooglePlayError("unauthorized", { cause: error });
    }

    throw error;
  }
}
