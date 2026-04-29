import { randomUUID } from "node:crypto";
import { generateTranslation } from "@zoonk/ai/tasks/lessons/language/translation";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { generateSentenceWordMetadataStep } from "./generate-sentence-word-metadata-step";

vi.mock("@zoonk/ai/tasks/lessons/language/translation", () => ({
  generateTranslation: vi.fn().mockImplementation(({ word }) =>
    Promise.resolve({
      data: { translation: `${word} translated` },
    }),
  ),
}));

vi.mock("./_utils/generate-lesson-romanizations", () => ({
  generateLessonRomanizations: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve(Object.fromEntries(texts.map((text: string) => [text, `${text} romanized`]))),
    ),
}));

describe(generateSentenceWordMetadataStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates sentence word translations and romanizations for canonical words", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const catWord = `猫${uniqueId}`;
    const waterWord = `水${uniqueId}`;
    const fireWord = `火${uniqueId}`;
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });
    const sentences = [
      { explanation: "", sentence: `${catWord} ${waterWord}`, translation: "cat and water" },
    ];

    await wordFixture({
      organizationId,
      romanization: "neko",
      targetLanguage: "ja",
      word: catWord,
    });

    const metadata = await generateSentenceWordMetadataStep({
      context,
      sentences,
      targetWords: [catWord, waterWord, fireWord],
    });

    expect(metadata.wordMetadata).toEqual({
      [catWord]: { romanization: "neko", translation: `${catWord} translated` },
      [fireWord]: { romanization: `${fireWord} romanized`, translation: "" },
      [waterWord]: {
        romanization: `${waterWord} romanized`,
        translation: `${waterWord} translated`,
      },
    });
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: "en", word: catWord }),
    );
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: "en", word: waterWord }),
    );
    expect(generateLessonRomanizations).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja" }),
    );
  });
});
