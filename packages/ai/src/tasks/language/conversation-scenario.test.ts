import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateConversationScenario } from "./conversation-scenario";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./conversation-scenario.prompt.md", async () => {
  const { readFileSync } = await import("node:fs");

  return {
    default: readFileSync(new URL("conversation-scenario.prompt.md", import.meta.url), "utf8"),
  };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const UNIT = {
  canDo: ["Ask for a table", "Order food and drinks"],
  level: "A1" as const,
  unitDescription: "Ask for a table and order at a restaurant",
  unitTitle: "At a restaurant",
};

describe(generateConversationScenario, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({}));
  });

  it("keeps the title out of the practiced language only when the learner reads another one", async () => {
    const portuguese = await generateConversationScenario({
      ...UNIT,
      learnerLanguage: "pt",
      targetLanguage: "en",
    });

    const english = await generateConversationScenario({
      ...UNIT,
      learnerLanguage: "en",
      targetLanguage: "en",
    });

    expect(portuguese.systemPrompt).toContain(
      "- `title`: in Português Brasileiro, never in US English, the goal",
    );

    expect(english.systemPrompt).toContain("- `title`: in US English, the goal");
    expect(english.systemPrompt).not.toContain("never in");
  });
});
