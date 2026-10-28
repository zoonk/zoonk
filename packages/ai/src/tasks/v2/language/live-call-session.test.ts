import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockTestProviderFetch } from "../../../_utils/block-test-provider-fetch";
import { LiveCallCreationRefusedError } from "./live-call-creation";
import { createLiveCallSession, hangUpLiveCallSession } from "./live-call-session";

vi.mock("server-only", () => ({}));

/** Only the HTTP boundary is replaced: the real SDK turns each response into its error. */
vi.mock("../../../_utils/block-test-provider-fetch", () => ({ blockTestProviderFetch: vi.fn() }));

const SESSION = { instructions: "Be Linda.", sdp: "v=0\r\n", voice: "marin" };

function respond(status: number, body: string) {
  vi.mocked(blockTestProviderFetch).mockResolvedValue(
    new Response(body, { headers: { "Content-Type": "application/json" }, status }),
  );
}

function providerError(status: number) {
  respond(status, JSON.stringify({ error: { message: "Live session failed", type: "error" } }));
}

describe(createLiveCallSession, () => {
  beforeEach(() => {
    vi.mocked(blockTestProviderFetch).mockReset();
  });

  it("returns the provider's session ID and SDP answer", async () => {
    respond(
      201,
      JSON.stringify({
        session: { id: "live_123" },
        transport: { sdp: "v=0\r\ns=answer\r\n", type: "webrtc" },
      }),
    );

    await expect(createLiveCallSession(SESSION)).resolves.toStrictEqual({
      sdp: "v=0\r\ns=answer\r\n",
      sessionId: "live_123",
    });
  });

  it.each([400, 401, 403, 404, 413, 415, 422, 429])(
    "proves a %i answer created no session",
    async (status) => {
      providerError(status);

      const failure = await createLiveCallSession(SESSION).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(LiveCallCreationRefusedError);
      expect(failure).toMatchObject({ statusCode: status });
    },
  );

  it.each([408, 409, 500, 502, 503, 504])(
    "keeps a %i answer ambiguous, since the session may exist",
    async (status) => {
      providerError(status);

      const failure = await createLiveCallSession(SESSION).catch((error: unknown) => error);

      expect(APICallError.isInstance(failure)).toBe(true);
      expect(failure).not.toBeInstanceOf(LiveCallCreationRefusedError);
    },
  );

  it.each([
    [400, "<html><body>Bad Request</body></html>"],
    [422, ""],
    [429, "<html><body>Too Many Requests</body></html>"],
  ])("keeps a %i without OpenAI's own error body ambiguous", async (status, body) => {
    respond(status, body);

    const failure = await createLiveCallSession(SESSION).catch((error: unknown) => error);

    expect(APICallError.isInstance(failure)).toBe(true);
    expect(failure).not.toBeInstanceOf(LiveCallCreationRefusedError);
  });

  it("keeps an unreadable success ambiguous, since the session exists without a known ID", async () => {
    respond(201, "{");

    const failure = await createLiveCallSession(SESSION).catch((error: unknown) => error);

    expect(APICallError.isInstance(failure)).toBe(true);
    expect(failure).not.toBeInstanceOf(LiveCallCreationRefusedError);
  });

  it("keeps a dropped connection ambiguous, since the request may have arrived", async () => {
    vi.mocked(blockTestProviderFetch).mockRejectedValue(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      }),
    );

    const failure = await createLiveCallSession(SESSION).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(LiveCallCreationRefusedError);
  });
});

describe(hangUpLiveCallSession, () => {
  beforeEach(() => {
    vi.mocked(blockTestProviderFetch).mockReset();
  });

  it("posts to the session's hangup path and resolves once it ended", async () => {
    respond(200, "");

    await expect(hangUpLiveCallSession("live_123")).resolves.toBe("hungUp");

    const [url, init] = vi.mocked(blockTestProviderFetch).mock.calls[0] ?? [];

    expect(url).toStrictEqual(new URL("https://api.openai.com/v1/live/sessions/live_123/hangup"));
    expect(init?.method).toBe("POST");
  });

  it("says a session that already ended was already over", async () => {
    respond(
      404,
      JSON.stringify({
        error: { code: "session_id_not_found", message: "No session found", type: "error" },
      }),
    );

    await expect(hangUpLiveCallSession("live_123")).resolves.toBe("alreadyEnded");
  });

  it.each([
    [404, "<html><body>Not Found</body></html>"],
    [500, JSON.stringify({ error: { message: "Server error", type: "error" } })],
    [429, JSON.stringify({ error: { message: "Too many requests", type: "error" } })],
  ])("rejects a %i answer, since the session may still run", async (status, body) => {
    respond(status, body);

    await expect(hangUpLiveCallSession("live_123")).rejects.toThrow(String(status));
  });
});
