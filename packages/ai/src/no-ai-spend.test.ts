import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("no AI spend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each(["1", "true"])(
    "keeps paid providers offline with the switch set to %s",
    async (value) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VITEST", "false");
      vi.stubEnv("E2E_TESTING", "false");
      vi.stubEnv("ZOONK_NO_AI_SPEND", value);
      vi.stubEnv("AI_GATEWAY_API_KEY", "gateway-test-key");
      vi.stubEnv("OPENAI_API_KEY", "openai-test-key");
      const network = vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected network call"));
      vi.stubGlobal("fetch", network);

      const [{ zoonkGateway }, { directOpenAI }, { isLiveCallAvailable, liveCallFetch }] =
        await Promise.all([
          import("./gateway"),
          import("./direct-providers"),
          import("./tasks/language/_utils/live-call-provider"),
        ]);

      expect(isLiveCallAvailable()).toBe(false);

      const options = { maxRetries: 0, prompt: "Hello" };
      const blocked = /paid AI calls are disabled/iu;

      await expect(
        generateText({ ...options, model: zoonkGateway("openai/gpt-test") }),
      ).rejects.toThrow(blocked);

      await expect(generateText({ ...options, model: directOpenAI("gpt-test") })).rejects.toThrow(
        blocked,
      );

      await expect(liveCallFetch("https://api.openai.test/hangup")).rejects.toThrow(blocked);
      expect(network).not.toHaveBeenCalled();
    },
  );
});
