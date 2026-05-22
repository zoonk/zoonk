import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { type AlphabetLessonContent } from "./_utils/generated-lesson-content";
import { saveAlphabetLessonStep } from "./save-alphabet-lesson-step";

/**
 * Keeps Japanese glyphs as string data instead of object identifiers so linting
 * does not treat one-character symbols as variable-style property names.
 */
function alphabetAudioUrls(): Record<string, string> {
  return Object.fromEntries([
    ["あ", "https://example.com/a.mp3"],
    ["い", "https://example.com/i.mp3"],
  ]);
}

function alphabetContent(): AlphabetLessonContent {
  return {
    intro: [{ text: "The vowels are あ (a), い (i), and う (u).", title: "Vowels" }],
    kind: "alphabet",
    symbols: [
      {
        audioText: "あ",
        forms: [],
        pronunciation: "like a in father",
        readingAid: "a",
        symbol: "あ",
      },
      {
        audioText: "い",
        forms: [],
        pronunciation: "like ee in see",
        readingAid: "i",
        symbol: "い",
      },
      {
        audioText: "う",
        forms: [],
        pronunciation: "like oo in moon",
        readingAid: "u",
        symbol: "う",
      },
    ],
  };
}

describe(saveAlphabetLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves intro, symbol cards, and a final matching drill", async () => {
    const context = await createLessonContext({
      kind: "alphabet",
      organizationId,
      targetLanguage: "ja",
    });

    await saveAlphabetLessonStep({
      audioUrls: alphabetAudioUrls(),
      content: alphabetContent(),
      context,
    });

    const [steps, lessonWords] = await Promise.all([
      prisma.step.findMany({ orderBy: { position: "asc" }, where: { lessonId: context.id } }),
      prisma.chapterWord.findMany({ where: { sourceLessonId: context.id } }),
    ]);

    expect(lessonWords).toStrictEqual([]);

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "static"],
      [1, "alphabet"],
      [2, "alphabet"],
      [3, "alphabet"],
      [4, "matchColumns"],
    ]);

    expect(steps[0]?.content).toStrictEqual({
      text: "The vowels are あ (a), い (i), and う (u).",
      title: "Vowels",
      variant: "text",
    });

    expect(steps[1]?.content).toMatchObject({
      audioText: "あ",
      audioUrl: "https://example.com/a.mp3",
      readingAid: "a",
      symbol: "あ",
    });

    expect(steps[3]?.content).toMatchObject({ audioUrl: null, readingAid: "u", symbol: "う" });

    expect(steps[4]?.content).toStrictEqual({
      pairs: [
        { left: "あ", right: "a" },
        { left: "い", right: "i" },
        { left: "う", right: "u" },
      ],
    });
  });
});
