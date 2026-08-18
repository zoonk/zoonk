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

/**
 * Exposes the complete server-only Apple configuration to the native token
 * exchange without allowing any request to choose a client identifier.
 */
export function getAppleConfiguration() {
  return appleConfiguration;
}

/**
 * Supplies Better Auth's required email field on repeat Apple sign-ins, where
 * Apple intentionally omits the email claim. The placeholder is never a
 * delivery address; the existing provider account remains anchored by the
 * stable Apple subject and keeps the real or relay email saved on first sign-in.
 */
function mapAppleProfileToUser(profile: AppleProfile) {
  return { email: profile.email ?? `${profile.sub}@apple.placeholder.local` };
}

/**
 * Signs a client secret for the identifier that will be sent to Apple. Web
 * authorization codes use the Services ID, while native codes use the app's
 * bundle identifier, so one globally cached secret would be invalid for one of
 * those two flows.
 */
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

  const ttlSec = 2_592_000; // 1 month
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

/**
 * Uses Better Auth's built-in provider metadata as the source of truth for the
 * canonical issuer persisted with Apple accounts.
 */
export function getAppleAccountIssuer() {
  return configuredAppleProvider?.accountIssuer;
}

/**
 * Gives the private native auth boundary an Apple provider that validates the
 * app bundle audience. The public provider intentionally omits this option so
 * Better Auth's generic social endpoint accepts only the web Services ID.
 */
export function getNativeAppleProvider() {
  if (!appleConfiguration || !appleProvider.apple) {
    return {};
  }

  return {
    apple: { ...appleProvider.apple, appBundleIdentifier: appleConfiguration.appBundleIdentifier },
  };
}
