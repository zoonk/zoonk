import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueAppChallenge } from "../request-guards/app-challenge";
import { decodePlayIntegrityToken } from "./decode-play-integrity-token";
import { type PlayIntegrityBinding, hasPlayIntegrityProof } from "./play-integrity";
import { PLAY_INTEGRITY_HEADERS } from "./play-integrity-contract";

/** Google decrypts the token; everything Zoonk checks about its answer stays real. */
vi.mock("./decode-play-integrity-token", () => ({ decodePlayIntegrityToken: vi.fn() }));

const RESTORE_KEY: PlayIntegrityBinding = { fields: ["credential-1"], operation: "restore-key" };

const OTHER_KEY: PlayIntegrityBinding = { fields: ["credential-2"], operation: "restore-key" };

function requestHash({ binding, challenge }: { binding: PlayIntegrityBinding; challenge: string }) {
  const clientData = ["zoonk-app-attest:1", challenge, binding.operation, ...binding.fields];
  return createHash("sha256").update(clientData.join("\n")).digest("base64url");
}

function decodedToken({
  appRecognitionVerdict = "PLAY_RECOGNIZED",
  binding = RESTORE_KEY,
  challenge,
  deviceRecognitionVerdict = ["MEETS_DEVICE_INTEGRITY"],
  requestPackageName = "com.zoonk",
}: {
  appRecognitionVerdict?: string;
  binding?: PlayIntegrityBinding;
  challenge: string;
  deviceRecognitionVerdict?: string[];
  requestPackageName?: string;
}) {
  return {
    accountDetails: { appLicensingVerdict: "LICENSED" },
    appIntegrity: { appRecognitionVerdict, packageName: requestPackageName },
    deviceIntegrity: { deviceRecognitionVerdict },
    requestDetails: {
      requestHash: requestHash({ binding, challenge }),
      requestPackageName,
      timestampMillis: String(Date.now()),
    },
  };
}

function proofHeaders(challenge: string) {
  return new Headers({
    [PLAY_INTEGRITY_HEADERS.challenge]: challenge,
    [PLAY_INTEGRITY_HEADERS.token]: "play-integrity-token",
  });
}

async function proveWith(token: (challenge: string) => unknown, binding = RESTORE_KEY) {
  const challenge = await issueAppChallenge();
  vi.mocked(decodePlayIntegrityToken).mockResolvedValueOnce(token(challenge));
  return hasPlayIntegrityProof({ binding, headers: proofHeaders(challenge) });
}

describe(hasPlayIntegrityProof, () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("E2E_TESTING", "false");
    vi.mocked(decodePlayIntegrityToken).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a token the app made for this request over a fresh challenge", async () => {
    const challenge = await issueAppChallenge();
    vi.mocked(decodePlayIntegrityToken).mockResolvedValue(decodedToken({ challenge }));

    await expect(
      hasPlayIntegrityProof({ binding: RESTORE_KEY, headers: proofHeaders(challenge) }),
    ).resolves.toBe(true);

    expect(decodePlayIntegrityToken).toHaveBeenCalledExactlyOnceWith("play-integrity-token");

    // The challenge is spent: the same proof never counts twice, and Google isn't asked again.
    await expect(
      hasPlayIntegrityProof({ binding: RESTORE_KEY, headers: proofHeaders(challenge) }),
    ).resolves.toBe(false);

    expect(decodePlayIntegrityToken).toHaveBeenCalledOnce();
  });

  it("refuses a token made for another restore key or app", async () => {
    await expect(proveWith((challenge) => decodedToken({ challenge }), OTHER_KEY)).resolves.toBe(
      false,
    );

    await expect(
      proveWith(
        (challenge) =>
          decodedToken({ binding: { ...OTHER_KEY, fields: ["credential-3"] }, challenge }),
        OTHER_KEY,
      ),
    ).resolves.toBe(false);

    await expect(
      proveWith((challenge) => decodedToken({ challenge, requestPackageName: "com.zoonk.fake" })),
    ).resolves.toBe(false);
  });

  it("refuses a challenge this server never issued without asking Google", async () => {
    await expect(
      hasPlayIntegrityProof({ binding: RESTORE_KEY, headers: proofHeaders("never-issued") }),
    ).resolves.toBe(false);

    expect(decodePlayIntegrityToken).not.toHaveBeenCalled();
  });

  it("refuses a request whose fields would break the client data's lines", async () => {
    const challenge = await issueAppChallenge();

    await expect(
      hasPlayIntegrityProof({
        binding: { fields: ["credential\nother"], operation: "restore-key" },
        headers: proofHeaders(challenge),
      }),
    ).resolves.toBe(false);

    expect(decodePlayIntegrityToken).not.toHaveBeenCalled();
  });

  it("treats a token Google refuses, or Google failing, as no proof", async () => {
    await expect(proveWith(() => null)).resolves.toBe(false);

    const challenge = await issueAppChallenge();
    vi.mocked(decodePlayIntegrityToken).mockRejectedValueOnce(new Error("Google unavailable"));

    await expect(
      hasPlayIntegrityProof({ binding: RESTORE_KEY, headers: proofHeaders(challenge) }),
    ).resolves.toBe(false);
  });

  it("takes a test build in previews, checking only the package and the request", async () => {
    await expect(
      proveWith((challenge) =>
        decodedToken({
          appRecognitionVerdict: "UNRECOGNIZED_VERSION",
          challenge,
          deviceRecognitionVerdict: [],
        }),
      ),
    ).resolves.toBe(true);
  });

  it("takes only Play's copy of the app on a certified device in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const sideloaded = await proveWith((challenge) =>
      decodedToken({ appRecognitionVerdict: "UNRECOGNIZED_VERSION", challenge }),
    );

    const uncertified = await proveWith((challenge) =>
      decodedToken({ challenge, deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY"] }),
    );

    const genuine = await proveWith((challenge) => decodedToken({ challenge }));

    expect([sideloaded, uncertified, genuine]).toStrictEqual([false, false, true]);
  });
});
