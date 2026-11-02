import { auth } from "@zoonk/auth";
import { getString } from "@zoonk/utils/json";
import { callNativeAuthHandler } from "../native-auth-handler";

export async function createAppAttestChallenge({
  headers,
  requestURL,
}: {
  headers: Headers;
  requestURL: string;
}) {
  const response = await callNativeAuthHandler({
    body: {},
    handler: auth.handler,
    headers,
    path: "/app-attest/challenge",
    requestURL,
  });

  const challenge = getString(response, "challenge");

  if (!challenge) {
    throw new Error("App Attest did not issue a challenge");
  }

  return { challenge };
}

export async function createAppAttestKey({
  attestation,
  challenge,
  headers,
  keyId,
  requestURL,
}: {
  attestation: string;
  challenge: string;
  headers: Headers;
  keyId: string;
  requestURL: string;
}) {
  await callNativeAuthHandler({
    body: { attestation, challenge, keyId },
    handler: auth.handler,
    headers,
    path: "/app-attest/key",
    requestURL,
  });
}
