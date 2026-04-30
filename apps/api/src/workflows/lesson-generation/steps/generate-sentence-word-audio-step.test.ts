import { randomUUID } from "node:crypto";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateSentenceWordAudioStep } from "./generate-sentence-word-audio-step";

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) => Promise.resolve({ data: `/audio/${text}.mp3`, error: null })),
}));

describe(generateSentenceWordAudioStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates word audio URLs for reading words", async () => {
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

    await expect(generateSentenceWordAudioStep({ context, words })).resolves.toStrictEqual({
      wordAudioUrls: {
        [catWord]: `/audio/${catWord}.mp3`,
        [fireWord]: `/audio/${fireWord}.mp3`,
        [waterWord]: `/audio/${waterWord}.mp3`,
      },
    });
    expect(generateLanguageAudio).toHaveBeenCalledTimes(3);
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "ja",
      orgSlug: "ai",
      text: catWord,
    });
  });
});
