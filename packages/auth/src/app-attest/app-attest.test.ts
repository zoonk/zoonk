import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAssertion, makeDeviceKey } from "./_test-utils/assertion";
import {
  RECORDED_APP,
  RECORDED_DEVELOPMENT_ATTESTATION,
  RECORDED_PRODUCTION_ATTESTATION,
} from "./_test-utils/recorded-attestations";
import { hasAppAttestAssertion, issueAppAttestChallenge, registerAppAttestKey } from "./app-attest";
import { APP_ATTEST_HEADERS } from "./app-attest-contract";

/** The recorded attestations signed these challenges, so the test plays the server that issued them. */
async function issueRecordedChallenge(challenge: string, expiresInMs = 60_000) {
  await prisma.verification.create({
    data: {
      expiresAt: new Date(Date.now() + expiresInMs),
      identifier: `app-attest-challenge:${challenge}`,
      value: "app-attest",
    },
  });
}

async function registeredDeviceKey(signCount = 0) {
  const key = makeDeviceKey();

  await prisma.appAttestKey.create({
    data: { keyId: key.keyId, publicKey: key.publicKey, signCount },
  });

  return key;
}

function assertionHeaders({
  assertion,
  challenge,
  keyId,
}: {
  assertion: string;
  challenge: string;
  keyId: string;
}) {
  return new Headers({
    [APP_ATTEST_HEADERS.assertion]: assertion,
    [APP_ATTEST_HEADERS.challenge]: challenge,
    [APP_ATTEST_HEADERS.keyId]: keyId,
  });
}

async function signedRequest({
  counter,
  key,
  ...options
}: {
  appId?: string;
  counter: number;
  key: ReturnType<typeof makeDeviceKey>;
}) {
  const challenge = await issueAppAttestChallenge();
  const assertion = makeAssertion({ ...options, challenge, counter, privateKey: key.privateKey });

  return assertionHeaders({ assertion, challenge, keyId: key.keyId });
}

