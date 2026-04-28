import { describe, expect, test } from "vitest";
import { expandChapterLessons } from "./lesson-plan-expansion";

type GeneratedChapterLesson = Parameters<typeof expandChapterLessons>[0]["lessons"][number];

function explanationLessons(count: number): GeneratedChapterLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    description: `Explanation ${index + 1}`,
    kind: "explanation" as const,
    title: `Explanation ${index + 1}`,
  }));
}

function vocabularyLessons(count: number): GeneratedChapterLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    description: `Vocabulary ${index + 1}`,
    kind: "vocabulary" as const,
    title: `Vocabulary ${index + 1}`,
  }));
}

function kinds(lessons: ReturnType<typeof expandChapterLessons>) {
  return lessons.map((lesson) => lesson.kind);
}

describe(expandChapterLessons, () => {
  test("adds practice, quiz, and review for three explanations", () => {
    expect(
      kinds(
        expandChapterLessons({
          language: "en",
          lessons: explanationLessons(3),
          targetLanguage: null,
        }),
      ),
    ).toEqual(["explanation", "explanation", "explanation", "practice", "quiz", "review"]);
  });

  test("groups five explanations as three then two before quiz and review", () => {
    expect(
      kinds(
        expandChapterLessons({
          language: "en",
          lessons: explanationLessons(5),
          targetLanguage: null,
        }),
      ),
    ).toEqual([
      "explanation",
      "explanation",
      "explanation",
      "practice",
      "explanation",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  test("groups six explanations as pairs with quiz after every two practices", () => {
    expect(
      kinds(
        expandChapterLessons({
          language: "en",
          lessons: explanationLessons(6),
          targetLanguage: null,
        }),
      ),
    ).toEqual([
      "explanation",
      "explanation",
      "practice",
      "explanation",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  test("does not add interactive companion lessons when there are no explanations", () => {
    const lessons: GeneratedChapterLesson[] = [
      { description: "Tutorial", kind: "tutorial", title: "Tutorial" },
    ];

    expect(kinds(expandChapterLessons({ language: "en", lessons, targetLanguage: null }))).toEqual([
      "tutorial",
    ]);
  });

  test("adds reading and listening after every vocabulary group", () => {
    expect(
      kinds(
        expandChapterLessons({
          language: "en",
          lessons: vocabularyLessons(4),
          targetLanguage: "es",
        }),
      ),
    ).toEqual([
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "review",
    ]);
  });

  test("adds reading for the final vocabulary group even when listening is unsupported", () => {
    expect(
      kinds(
        expandChapterLessons({
          language: "en",
          lessons: vocabularyLessons(5),
          targetLanguage: "xx",
        }),
      ),
    ).toEqual([
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "reading",
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "reading",
      "review",
    ]);
  });
});
