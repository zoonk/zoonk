import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateLanguageLesson } from "./language-lesson";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./language-lesson.prompt.md", () => ({
  default:
    "Respell words:\n{{READER_RESPELLING}}\n- Stress the accent.\nReply in {{TARGET_LANGUAGE}}, explain in {{LEARNER_LANGUAGE}}.",
}));

vi.mock("./language-lesson-respelling-pt.prompt.md", () => ({
  default: "- Portuguese readers.\n",
}));

vi.mock("./language-lesson-fix.prompt.md", () => ({ default: "Fix the problems." }));

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

  it("sends fast speed to the gateway on the same writer model", async () => {
    await generateLanguageLesson({ ...LESSON, speed: "fast" });

    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-6.1-terra",
      providerOptions: { gateway: { speed: "fast" } },
    });
  });

  it("adds the respelling rules of the learner's own language only", async () => {
    const portuguese = await generateLanguageLesson(LESSON);

    const english = await generateLanguageLesson({
      ...LESSON,
      learnerLanguage: "en",
      targetLanguage: "pt",
    });

    const german = await generateLanguageLesson({ ...LESSON, learnerLanguage: "de" });

    expect(portuguese.systemPrompt).toMatch(
      /^Respell words:\n- Portuguese readers\.\n- Stress the accent\.\n/u,
    );

    expect(english.systemPrompt).toMatch(
      /^Respell words:\n- English readers\.\n- Stress the accent\.\n/u,
    );

    expect(german.systemPrompt).toMatch(/^Respell words:\n- Stress the accent\.\n/u);
  });

  it("names the practiced and the learner's language in the rules", async () => {
    const { systemPrompt } = await generateLanguageLesson(LESSON);

    expect(systemPrompt).toContain("Reply in US English, explain in Português Brasileiro.");
  });
});
