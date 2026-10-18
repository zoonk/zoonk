import { afterEach, describe, expect, it, vi } from "vitest";
import { getLiveCallModel, isLiveCallAvailable } from "./live-call-provider";
import { closeLiveCallSideband } from "./live-call-sideband";

function setLiveKey(key?: string) {
  vi.stubEnv("OPENAI_LIVE_API_KEY", key);
}

describe("Live call admission and test network guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("safely pauses admission when the dedicated key is missing", () => {
    setLiveKey();

    expect(isLiveCallAvailable()).toBe(false);
  });

  it.each(["", "   "])("safely pauses admission with an empty key: %j", (key) => {
    setLiveKey(key);

    expect(isLiveCallAvailable()).toBe(false);
  });

  it("checks only the dedicated live key", () => {
    setLiveKey();
    vi.stubEnv("OPENAI_API_KEY", "unused-test-key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "unused-test-gateway-key");

    expect(isLiveCallAvailable()).toBe(false);
  });

  it("reports configured admission without contacting a provider", () => {
    setLiveKey("unused-test-live-key");

    expect(isLiveCallAvailable()).toBe(true);
  });

  /** No provider mock: the real SDK reaches the test-only blocked fetch, never the network. */
  it("blocks WebRTC creation before an HTTP request leaves the process", async () => {
    setLiveKey("unused-test-live-key");

    await expect(getLiveCallModel().doCreateWebRTCSession({ sdp: "test-offer" })).rejects.toThrow(
      "Direct provider calls are disabled during tests.",
    );
  });

  it("blocks sideband attachment before a socket is constructed", async () => {
    setLiveKey("unused-test-live-key");

    await expect(
      closeLiveCallSideband({
        deadlineAt: Date.now() + 15_000,
        headers: { Authorization: "Bearer unused-test-live-key" },
        providerSessionId: "live_test",
        url: "wss://api.openai.com/v1/live/sessions",
      }),
    ).rejects.toThrow("Direct provider calls are disabled during tests.");
  });
});
