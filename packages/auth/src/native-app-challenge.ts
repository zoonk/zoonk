import { auth } from "@zoonk/auth";
import { getString } from "@zoonk/utils/json";
import { callNativeAuthHandler } from "./native-auth-handler";

export async function createAppChallenge({
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
    path: "/app-challenge",
    requestURL,
  });

  const challenge = getString(response, "challenge");

  if (!challenge) {
    throw new Error("Auth did not issue an app challenge");
  }

  return { challenge };
}
