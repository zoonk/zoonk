import { describe, expect, it } from "vitest";
import { getPromptVersion } from "./prompt-version";

const PROMPT = "You write short lessons for adult learners.";

describe(getPromptVersion, () => {
  it("returns the same short hash for the same prompt", () => {
    const version = getPromptVersion({ systemPrompt: PROMPT });

    expect(version).toMatch(/^[\da-f]{12}$/u);
    expect(getPromptVersion({ systemPrompt: PROMPT })).toBe(version);
  });

  it("changes when the prompt text changes", () => {
    expect(getPromptVersion({ systemPrompt: `${PROMPT} Use one example.` })).not.toBe(
      getPromptVersion({ systemPrompt: PROMPT }),
    );
  });

  it("prefixes a task's manual version to the prompt hash", () => {
    const hash = getPromptVersion({ systemPrompt: PROMPT });

    expect(getPromptVersion({ systemPrompt: PROMPT, version: "v2" })).toBe(`v2-${hash}`);
  });
});
