import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { contentFeedbackFixture, feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  answerExplanationFixture,
  libraryStepFixture,
  mediaAssetFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture, milestoneFixture } from "@zoonk/testing/fixtures/memory";
import {
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";

/** Library content that a learner's rows point at, built through every Library fixture. */
async function createLibrary() {
  const [course, skill, prerequisite, image, source] = await Promise.all([
    courseFixture(),
    skillFixture(),
    skillFixture(),
    mediaAssetFixture(),
    sourceFixture(),
  ]);

  const [chapter, item, blueprint] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id }),
    itemFixture({ skillId: skill.id }),
    examBlueprintFixture({ sourceId: source.id }),
    skillPrerequisiteFixture({ prerequisiteId: prerequisite.id, skillId: skill.id }),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  const [step] = await Promise.all([
    libraryStepFixture({
      itemId: item.id,
      lessonId: lesson.id,
      mediaAssetId: image.id,
      skillId: skill.id,
    }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  await Promise.all([
    stepVariantFixture({ stepId: step.id }),
    answerExplanationFixture({ stepId: step.id }),
  ]);

  return { blueprint, chapter, course, item, lesson, skill, source, step };
}

type Library = Awaited<ReturnType<typeof createLibrary>>;

/** A learner's personal rows pointing at the Library, built through every personal-layer fixture. */
async function createLearnerRows({ library, userId }: { library: Library; userId: string }) {
  const goal = await goalFixture({
    examBlueprintId: library.blueprint.id,
    primaryCourseId: library.course.id,
    userId,
  });

  const [plan, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({ goalId: goal.id, userId }),
    learningProfileFixture({ activeGoalId: goal.id, buddyKind: "zu", userId }),
    learnerSkillFixture({ skillId: library.skill.id, userId }),
  ]);

  const [attempt] = await Promise.all([
    attemptFixture({
      itemId: library.item.id,
      skillId: library.skill.id,
      stepId: library.step.id,
      studySessionId: session.id,
      userId,
    }),
    planItemFixture({
      chapterId: library.chapter.id,
      lessonId: library.lesson.id,
      planId: plan.id,
      skillId: library.skill.id,
    }),
    planChangeFixture({ planId: plan.id }),
    studySessionBlockFixture({ lessonId: library.lesson.id, sessionId: session.id }),
    contentFeedbackFixture({ contentId: library.step.id, userId }),
    learningEventFixture({ contentIds: { lessonId: library.lesson.id }, userId }),
    memoryFactFixture({ userId }),
    milestoneFixture({ userId }),
    guardianLinkFixture({ userId }),
  ]);

  await mistakeFixture({
    attemptId: attempt.id,
    itemId: library.item.id,
    skillId: library.skill.id,
    stepId: library.step.id,
    userId,
  });

  return { goal };
}

/** Deletes every piece of Library content except skills, which are merged rather than deleted. */
async function deleteLibraryContent(library: Library) {
  await prisma.course.delete({ where: { id: library.course.id } });
  await prisma.chapter.delete({ where: { id: library.chapter.id } });
  await prisma.lesson.delete({ where: { id: library.lesson.id } });
  await prisma.item.delete({ where: { id: library.item.id } });
  await prisma.examBlueprint.delete({ where: { id: library.blueprint.id } });
  await prisma.source.delete({ where: { id: library.source.id } });
}

function countLearnerRows(userId: string) {
  return Promise.all([
    prisma.goal.count({ where: { userId } }),
    prisma.plan.count({ where: { goal: { userId } } }),
    prisma.planItem.count({ where: { plan: { goal: { userId } } } }),
    prisma.planChange.count({ where: { plan: { goal: { userId } } } }),
    prisma.learnerSkill.count({ where: { userId } }),
    prisma.attempt.count({ where: { userId } }),
    prisma.mistake.count({ where: { userId } }),
    prisma.studySession.count({ where: { userId } }),
    prisma.studySessionBlock.count({ where: { session: { userId } } }),
    prisma.memoryFact.count({ where: { userId } }),
    prisma.milestone.count({ where: { userId } }),
    prisma.contentFeedback.count({ where: { userId } }),
    prisma.learningEvent.count({ where: { userId } }),
    prisma.userLearningProfile.count({ where: { userId } }),
    prisma.guardianLink.count({ where: { userId } }),
  ]);
}

describe("learner rows and Library content", () => {
  it("keep every learner row, unlinked, when Library content is deleted", async () => {
    const [user, library] = await Promise.all([userFixture(), createLibrary()]);
    const { goal } = await createLearnerRows({ library, userId: user.id });

    await deleteLibraryContent(library);

    await expect(countLearnerRows(user.id)).resolves.toStrictEqual(
      Array.from({ length: 15 }, () => 1),
    );

    const [attempt, mistake, planItem, block, updatedGoal] = await Promise.all([
      prisma.attempt.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.mistake.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.planItem.findFirstOrThrow({ where: { plan: { goalId: goal.id } } }),
      prisma.studySessionBlock.findFirstOrThrow({ where: { session: { goalId: goal.id } } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(attempt).toMatchObject({ itemId: null, skillId: library.skill.id, stepId: null });
    expect(mistake).toMatchObject({ itemId: null, stepId: null });
    expect(planItem).toMatchObject({ chapterId: null, lessonId: null, skillId: library.skill.id });
    expect(block.lessonId).toBeNull();
    expect(updatedGoal).toMatchObject({ examBlueprintId: null, primaryCourseId: null });
  });

  it("refuse to delete a skill that learners have progress on", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    await learnerSkillFixture({ skillId: skill.id, userId: user.id });

    await expect(prisma.skill.delete({ where: { id: skill.id } })).rejects.toThrow();
  });

  it("go away with the learner, while feedback messages stay without the user link", async () => {
    const [user, library] = await Promise.all([userFixture(), createLibrary()]);
    await createLearnerRows({ library, userId: user.id });

    const [message, privateChapter] = await Promise.all([
      feedbackFixture({ userId: user.id }),
      libraryChapterFixture({ ownerId: user.id, visibility: "private" }),
    ]);

    await prisma.user.delete({ where: { id: user.id } });

    await expect(countLearnerRows(user.id)).resolves.toStrictEqual(
      Array.from({ length: 15 }, () => 0),
    );

    await expect(prisma.feedback.findUnique({ where: { id: message.id } })).resolves.toMatchObject({
      userId: null,
    });

    await expect(
      prisma.chapter.findUnique({ where: { id: privateChapter.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.lesson.findUnique({ where: { id: library.lesson.id } }),
    ).resolves.not.toBeNull();
  });

  it("go away with the learner together with the private skills they studied", async () => {
    const user = await userFixture();
    const privateSkill = await skillFixture({ ownerId: user.id, visibility: "private" });

    await Promise.all([
      learnerSkillFixture({ skillId: privateSkill.id, userId: user.id }),
      attemptFixture({ skillId: privateSkill.id, userId: user.id }),
    ]);

    await prisma.user.delete({ where: { id: user.id } });

    await expect(prisma.skill.findUnique({ where: { id: privateSkill.id } })).resolves.toBeNull();
    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
