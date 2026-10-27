import { afterEach, describe, expect, it, vi } from "vitest";
import { getLiveCallModel, isLiveCallAvailable } from "./live-call-provider";
import { closeLiveCallSideband } from "./live-call-sideband";

function setLiveKey(key?: string) {
  vi.stubEnv("OPENAI_API_KEY", key);
}

describe("Live call admission and test network guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("safely pauses admission when the OpenAI key is missing", () => {
    setLiveKey();

    expect(isLiveCallAvailable()).toBe(false);
  });

  it.each(["", "   "])("safely pauses admission with an empty key: %j", (key) => {
    setLiveKey(key);

    expect(isLiveCallAvailable()).toBe(false);
  });

  it("doesn't take the AI Gateway key for an OpenAI key", () => {
    setLiveKey();
    vi.stubEnv("AI_GATEWAY_API_KEY", "unused-test-gateway-key");

    expect(isLiveCallAvailable()).toBe(false);
  });

  it("reports configured admission without contacting a provider", () => {
    setLiveKey("unused-test-openai-key");

    expect(isLiveCallAvailable()).toBe(true);
  });

  /** No provider mock: the real SDK reaches the test-only blocked fetch, never the network. */
  it("blocks WebRTC creation before an HTTP request leaves the process", async () => {
    setLiveKey("unused-test-openai-key");

    await expect(getLiveCallModel().doCreateWebRTCSession({ sdp: "test-offer" })).rejects.toThrow(
      "Direct provider calls are disabled during tests.",
    );
  });

  it("blocks sideband attachment before a socket is constructed", async () => {
    setLiveKey("unused-test-openai-key");

    await expect(
      closeLiveCallSideband({
        deadlineAt: Date.now() + 15_000,
        headers: { Authorization: "Bearer unused-test-openai-key" },
        providerSessionId: "live_test",
        url: "wss://api.openai.com/v1/live/sessions",
      }),
    ).rejects.toThrow("Direct provider calls are disabled during tests.");
  });
});
