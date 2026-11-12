import { describe, expect, it } from "vitest";
import { languageLessonDraft } from "../_test-utils/language-lesson-draft";
import { listLanguageReviewScreens } from "./language-review-screens";

describe(listLanguageReviewScreens, () => {
  it("shows each screen as learners see it, with the answers the app accepts marked", () => {
    const content = languageLessonDraft();
    const [rent, deposit] = content.words;
    const [rentQuestion] = content.sentences;
    const [blank] = content.practice;

    const screens = listLanguageReviewScreens({
      content,
      learnerLanguage: "pt",
      targetLanguage: "en",
    });

    expect(screens.slice(3, 4)).toStrictEqual([
      {
        content: {
          options: [
            { isCorrect: true, text: deposit?.word },
            ...(deposit?.distractors ?? []).map((text) => ({ isCorrect: false, text })),
          ],
          prompt: deposit?.translation,
        },
        kind: "translation",
      },
    ]);

    expect(screens.find((screen) => screen.kind === "vocabulary")?.content).not.toHaveProperty(
      "distractors",
    );

    expect(screens.find((screen) => screen.kind === "vocabulary")?.content).toMatchObject({
      pronunciation: rent?.pronunciation,
      word: rent?.word,
    });

    expect(screens.find((screen) => screen.kind === "fillBlank")?.content).toMatchObject({
      options: [
        { isCorrect: true, text: blank?.answer },
        ...(blank?.distractors ?? []).map((text) => ({ isCorrect: false, text })),
      ],
      template: blank?.template,
    });

    expect(screens.find((screen) => screen.kind === "reading")?.content).toStrictEqual({
      answer: rentQuestion?.sentence,
      explanation: rentQuestion?.explanation,
      extraTiles: rentQuestion?.distractors,
      prompt: rentQuestion?.translation,
    });
  });
});
