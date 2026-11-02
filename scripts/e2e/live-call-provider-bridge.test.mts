import { describe, expect, it } from "vitest";
import { startLiveCallTestProvider } from "./live-call-provider-bridge.mts";

const NOT_FOUND = 404;

describe("the no-spend live-call bridge", () => {
  it("answers the hangup of a session it never made as OpenAI answers one that ended", async () => {
    const bridge = await startLiveCallTestProvider();

    try {
      const response = await fetch(`${bridge.url}/sessions/live_from_openai/hangup`, {
        method: "POST",
      });

      expect(response.status).toBe(NOT_FOUND);

      await expect(response.json()).resolves.toStrictEqual({
        error: { code: "session_id_not_found", message: "No session found" },
      });
    } finally {
      await bridge.close();
    }
  });
});
