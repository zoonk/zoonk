import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { placeContinuations } from "./place-continuations";

describe(placeContinuations, () => {
  it("moves a continuation right after the chapter it continues, before what builds on it", async () => {
    const [course, ...chapters] = await Promise.all([
      courseFixture({ title: "Mathematics" }),
      ...["Linear equations", "Functions", "Quadratics", "Linear equations in context"].map(
        (title) => libraryChapterFixture({ title }),
      ),
    ]);

    await Promise.all(
      chapters.map((chapter, position) =>
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
      ),
    );

    const [equations, functions, quadratics, continuation] = chapters;

    await placeContinuations({
      courseId: course.id,
      level: "beginner",
      moves: [{ afterChapterId: equations?.id ?? "", chapterId: continuation?.id ?? "" }],
    });

    const placements = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      select: { chapterId: true, position: true },
      where: { courseId: course.id },
    });

    expect(placements).toStrictEqual(
      [equations, continuation, functions, quadratics].map((chapter, position) => ({
        chapterId: chapter?.id,
        position,
      })),
    );
  });

  it("marks the plans reading a moved chapter's lessons, and nothing when the order stays", async () => {
    const [course, first, second, skill, other, user] = await Promise.all([
      courseFixture(),
      libraryChapterFixture(),
      libraryChapterFixture(),
      skillFixture(),
      skillFixture(),
      userFixture(),
    ]);

    const [firstLesson, secondLesson] = await Promise.all([
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: first.id, courseId: course.id, position: 0 }),
      courseChapterFixture({ chapterId: second.id, courseId: course.id, position: 1 }),
      chapterSkillFixture({ chapterId: first.id, skillId: skill.id }),
      chapterSkillFixture({ chapterId: second.id, skillId: skill.id }),
      chapterLessonFixture({ chapterId: first.id, lessonId: firstLesson.id }),
      chapterLessonFixture({ chapterId: second.id, lessonId: secondLesson.id }),
    ]);

    const [readingGoal, unrelatedGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    // Both chapters teach the skill, so a plan studying it reads their lessons in their order.
    const [reading, unrelated] = await Promise.all([
      planFixture({ goalId: readingGoal.id, sourceSkillIds: [skill.id] }),
      planFixture({ goalId: unrelatedGoal.id, sourceSkillIds: [other.id] }),
    ]);

    const readPlans = () =>
      prisma.plan.findMany({
        orderBy: { id: "asc" },
        select: { id: true, inputVersion: true, pendingAdaptation: true },
        where: { id: { in: [reading.id, unrelated.id] } },
      });

    const before = await readPlans();
    const move = { afterChapterId: second.id, chapterId: first.id };

    await placeContinuations({ courseId: course.id, level: "beginner", moves: [move] });

    await expect(readPlans()).resolves.toStrictEqual(
      before.map((plan) =>
        plan.id === reading.id
          ? { ...plan, inputVersion: plan.inputVersion + 1, pendingAdaptation: ["content"] }
          : plan,
      ),
    );

    const moved = await readPlans();

    // The same move again leaves the order as it is: nothing is written or marked.
    await placeContinuations({ courseId: course.id, level: "beginner", moves: [move] });

    await expect(readPlans()).resolves.toStrictEqual(moved);
  });
});
