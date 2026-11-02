import { afterEach, describe, expect, it, vi } from "vitest";
import { hangUpLiveCallSession } from "../live-call-session";
import { getLiveCallModel, isLiveCallAvailable } from "./live-call-provider";

vi.mock("server-only", () => ({}));

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

  it("blocks a hangup before an HTTP request leaves the process", async () => {
    setLiveKey("unused-test-openai-key");

    await expect(hangUpLiveCallSession("live_test")).rejects.toThrow(
      "Direct provider calls are disabled during tests.",
    );
  });
});
