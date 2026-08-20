import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import { z } from "zod";
import { AppleStoreError } from "./apple-store-error";
import { APPLE_ROOT_CERTIFICATES } from "./resources/apple-root-certificates";

export type AppleSubscriptionEnvironment = "production" | "sandbox" | "xcode";

type SignedDataKind = "notification" | "transaction";

type AppStoreServerConfiguration = { issuerId: string; keyId: string; privateKey: string };

const recordSchema = z.record(z.string(), z.unknown());

function getBundleId() {
  return process.env.APPLE_IAP_BUNDLE_ID?.trim() || "com.zoonk";
}

function getXcodeBundleId() {
  return process.env.APPLE_IAP_XCODE_BUNDLE_ID?.trim() || "com.zoonk.dev";
}

function getUnverifiedPayload(signedData: string) {
  const payload = signedData.split(".")[1];

  if (!payload) {
    throw new AppleStoreError("invalidTransaction");
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const result = recordSchema.safeParse(decoded);

    return result.success ? result.data : null;
  } catch (error) {
    throw new AppleStoreError("invalidTransaction", { cause: error });
  }
}

function getRecord(value: unknown) {
  const result = recordSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Reads only enough untrusted JWS metadata to select Apple's environment-specific verifier.
 * The selected verifier still authenticates every claim before use.
 */
function getClaimedEnvironment({ kind, signedData }: { kind: SignedDataKind; signedData: string }) {
  const payload = getUnverifiedPayload(signedData);

  const metadata =
    kind === "transaction"
      ? payload
      : (getRecord(payload?.data) ?? getRecord(payload?.summary) ?? getRecord(payload?.appData));

  switch (metadata?.environment) {
    case Environment.PRODUCTION:
      return Environment.PRODUCTION;
    case Environment.SANDBOX:
      return Environment.SANDBOX;
    case Environment.XCODE:
      return Environment.XCODE;
    default:
      throw new AppleStoreError("invalidTransaction");
  }
}

function getProductionAppId() {
  const value = process.env.APPLE_IAP_APP_ID?.trim();
  const appId = value ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new AppleStoreError("configuration");
  }

  return appId;
}

function assertXcodeTransactionsAllowed() {
  const isTestRuntime = process.env.NODE_ENV !== "production" || process.env.E2E_TESTING === "true";

  if (!isTestRuntime || process.env.APPLE_IAP_ALLOW_XCODE_TRANSACTIONS !== "true") {
    throw new AppleStoreError("invalidTransaction");
  }
}

/**
 * Live App Store data uses certificate revocation checks and app identity validation.
 * Xcode data stays behind a separate non-production gate.
 */
function createVerifier(environment: Environment) {
  if (environment === Environment.XCODE) {
    assertXcodeTransactionsAllowed();

    return new SignedDataVerifier(
      APPLE_ROOT_CERTIFICATES,
      false,
      Environment.XCODE,
      getXcodeBundleId(),
    );
  }

  return new SignedDataVerifier(
    APPLE_ROOT_CERTIFICATES,
    true,
    environment,
    getBundleId(),
    environment === Environment.PRODUCTION ? getProductionAppId() : undefined,
  );
}

export function getSignedDataVerifier({
  kind,
  signedData,
}: {
  kind: SignedDataKind;
  signedData: string;
}) {
  const environment = getClaimedEnvironment({ kind, signedData });
  return { environment, verifier: createVerifier(environment) };
}

/**
 * Fails closed unless one complete In-App Purchase key is configured because partial
 * credentials cannot authenticate current-state lookups.
 */
function getServerConfiguration() {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim();
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim();
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY?.trim();
  const configuredValues = [issuerId, keyId, privateKey].filter(Boolean);

  if (configuredValues.length === 0) {
    throw new AppleStoreError("configuration");
  }

  if (!issuerId || !keyId || !privateKey) {
    throw new AppleStoreError("configuration");
  }

  return {
    issuerId,
    keyId,
    privateKey: privateKey.replaceAll(String.raw`\n`, "\n"),
  } satisfies AppStoreServerConfiguration;
}

/** Xcode has no App Store Server API state; live environments must use Apple as the current-chain authority. */
export function getAppStoreServerClient(environment: Environment) {
  if (environment === Environment.XCODE) {
    return null;
  }

  const configuration = getServerConfiguration();

  return new AppStoreServerAPIClient(
    configuration.privateKey,
    configuration.keyId,
    configuration.issuerId,
    getBundleId(),
    environment,
  );
}

export function normalizeAppleEnvironment(
  environment: Environment | string | undefined,
): AppleSubscriptionEnvironment {
  if (environment === Environment.PRODUCTION) {
    return "production";
  }

  if (environment === Environment.SANDBOX) {
    return "sandbox";
  }

  if (environment === Environment.XCODE) {
    assertXcodeTransactionsAllowed();
    return "xcode";
  }

  throw new AppleStoreError("invalidTransaction");
}
