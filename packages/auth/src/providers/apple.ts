import { SignJWT, importPKCS8 } from "jose";

let cached: { token: string; exp: number } | null = null;

const { APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;

type AppleConfig = {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
};

const appleConfig: AppleConfig | null =
  APPLE_TEAM_ID && APPLE_CLIENT_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY
    ? {
        clientId: APPLE_CLIENT_ID,
        keyId: APPLE_KEY_ID,
        privateKey: APPLE_PRIVATE_KEY,
        teamId: APPLE_TEAM_ID,
      }
    : null;

async function getAppleClientSecret(config: AppleConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.exp - 60 > now) {
    return cached.token;
  }

  const ttlSec = 2_592_000; // 1 month
  const privateKeyPEM = config.privateKey.replaceAll(String.raw`\n`, "\n");
  const key = await importPKCS8(privateKeyPEM, "ES256");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(config.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key);

  cached = { exp: now + ttlSec, token };

  return token;
}

export const appleProvider = appleConfig
  ? {
      apple: {
        clientId: appleConfig.clientId,
        clientSecret: await getAppleClientSecret(appleConfig),
      },
    }
  : {};
