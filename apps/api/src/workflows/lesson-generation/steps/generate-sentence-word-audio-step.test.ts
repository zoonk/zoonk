import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateWordAudioUrls } from "./_utils/generate-word-audio-urls";
import { generateSentenceWordAudioStep } from "./generate-sentence-word-audio-step";

vi.mock("./_utils/generate-word-audio-urls", () => ({
  generateWordAudioUrls: vi
    .fn()
    .mockImplementation(({ words }) =>
      Promise.resolve(
        Object.fromEntries(words.map((word: string) => [word, `/audio/${word}.mp3`])),
      ),
    ),
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

  test("generates word audio URLs for reading words", async () => {
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

    await expect(generateSentenceWordAudioStep({ context, words })).resolves.toEqual({
      wordAudioUrls: {
        [catWord]: `/audio/${catWord}.mp3`,
        [fireWord]: `/audio/${fireWord}.mp3`,
        [waterWord]: `/audio/${waterWord}.mp3`,
      },
    });
    expect(generateWordAudioUrls).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", words }),
    );
  });
});
