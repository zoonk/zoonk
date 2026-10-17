import { type GoalKind } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadLessonReuse } from "./lesson-reuse";

/** The given learner, or a new one. */
async function learnerOrNew(userId?: string): Promise<string> {
  if (userId) {
    return userId;
  }

  const user = await userFixture();
  return user.id;
}

/** A goal of a learner (a new one by default) whose plan has the lesson, or the lesson's chapter. */
async function planFor({
  chapterId = null,
  kind = "learn",
  lessonId = null,
  userId,
}: {
  chapterId?: string | null;
  kind?: GoalKind;
  lessonId?: string | null;
  userId?: string;
}) {
  const learner = await learnerOrNew(userId);
  const goal = await goalFixture({ kind, userId: learner });
  const plan = await planFixture({ goalId: goal.id });

  await planItemFixture({ chapterId, lessonId, planId: plan.id, position: 0 });

  return learner;
}

describe(loadLessonReuse, () => {
  it("serves a private lesson's owner only", async () => {
    const owner = await userFixture();
    const lesson = await libraryLessonFixture({ ownerId: owner.id, visibility: "private" });

    await expect(loadLessonReuse({ forExam: true, lessonId: lesson.id })).resolves.toBe("personal");
  });

  it("is very likely read again for a language or an exam", async () => {
    const [language, forExam, examPlanned] = await Promise.all([
      libraryLessonFixture({ targetLanguage: "es" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await planFor({ kind: "exam", lessonId: examPlanned.id });

    await expect(
      Promise.all([
        loadLessonReuse({ lessonId: language.id }),
        loadLessonReuse({ forExam: true, lessonId: forExam.id }),
        loadLessonReuse({ lessonId: examPlanned.id }),
      ]),
    ).resolves.toStrictEqual(["bounded", "bounded", "bounded"]);
  });

  it("is a niche lesson while one learner's goals plan it, and a popular one from a second learner", async () => {
    const chapter = await libraryChapterFixture();
    const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

    // The same learner's two goals are still one learner.
    const learner = await planFor({ lessonId: lesson.id });
    await planFor({ chapterId: chapter.id, userId: learner });

    await expect(loadLessonReuse({ lessonId: lesson.id })).resolves.toBe("library");

    // Another learner's plan holds the lesson's chapter.
    await planFor({ chapterId: chapter.id });

    await expect(loadLessonReuse({ lessonId: lesson.id })).resolves.toBe("bounded");
  });

  it("is a niche lesson when nobody's goal plans it yet", async () => {
    const lesson = await libraryLessonFixture();

    await expect(loadLessonReuse({ lessonId: lesson.id })).resolves.toBe("library");
  });
});
