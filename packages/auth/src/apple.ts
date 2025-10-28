import { importPKCS8, SignJWT } from "jose";

interface CachedToken {
  token: string;
  exp: number;
}

const MS_IN_SECOND = 1000;

let cached: CachedToken | null = null;

export async function getAppleClientSecret(): Promise<string> {
  const now = Math.floor(Date.now() / MS_IN_SECOND);
  const isTokenValid = cached && cached.exp - 60 > now;

  if (cached && isTokenValid) {
    return cached.token;
  }

  const teamId = process.env.APPLE_TEAM_ID as string;
  const clientId = process.env.APPLE_CLIENT_ID as string;
  const keyId = process.env.APPLE_KEY_ID as string;
  const ttlSec = 2_592_000; // 1 month

  const privateKeyPEM = (process.env.APPLE_PRIVATE_KEY as string).replace(
    /\\n/g,
    "\n",
  );

  const key = await importPKCS8(privateKeyPEM, "ES256");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key);

  cached = { exp: now + ttlSec, token };

  return token;
}
