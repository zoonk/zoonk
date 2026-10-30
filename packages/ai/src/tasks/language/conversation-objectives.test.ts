import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkConversationObjectives } from "./conversation-objectives";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./conversation-objectives.prompt.md", () => ({ default: "Check the objectives." }));
vi.mock("./conversation-objectives-test.prompt.md", () => ({ default: "How a test part ends." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const CALL = {
  characterNotes: "Notes.",
  learnerLanguage: "pt",
  objectives: [{ description: "Answer about yourself.", label: "Part 1" }],
  situation: "A mock.",
  targetLanguage: "en",
  turns: [{ speaker: "learner" as const, text: "My name is Ana." }],
};

describe(checkConversationObjectives, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ met: [] }));
  });

  it("explains how a test part ends only for a speaking mock", async () => {
    const rolePlay = await checkConversationObjectives({ ...CALL, exam: null });
    const mock = await checkConversationObjectives({ ...CALL, exam: "ielts" });

    expect(rolePlay.systemPrompt).toBe("Check the objectives.");
    expect(mock.systemPrompt).toBe("Check the objectives.\nHow a test part ends.");
  });
});
