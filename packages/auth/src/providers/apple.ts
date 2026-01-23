import { importPKCS8, SignJWT } from "jose";

let cached: { token: string; exp: number } | null = null;

const { APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } =
  process.env;

const hasAppleConfig =
  APPLE_TEAM_ID && APPLE_CLIENT_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY;

async function getAppleClientSecret(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.exp - 60 > now) {
    return cached.token;
  }

  const ttlSec = 2_592_000; // 1 month
  const privateKeyPEM = APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKeyPEM, "ES256");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID! })
    .setIssuer(APPLE_TEAM_ID!)
    .setSubject(APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key);

  cached = { exp: now + ttlSec, token };

  return token;
}

export const appleProvider = hasAppleConfig
  ? {
      apple: {
        clientId: APPLE_CLIENT_ID,
        clientSecret: await getAppleClientSecret(),
      },
    }
  : {};
