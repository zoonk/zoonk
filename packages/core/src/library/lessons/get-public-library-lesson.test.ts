import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getPublicLibraryLesson } from "./get-public-library-lesson";

const guessHook = {
  options: [
    { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
    { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
  ],
  question: "Does the electron circle the nucleus?",
  reveal: "It's a cloud of chances.",
  variant: "guess",
};

const summary = {
  ideas: [{ text: "The planet picture can't work." }, { text: "The electron is a cloud." }],
};

describe(getPublicLibraryLesson, () => {
  it("returns the public part: summary ideas and the first screen without its answer", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed", summary });

    await Promise.all([
      libraryStepFixture({ content: guessHook, kind: "hook", lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ lessonId: lesson.id, position: 1 }),
    ]);

    const result = await getPublicLibraryLesson({ lessonId: lesson.id });

    expect(result).toMatchObject({
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      firstScreen: {
        guess: true,
        kind: "choice",
        options: [
          { id: "planet", text: "Yes, like a tiny planet" },
          { id: "cloud", text: "No, it's more like a cloud" },
        ],
        question: guessHook.question,
      },
      id: lesson.id,
      summaryIdeas: ["The planet picture can't work.", "The electron is a cloud."],
      title: lesson.title,
    });

    expect(JSON.stringify(result)).not.toMatch(/isCorrect|cloud of chances|Test step content/u);
  });

  it("has no first screen before the content is written", async () => {
    const lesson = await libraryLessonFixture();
    const result = await getPublicLibraryLesson({ lessonId: lesson.id });

    expect(result).toMatchObject({ firstScreen: null, summaryIdeas: [] });
  });

  it("never returns a private lesson", async () => {
    const owner = await userFixture();

    const lesson = await libraryLessonFixture({
      contentStatus: "completed",
      ownerId: owner.id,
      visibility: "private",
    });

    await expect(getPublicLibraryLesson({ lessonId: lesson.id })).resolves.toBeNull();
  });

  it("returns null for ids that aren't lessons", async () => {
    await expect(getPublicLibraryLesson({ lessonId: "not-a-uuid" })).resolves.toBeNull();
  });
});