describe("App Attest", () => {
  beforeEach(async () => {
    vi.stubEnv("APPLE_TEAM_ID", RECORDED_APP.teamIdentifier);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");

    await prisma.appAttestKey.deleteMany({
      where: {
        keyId: {
          in: [RECORDED_PRODUCTION_ATTESTATION.keyId, RECORDED_DEVELOPMENT_ATTESTATION.keyId],
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("registering an attested key", () => {
    it("keeps the key a genuine copy of the app attested over the server's challenge", async () => {
      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);

      await expect(registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION)).resolves.toBe(true);

      const key = await prisma.appAttestKey.findUnique({
        where: { keyId: RECORDED_PRODUCTION_ATTESTATION.keyId },
      });

      expect(key).toMatchObject({ signCount: 0 });
      expect(key?.publicKey).toContain("BEGIN PUBLIC KEY");
    });

    it("spends the challenge, so the same attestation can't be sent twice", async () => {
      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);

      const results = await Promise.all([
        registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION),
        registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION),
      ]);

      expect(results.toSorted()).toStrictEqual([false, true]);
    });

    it("refuses a challenge the server didn't issue or that expired", async () => {
      await expect(registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION)).resolves.toBe(false);

      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge, -1000);
      await expect(registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION)).resolves.toBe(false);

      const key = await prisma.appAttestKey.findUnique({
        where: { keyId: RECORDED_PRODUCTION_ATTESTATION.keyId },
      });

      expect(key).toBeNull();
    });

    it("refuses an attestation made for another app or another key", async () => {
      vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "com.zoonk");
      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);
      await expect(registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION)).resolves.toBe(false);

      vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);
      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);

      await expect(
        registerAppAttestKey({
          ...RECORDED_PRODUCTION_ATTESTATION,
          keyId: RECORDED_DEVELOPMENT_ATTESTATION.keyId,
        }),
      ).resolves.toBe(false);
    });

    it("refuses an attestation over a different challenge", async () => {
      await issueRecordedChallenge(RECORDED_DEVELOPMENT_ATTESTATION.challenge);

      await expect(
        registerAppAttestKey({
          ...RECORDED_PRODUCTION_ATTESTATION,
          challenge: RECORDED_DEVELOPMENT_ATTESTATION.challenge,
        }),
      ).resolves.toBe(false);
    });

    it("accepts Xcode builds' development keys everywhere but production", async () => {
      await issueRecordedChallenge(RECORDED_DEVELOPMENT_ATTESTATION.challenge);
      await expect(registerAppAttestKey(RECORDED_DEVELOPMENT_ATTESTATION)).resolves.toBe(false);

      vi.stubEnv("VERCEL_ENV", "preview");
      await issueRecordedChallenge(RECORDED_DEVELOPMENT_ATTESTATION.challenge);
      await expect(registerAppAttestKey(RECORDED_DEVELOPMENT_ATTESTATION)).resolves.toBe(true);
    });

    it("keeps a registered key's counter when the same key registers again", async () => {
      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);
      await registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION);

      await prisma.appAttestKey.update({
        data: { signCount: 7 },
        where: { keyId: RECORDED_PRODUCTION_ATTESTATION.keyId },
      });

      await issueRecordedChallenge(RECORDED_PRODUCTION_ATTESTATION.challenge);
      await expect(registerAppAttestKey(RECORDED_PRODUCTION_ATTESTATION)).resolves.toBe(true);

      const key = await prisma.appAttestKey.findUnique({
        where: { keyId: RECORDED_PRODUCTION_ATTESTATION.keyId },
      });

      expect(key?.signCount).toBe(7);
    });
  });

  describe("an assertion on a request", () => {
    it("vouches for a request signed by a registered key and raises its counter", async () => {
      const key = await registeredDeviceKey();

      await expect(hasAppAttestAssertion(await signedRequest({ counter: 1, key }))).resolves.toBe(
        true,
      );

      const stored = await prisma.appAttestKey.findUnique({ where: { keyId: key.keyId } });
      expect(stored?.signCount).toBe(1);
    });

    it("refuses the same assertion sent again, even at once", async () => {
      const key = await registeredDeviceKey();
      const headers = await signedRequest({ counter: 1, key });

      const results = await Promise.all([
        hasAppAttestAssertion(headers),
        hasAppAttestAssertion(headers),
      ]);

      expect(results.toSorted()).toStrictEqual([false, true]);
      await expect(hasAppAttestAssertion(headers)).resolves.toBe(false);
    });

    it("refuses a counter that isn't above the last one accepted", async () => {
      const key = await registeredDeviceKey(5);

      await expect(hasAppAttestAssertion(await signedRequest({ counter: 5, key }))).resolves.toBe(
        false,
      );

      await expect(hasAppAttestAssertion(await signedRequest({ counter: 6, key }))).resolves.toBe(
        true,
      );
    });

    it("refuses a challenge the server didn't issue", async () => {
      const key = await registeredDeviceKey();
      const challenge = "made-up-challenge";
      const assertion = makeAssertion({ challenge, counter: 1, privateKey: key.privateKey });

      await expect(
        hasAppAttestAssertion(assertionHeaders({ assertion, challenge, keyId: key.keyId })),
      ).resolves.toBe(false);
    });

    it("refuses a key that never registered, a signature by another key, or another app", async () => {
      const registered = await registeredDeviceKey();
      const unregistered = makeDeviceKey();
      const challenge = await issueAppAttestChallenge();

      const forged = makeAssertion({ challenge, counter: 1, privateKey: unregistered.privateKey });

      const results = await Promise.all([
        hasAppAttestAssertion(await signedRequest({ counter: 1, key: unregistered })),
        hasAppAttestAssertion(
          assertionHeaders({ assertion: forged, challenge, keyId: registered.keyId }),
        ),
        hasAppAttestAssertion(
          await signedRequest({ appId: "V8H6LQ9448.com.zoonk", counter: 1, key: registered }),
        ),
      ]);

      expect(results).toStrictEqual([false, false, false]);
    });

    it("refuses a request without all three headers or with a malformed assertion", async () => {
      const key = await registeredDeviceKey();
      const challenge = await issueAppAttestChallenge();

      const results = await Promise.all([
        hasAppAttestAssertion(new Headers()),
        hasAppAttestAssertion(new Headers({ [APP_ATTEST_HEADERS.keyId]: key.keyId })),
        hasAppAttestAssertion(assertionHeaders({ assertion: "AAAA", challenge, keyId: key.keyId })),
      ]);

      expect(results).toStrictEqual([false, false, false]);
    });

    it("vouches for nothing until the server knows the app's App ID", async () => {
      vi.stubEnv("APPLE_TEAM_ID", "");
      const key = await registeredDeviceKey();

      await expect(hasAppAttestAssertion(await signedRequest({ counter: 1, key }))).resolves.toBe(
        false,
      );
    });
  });
});
