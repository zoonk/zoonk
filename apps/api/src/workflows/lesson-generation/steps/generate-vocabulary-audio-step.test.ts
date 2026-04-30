import { randomUUID } from "node:crypto";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateVocabularyAudioStep } from "./generate-vocabulary-audio-step";

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) => Promise.resolve({ data: `/audio/${text}.mp3`, error: null })),
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

  it("generates audio URLs for vocabulary words", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = `猫${uniqueId}`;
    const dogWord = `犬${uniqueId}`;
    const words = [catWord, dogWord];

    await expect(generateVocabularyAudioStep({ context, words })).resolves.toStrictEqual({
      wordAudioUrls: { [catWord]: `/audio/${catWord}.mp3`, [dogWord]: `/audio/${dogWord}.mp3` },
    });
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "ja",
      orgSlug: "ai",
      text: catWord,
    });
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "ja",
      orgSlug: "ai",
      text: dogWord,
    });
  });
});
