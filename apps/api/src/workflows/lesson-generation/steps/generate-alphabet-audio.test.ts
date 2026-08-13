import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateAlphabetAudio } from "./generate-alphabet-audio";

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }));

vi.mock("@zoonk/core/audio/generate", () => ({ generateLanguageAudio: vi.fn() }));
vi.mock("@zoonk/utils/logger", () => ({ logError: logErrorMock }));

describe(generateAlphabetAudio, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
    );
  });

  it("returns the available symbol audio when another symbol has no generated audio", async () => {
    const successfulAudioText = "А";

    const context = await createLessonContext({
      kind: "alphabet",
      organizationId,
      targetLanguage: "mn",
    });

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve(
        text === "Б"
          ? { data: null, error: new Error("No speech audio generated") }
          : { data: `/audio/${text}.mp3`, error: null },
      ),
    );

    await expect(
      generateAlphabetAudio({
        context,
        symbols: [
          {
            audioText: successfulAudioText,
            forms: [],
            pronunciation: "A",
            readingAid: "A",
            symbol: "А",
          },
          { audioText: "Б", forms: [], pronunciation: "B", readingAid: "B", symbol: "Б" },
        ],
      }),
    ).resolves.toStrictEqual({
      audioUrls: { [successfulAudioText]: `/audio/${successfulAudioText}.mp3` },
    });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      "[Lesson Audio Generation Permanently Failed]",
      expect.objectContaining({
        error: expect.stringContaining("Б"),
        lessonId: context.id,
        step: "generateAlphabetAudio",
      }),
    );
  });
});
