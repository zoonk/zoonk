import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateLanguageLesson } from "./language-lesson";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./language-lesson.prompt.md", () => ({
  default: "Respell words:\n{{READER_RESPELLING}}\n- Stress the accent.",
}));

vi.mock("./language-lesson-respelling-pt.prompt.md", () => ({
  default: "- Portuguese readers.\n",
}));

vi.mock("./language-lesson-respelling-es.prompt.md", () => ({ default: "- Spanish readers.\n" }));
vi.mock("./language-lesson-respelling-en.prompt.md", () => ({ default: "- English readers.\n" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const LESSON = {
  learnerLanguage: "pt",
  lessonDescription: "Ask about the rent.",
  lessonTitle: "The rent",
  level: "A2",
  targetLanguage: "en",
  unitCanDos: ["Rent a flat"],
  unitTitle: "Renting",
};

describe(generateLanguageLesson, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({}));
  });

  it("adds the respelling rules of the learner's own language only", async () => {
    const portuguese = await generateLanguageLesson(LESSON);

    const english = await generateLanguageLesson({
      ...LESSON,
      learnerLanguage: "en",
      targetLanguage: "pt",
    });

    const german = await generateLanguageLesson({ ...LESSON, learnerLanguage: "de" });

    expect(portuguese.systemPrompt).toBe(
      "Respell words:\n- Portuguese readers.\n- Stress the accent.",
    );

    expect(english.systemPrompt).toBe("Respell words:\n- English readers.\n- Stress the accent.");
    expect(german.systemPrompt).toBe("Respell words:\n- Stress the accent.");
  });
});
