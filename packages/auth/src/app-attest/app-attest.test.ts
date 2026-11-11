import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORDED_APP,
  RECORDED_DEVELOPMENT_ATTESTATION,
  RECORDED_PRODUCTION_ATTESTATION,
} from "./_test-utils/recorded-attestations";
import { registerAppAttestKey } from "./app-attest";

async function issueRecordedChallenge(challenge: string, expiresInMs = 60_000) {
  await prisma.verification.create({
    data: {
      expiresAt: new Date(Date.now() + expiresInMs),
      identifier: `app-attest-challenge:${challenge}`,
      value: "app-attest",
    },
  });
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

      expect(results.toSorted((a, b) => Number(a) - Number(b))).toStrictEqual([false, true]);
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
});
