import { type AppleProfile, apple } from "better-auth/social-providers";
import { SignJWT, importPKCS8 } from "jose";

const cachedClientSecrets = new Map<string, { token: string; exp: number }>();

const {
  APPLE_APP_BUNDLE_IDENTIFIER,
  APPLE_TEAM_ID,
  APPLE_CLIENT_ID,
  APPLE_KEY_ID,
  APPLE_PRIVATE_KEY,
} = process.env;

export type AppleSigningConfiguration = {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
};

export type AppleConfiguration = AppleSigningConfiguration & { appBundleIdentifier: string };

const appleSigningConfiguration: AppleSigningConfiguration | null =
  APPLE_TEAM_ID && APPLE_CLIENT_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY
    ? {
        clientId: APPLE_CLIENT_ID,
        keyId: APPLE_KEY_ID,
        privateKey: APPLE_PRIVATE_KEY,
        teamId: APPLE_TEAM_ID,
      }
    : null;

const appleConfiguration: AppleConfiguration | null =
  APPLE_APP_BUNDLE_IDENTIFIER && appleSigningConfiguration
    ? { ...appleSigningConfiguration, appBundleIdentifier: APPLE_APP_BUNDLE_IDENTIFIER }
    : null;

export function getAppleConfiguration() {
  return appleConfiguration;
}

/**
 * Apple omits the email on repeat sign-ins, but Better Auth requires one. The placeholder is never a
 * delivery address; the account keeps the email saved on first sign-in.
 */
function mapAppleProfileToUser(profile: AppleProfile) {
  return { email: profile.email ?? `${profile.sub}@apple.placeholder.local` };
}

/** Web codes use the Services ID and native codes the bundle ID, so each needs its own secret. */
export async function getAppleClientSecret({
  clientIdentifier,
  configuration,
}: {
  clientIdentifier: string;
  configuration: AppleSigningConfiguration;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedClientSecrets.get(clientIdentifier);

  if (cached && cached.exp - 60 > now) {
    return cached.token;
  }

  const ttlSec = 30 * 24 * 60 * 60;
  const privateKeyPEM = configuration.privateKey.replaceAll(String.raw`\n`, "\n");
  const key = await importPKCS8(privateKeyPEM, "ES256");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: configuration.keyId })
    .setIssuer(configuration.teamId)
    .setSubject(clientIdentifier)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key);

  cachedClientSecrets.set(clientIdentifier, { exp: now + ttlSec, token });

  return token;
}

export const appleProvider = appleSigningConfiguration
  ? {
      apple: {
        clientId: appleSigningConfiguration.clientId,
        clientSecret: await getAppleClientSecret({
          clientIdentifier: appleSigningConfiguration.clientId,
          configuration: appleSigningConfiguration,
        }),
        mapProfileToUser: mapAppleProfileToUser,
      },
    }
  : {};

const configuredAppleProvider = appleProvider.apple ? apple(appleProvider.apple) : null;

export function getAppleIdentityTokenIssuer() {
  return configuredAppleProvider?.idToken.issuer;
}

/** The public provider omits the bundle audience, so Better Auth's social endpoint accepts only the web Services ID. */
export function getNativeAppleProvider() {
  if (!appleConfiguration || !appleProvider.apple) {
    return {};
  }

  return {
    apple: { ...appleProvider.apple, appBundleIdentifier: appleConfiguration.appBundleIdentifier },
  };
}
