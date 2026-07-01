import { describe, expect, it } from "vitest";
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
  it("adds practice and quiz before review after one explanation", () => {
    expect(
      kinds(expandChapterLessons({ lessons: explanationLessons(1), targetLanguage: null })),
    ).toStrictEqual(["explanation", "practice", "quiz", "review"]);
  });

  it("adds a quiz after every explanation practice pair", () => {
    expect(
      kinds(expandChapterLessons({ lessons: explanationLessons(2), targetLanguage: null })),
    ).toStrictEqual([
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  it("keeps each quiz next to the explanation practice pair it checks", () => {
    expect(
      kinds(expandChapterLessons({ lessons: explanationLessons(3), targetLanguage: null })),
    ).toStrictEqual([
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  it("keeps adding quizzes after each explanation practice lesson", () => {
    expect(
      kinds(expandChapterLessons({ lessons: explanationLessons(5), targetLanguage: null })),
    ).toStrictEqual([
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  it("keeps quiz cadence stable for every explanation practice pair", () => {
    expect(
      kinds(expandChapterLessons({ lessons: explanationLessons(6), targetLanguage: null })),
    ).toStrictEqual([
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  it("does not add interactive companion lessons when there are no explanations", () => {
    const lessons: GeneratedChapterLesson[] = [
      { description: "Tutorial", kind: "tutorial", title: "Tutorial" },
    ];

    expect(kinds(expandChapterLessons({ lessons, targetLanguage: null }))).toStrictEqual([
      "tutorial",
    ]);
  });

  it("keeps generated companion lesson titles and descriptions empty", () => {
    const lessons = expandChapterLessons({ lessons: explanationLessons(2), targetLanguage: null });

    expect(lessons.find((lesson) => lesson.kind === "practice")).toMatchObject({
      description: null,
      title: null,
    });

    expect(lessons.find((lesson) => lesson.kind === "quiz")).toMatchObject({
      description: null,
      title: null,
    });

    expect(lessons.find((lesson) => lesson.kind === "review")).toMatchObject({
      description: null,
      title: null,
    });
  });

  it("adds reading and listening after every vocabulary group", () => {
    expect(
      kinds(expandChapterLessons({ lessons: vocabularyLessons(4), targetLanguage: "es" })),
    ).toStrictEqual([
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

  it("adds reading for the final vocabulary group even when listening is unsupported", () => {
    expect(
      kinds(expandChapterLessons({ lessons: vocabularyLessons(5), targetLanguage: "xx" })),
    ).toStrictEqual([
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

  it("drops alphabet lessons for Roman-script target languages", () => {
    const lessons: GeneratedChapterLesson[] = [
      { description: "Letters", kind: "alphabet", title: "Alphabet" },
      { description: "Words", kind: "vocabulary", title: "Words" },
    ];

    expect(kinds(expandChapterLessons({ lessons, targetLanguage: "es" }))).toStrictEqual([
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "review",
    ]);
  });

  it("keeps alphabet lessons for non-Roman target languages", () => {
    const lessons: GeneratedChapterLesson[] = [
      { description: "Kana", kind: "alphabet", title: "Kana" },
      { description: "Words", kind: "vocabulary", title: "Words" },
    ];

    expect(kinds(expandChapterLessons({ lessons, targetLanguage: "ja" }))).toStrictEqual([
      "alphabet",
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "review",
    ]);
  });
});
