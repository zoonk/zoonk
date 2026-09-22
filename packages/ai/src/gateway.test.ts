import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { zoonkGateway } from "./gateway";

describe(zoonkGateway, () => {
  it("blocks provider requests during tests", async () => {
    await expect(
      generateText({ model: zoonkGateway("openai/gpt-6-luna"), prompt: "hello" }),
    ).rejects.toThrow("AI Gateway calls are disabled during tests.");
  });
});
