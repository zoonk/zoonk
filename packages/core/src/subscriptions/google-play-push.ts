import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { getGooglePlayServiceAccount } from "./google-play-api";
import { GooglePlayError } from "./google-play-error";

const googleSigningKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Only pushes Pub/Sub signs as Zoonk's own service account, for this endpoint, are accepted. */
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
