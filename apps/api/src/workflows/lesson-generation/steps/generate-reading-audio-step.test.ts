import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { generateReadingAudioStep } from "./generate-reading-audio-step";

vi.mock("./_utils/generate-audio-for-text", () => ({
  generateAudioForText: vi.fn().mockImplementation((text) =>
    Promise.resolve({
      audioUrl: `/audio/${text}.mp3`,
      text,
    }),
  ),
}));

describe(generateReadingAudioStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates reading audio for missing sentence audio and reuses existing audio", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingSentence = `既存${uniqueId}`;
    const newSentence = `新しい${uniqueId}`;
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });

    await prisma.sentence.create({
      data: {
        audioUrl: "/audio/existing.mp3",
        organizationId,
        sentence: existingSentence,
        targetLanguage: "ja",
      },
    });

    const result = await generateReadingAudioStep({
      context,
      sentences: [
        { explanation: "", sentence: existingSentence, translation: "existing" },
        { explanation: "", sentence: newSentence, translation: "new" },
      ],
    });

    expect(result).toEqual({
      sentenceAudioUrls: {
        [existingSentence]: "/audio/existing.mp3",
        [newSentence]: `/audio/${newSentence}.mp3`,
      },
    });
    expect(generateAudioForText).toHaveBeenCalledExactlyOnceWith(newSentence, "ja", "ai");
  });
});
