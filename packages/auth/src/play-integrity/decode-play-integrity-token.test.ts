import { generateKeyPairSync } from "node:crypto";
import { decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodePlayIntegrityToken } from "./decode-play-integrity-token";

const DECODE_URL = "https://playintegrity.googleapis.com/v1/com.zoonk:decodeIntegrityToken";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const payload = {
  requestDetails: { requestHash: "request-hash", requestPackageName: "com.zoonk" },
};

const google = {
  decodeStatus: 200,
  requests: [] as { body?: BodyInit | null; headers: Headers; url: string }[],
};

async function googleFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = input instanceof Request ? input.url : input.toString();
  google.requests.push({ body: init?.body, headers: new Headers(init?.headers), url });

  if (url === TOKEN_URL) {
    return Response.json({ access_token: "google-access-token", expires_in: 3600 });
  }

  if (url === DECODE_URL) {
    return google.decodeStatus === 200
      ? Response.json({ tokenPayloadExternal: payload })
      : Response.json({ error: { status: "INVALID_ARGUMENT" } }, { status: google.decodeStatus });
  }

  throw new Error(`Unexpected request to ${url}`);
}

describe(decodePlayIntegrityToken, () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    google.decodeStatus = 200;
    google.requests = [];

    vi.stubEnv(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY",
      JSON.stringify({
        client_email: "play@zoonk-test.iam.gserviceaccount.com",
        private_key: privateKey.export({ format: "pem", type: "pkcs8" }),
      }),
    );

    vi.stubGlobal("fetch", vi.fn(googleFetch));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks Google to decode the token as the service account and answers its payload", async () => {
    await expect(decodePlayIntegrityToken("integrity-token")).resolves.toStrictEqual(payload);

    const tokenRequest = google.requests.find(({ url }) => url === TOKEN_URL);
    const decodeRequest = google.requests.find(({ url }) => url === DECODE_URL);
    const assertion = new URLSearchParams(tokenRequest?.body as URLSearchParams).get("assertion");

    expect(decodeJwt(assertion ?? "").scope).toContain(
      "https://www.googleapis.com/auth/playintegrity",
    );

    expect(JSON.parse(decodeRequest?.body as string)).toStrictEqual({
      integrity_token: "integrity-token",
    });

    expect(decodeRequest?.headers.get("authorization")).toBe("Bearer google-access-token");
  });

  it("answers null for a token Google refuses", async () => {
    google.decodeStatus = 400;

    await expect(decodePlayIntegrityToken("forged-token")).resolves.toBeNull();
  });
});
