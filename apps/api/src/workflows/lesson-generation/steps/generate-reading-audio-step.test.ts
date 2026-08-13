import { randomUUID } from "node:crypto";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateReadingAudioStep } from "./generate-reading-audio-step";

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) => Promise.resolve({ data: `/audio/${text}.mp3`, error: null })),
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

  it("generates reading audio for missing sentence audio and reuses existing audio", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingSentence = `既存${uniqueId}`;
    const newSentence = `新しい${uniqueId}`;

    const [context] = await Promise.all([
      createLessonContext({ kind: "reading", organizationId, targetLanguage: "ja" }),
      prisma.sentence.create({
        data: {
          audioUrl: "/audio/existing.mp3",
          organizationId,
          sentence: existingSentence,
          targetLanguage: "ja",
        },
      }),
    ]);

    const result = await generateReadingAudioStep({
      context,
      sentences: [
        { explanation: "", sentence: existingSentence, translation: "existing" },
        { explanation: "", sentence: newSentence, translation: "new" },
      ],
    });

    expect(result).toStrictEqual({
      sentenceAudioUrls: {
        [existingSentence]: "/audio/existing.mp3",
        [newSentence]: `/audio/${newSentence}.mp3`,
      },
    });

    expect(generateLanguageAudio).toHaveBeenCalledExactlyOnceWith({
      language: "ja",
      orgSlug: "ai",
      text: newSentence,
      textType: "sentence",
    });
  });

  it("throws for retry after saving successful audio and only retries missing sentences", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const successfulSentence = `成功${uniqueId}`;
    const failedSentence = `失敗${uniqueId}`;

    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve(
        text === failedSentence
          ? { data: null, error: new Error("No speech audio generated") }
          : { data: `/audio/${text}.mp3`, error: null },
      ),
    );

    await expect(
      generateReadingAudioStep({
        context,
        sentences: [
          { explanation: "", sentence: successfulSentence, translation: "successful" },
          { explanation: "", sentence: failedSentence, translation: "failed" },
        ],
      }),
    ).rejects.toThrow("optionalAudioGenerationIncomplete");

    await expect(
      prisma.sentence.findUniqueOrThrow({
        where: {
          orgSentence: { organizationId, sentence: successfulSentence, targetLanguage: "ja" },
        },
      }),
    ).resolves.toMatchObject({ audioUrl: `/audio/${successfulSentence}.mp3` });

    vi.clearAllMocks();

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
    );

    await expect(
      generateReadingAudioStep({
        context,
        sentences: [
          { explanation: "", sentence: successfulSentence, translation: "successful" },
          { explanation: "", sentence: failedSentence, translation: "failed" },
        ],
      }),
    ).resolves.toStrictEqual({
      sentenceAudioUrls: {
        [failedSentence]: `/audio/${failedSentence}.mp3`,
        [successfulSentence]: `/audio/${successfulSentence}.mp3`,
      },
    });

    expect(generateLanguageAudio).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: failedSentence }),
    );
  });
});
