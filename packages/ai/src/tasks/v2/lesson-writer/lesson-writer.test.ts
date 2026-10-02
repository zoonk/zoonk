import { describe, expect, it, vi } from "vitest";
import { getLessonRewriteModel } from "./lesson-writer";

vi.mock("server-only", () => ({}));
vi.mock("./lesson-writer.prompt.md", () => ({ default: "Write the lesson." }));

describe(getLessonRewriteModel, () => {
  it("picks the writer chain's first model from a family whose drafts weren't held back", () => {
    expect(getLessonRewriteModel(["openai/gpt-6-sol", "openai/gpt-6-sol"])).toBe(
      "anthropic/claude-opus-5.5",
    );

    expect(getLessonRewriteModel(["google/gemini-3.8-flash", "google/gemini-3.8-flash"])).toBe(
      "openai/gpt-6-sol",
    );

    // A fallback wrote one of them: both families are left out.
    expect(getLessonRewriteModel(["openai/gpt-6-sol", "anthropic/claude-opus-5.5"])).toBe(
      "google/gemini-3.8-flash",
    );
  });
});
