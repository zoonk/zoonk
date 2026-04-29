import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateWordAudioUrls } from "./_utils/generate-word-audio-urls";
import { generateVocabularyAudioStep } from "./generate-vocabulary-audio-step";

vi.mock("./_utils/generate-word-audio-urls", () => ({
  generateWordAudioUrls: vi
    .fn()
    .mockImplementation(({ words }) =>
      Promise.resolve(
        Object.fromEntries(words.map((word: string) => [word, `/audio/${word}.mp3`])),
      ),
    ),
}));

describe(generateVocabularyAudioStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates audio URLs for vocabulary words", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = "猫";
    const dogWord = "犬";
    const words = [catWord, dogWord];

    await expect(generateVocabularyAudioStep({ context, words })).resolves.toEqual({
      wordAudioUrls: {
        [catWord]: `/audio/${catWord}.mp3`,
        [dogWord]: `/audio/${dogWord}.mp3`,
      },
    });
    expect(generateWordAudioUrls).toHaveBeenCalledWith(
      expect.objectContaining({ orgSlug: "ai", targetLanguage: "ja", words }),
    );
  });
});
