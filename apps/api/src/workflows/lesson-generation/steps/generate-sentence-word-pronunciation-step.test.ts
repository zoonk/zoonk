import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateWordPronunciations } from "./_utils/generate-word-pronunciations";
import { generateSentenceWordPronunciationStep } from "./generate-sentence-word-pronunciation-step";

vi.mock("./_utils/generate-word-pronunciations", () => ({
  generateWordPronunciations: vi
    .fn()
    .mockImplementation(({ words }) =>
      Promise.resolve(Object.fromEntries(words.map((word: string) => [word, `${word} pron`]))),
    ),
}));

describe(generateSentenceWordPronunciationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates pronunciations for reading words", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const catWord = `猫${uniqueId}`;
    const fireWord = `火${uniqueId}`;
    const waterWord = `水${uniqueId}`;
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });
    const words = [catWord, waterWord, fireWord];

    await expect(generateSentenceWordPronunciationStep({ context, words })).resolves.toEqual({
      pronunciations: {
        [catWord]: `${catWord} pron`,
        [fireWord]: `${fireWord} pron`,
        [waterWord]: `${waterWord} pron`,
      },
    });
    expect(generateWordPronunciations).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", words }),
    );
  });
});
