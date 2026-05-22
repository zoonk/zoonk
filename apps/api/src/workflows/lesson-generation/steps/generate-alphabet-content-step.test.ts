import { generateLessonAlphabet } from "@zoonk/ai/tasks/lessons/language/alphabet";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateAlphabetContentStep } from "./generate-alphabet-content-step";

vi.mock("@zoonk/ai/tasks/lessons/language/alphabet", () => ({
  generateLessonAlphabet: vi
    .fn()
    .mockResolvedValue({
      data: {
        intro: [
          {
            text: "The K row is k plus each vowel: か (ka), き (ki), く (ku), け (ke), こ (ko).",
            title: "The K row",
          },
        ],
        symbols: [
          {
            audioText: "か",
            forms: [],
            pronunciation: "ka, with a short a",
            readingAid: "ka",
            symbol: "か",
          },
        ],
      },
    }),
}));

describe(generateAlphabetContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates the complete alphabet lesson content in one task", async () => {
    const context = await createLessonContext({
      kind: "alphabet",
      organizationId,
      targetLanguage: "ja",
      titlePrefix: "K row かきくけこ",
    });

    const result = await generateAlphabetContentStep(context);

    expect(result.kind).toBe("alphabet");
    expect(result.intro).toHaveLength(1);
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0]).not.toHaveProperty("note");

    expect(generateLessonAlphabet).toHaveBeenCalledWith({
      chapterTitle: context.chapter.title,
      lessonDescription: context.description,
      lessonTitle: context.title,
      targetLanguage: "ja",
      userLanguage: context.language,
    });
  });

  it("throws when alphabet content generation has no target language", async () => {
    const context = await createLessonContext({
      kind: "alphabet",
      organizationId,
      targetLanguage: null,
    });

    await expect(generateAlphabetContentStep(context)).rejects.toThrow(
      "Alphabet content generation needs a target language",
    );
  });
});
