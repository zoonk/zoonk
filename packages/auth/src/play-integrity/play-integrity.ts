import { createHash } from "node:crypto";
import { getEnvironment } from "@zoonk/utils/environment";
import { z } from "zod";
import { type AppAttestBinding, getAppAttestClientData } from "../app-attest/app-attest-contract";
import { GOOGLE_PLAY_PACKAGE_NAME } from "../google/service-account";
import { consumeAppChallenge } from "../request-guards/app-challenge";
import { decodePlayIntegrityToken } from "./decode-play-integrity-token";
import { PLAY_INTEGRITY_HEADERS, playIntegrityHeadersSchema } from "./play-integrity-contract";

const verdictSchema = z.object({
  appIntegrity: z.object({ appRecognitionVerdict: z.string() }),
  deviceIntegrity: z.object({ deviceRecognitionVerdict: z.array(z.string()).optional() }),
  requestDetails: z.object({ requestHash: z.string(), requestPackageName: z.string() }),
});

/** The Android app sets the token's request hash to this, so both must build it the same way. */
function getRequestHash({ binding, challenge }: { binding: AppAttestBinding; challenge: string }) {
  return createHash("sha256")
    .update(getAppAttestClientData({ binding, challenge }))
    .digest("base64url");
}

/** Previews also take a test build or an emulator; production takes only Play's copy on a certified device. */
function isTrustedApp(verdict: z.infer<typeof verdictSchema>) {
  return (
    getEnvironment() !== "production" ||
    (verdict.appIntegrity.appRecognitionVerdict === "PLAY_RECOGNIZED" &&
      (verdict.deviceIntegrity.deviceRecognitionVerdict ?? []).includes("MEETS_DEVICE_INTEGRITY"))
  );
}

/**
 * Spends the challenge before asking Google, so a token never counts twice and each decode costs a
 * fresh challenge. Any failure, Google's included, is no proof.
 */
export async function hasPlayIntegrityProof({
  binding,
  headers,
}: {
  binding: AppAttestBinding;
  headers: Headers;
}): Promise<boolean> {
  const parsed = playIntegrityHeadersSchema.safeParse({
    [PLAY_INTEGRITY_HEADERS.challenge]: headers.get(PLAY_INTEGRITY_HEADERS.challenge),
    [PLAY_INTEGRITY_HEADERS.token]: headers.get(PLAY_INTEGRITY_HEADERS.token),
  });

  if (!parsed.success || binding.fields.some((field) => field.includes("\n"))) {
    return false;
  }

  const { [PLAY_INTEGRITY_HEADERS.challenge]: challenge, [PLAY_INTEGRITY_HEADERS.token]: token } =
    parsed.data;

  if (!(await consumeAppChallenge(challenge))) {
    return false;
  }

  const verdict = verdictSchema.safeParse(await decodePlayIntegrityToken(token).catch(() => null));

  return (
    verdict.success &&
    verdict.data.requestDetails.requestPackageName === GOOGLE_PLAY_PACKAGE_NAME &&
    verdict.data.requestDetails.requestHash === getRequestHash({ binding, challenge }) &&
    isTrustedApp(verdict.data)
  );
}
