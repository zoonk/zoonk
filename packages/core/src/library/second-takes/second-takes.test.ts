import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mockAdminSession } from "../../_test-utils/mock-session";
import { requestLessonGenerationFor } from "../../lookahead/request-lesson-generation";
import { findTeachingLessonIds } from "../../mistakes/drill-lessons";
import { findMistakeLessons } from "../../mistakes/mistake-lessons";
import { loadSkillLessons } from "../../plans/_utils/planner-lessons";
import { loadLessonsForSkills } from "../../sessions/_utils/load-plan-lessons";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { loadLessonSpecInputs } from "../curriculum/lesson-spec-inputs";
import { completeLessonContent } from "../generation/lesson-generation-state";
import { saveLessonContent } from "../lessons/_utils/save-lesson-content";
import { getPublicLibraryLesson } from "../lessons/get-public-library-lesson";
import { loadLessonReuse } from "../lessons/lesson-reuse";
import { mergeSkillForAdmin } from "../skills/merge-skill";
import { ensureSecondTake } from "./ensure-second-take";
import { findSecondTakes } from "./find-second-takes";
import { getSecondTakeIdentityKey } from "./second-take-identity";
import * as sources from "./second-take-source";

const FIRST_MAP = {
  ideas: [{ label: "Equal parts", text: "The denominator names the size of each equal part." }],
  shape: "hub",
} as const;

async function firstLesson({
  homeChapterId = null,
  ownerId = null,
  skillId,
}: {
  homeChapterId?: string | null;
  ownerId?: string | null;
  skillId: string;
}) {
  const lesson = await libraryLessonFixture({
    canDo: "Compare the size of unit fractions.",
    contentStatus: "completed",
    description: "Compare equal parts of the same whole.",
    homeChapterId,
    level: "intermediate",
    ownerId,
    summary: { ...FIRST_MAP, ideas: [...FIRST_MAP.ideas] },
    title: "The size of equal parts",
    visibility: ownerId ? "private" : "public",
  });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId }),
    libraryStepFixture({ lessonId: lesson.id, position: 0, skillId }),
  ]);

  return lesson;
}

async function writtenTake(skillId: string) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId }),
  });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId }),
    libraryStepFixture({ lessonId: lesson.id, position: 0, skillId }),
  ]);

  return lesson;
}

describe("second takes across skill merges", () => {
  it.each([false, true])(
    "loads the unwritten lesson's inputs (merge during the read: %s)",
    async (duringRead) => {
      const [admin, duplicate, survivor] = await Promise.all([
        userFixture({ role: "admin" }),
        skillFixture({ name: "Unit fractions" }),
        skillFixture({ name: "Comparing unit fractions" }),
      ]);

      const source = await firstLesson({ skillId: duplicate.id });
      const lessonId = (await ensureSecondTake({ skillId: duplicate.id, userId: admin.id }))!;
      mockAdminSession(admin.id);

      const merge = () =>
        mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

      if (duringRead) {
        const readSource = sources.findSecondTakeSource;
        // Commit a real merge between reading the lesson's identity and reading its source.
        const spy = vi
          .spyOn(sources, "findSecondTakeSource")
          .mockImplementationOnce(async (input) => {
            await merge();
            return readSource(input);
          });

        onTestFinished(() => {
          spy.mockRestore();
        });
      } else {
        await merge();
      }

      await expect(loadLessonSpecInputs(lessonId)).resolves.toMatchObject({
        prompt: {
          lessonTitle: source.title,
          secondTake: { firstLessonMap: FIRST_MAP },
          skills: [survivor.name],
        },
      });

      await expect(
        ensureSecondTake({ skillId: duplicate.id, userId: admin.id }),
      ).resolves.toBeNull();

      await expect(ensureSecondTake({ skillId: survivor.id, userId: admin.id })).resolves.toBe(
        lessonId,
      );
    },
  );

  it("serves the same written lesson for the survivor without owing a new one", async () => {
    const [admin, duplicate, survivor] = await Promise.all([
      userFixture({ role: "admin" }),
      skillFixture(),
      skillFixture(),
    ]);

    await firstLesson({ skillId: duplicate.id });
    const lesson = await writtenTake(duplicate.id);
    mockAdminSession(admin.id);
    await mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

    const lessons = await findSecondTakes({ skillIds: [survivor.id], userId: admin.id });

    expect(lessons.get(survivor.id)?.lessonId).toBe(lesson.id);
    await expect(ensureSecondTake({ skillId: survivor.id, userId: admin.id })).resolves.toBeNull();
  });

  it("sets aside the duplicate when both skills have a written take", async () => {
    const [admin, duplicate, survivor] = await Promise.all([
      userFixture({ role: "admin" }),
      skillFixture(),
      skillFixture(),
    ]);

    const [discarded, kept] = await Promise.all([
      writtenTake(duplicate.id),
      writtenTake(survivor.id),
    ]);

    mockAdminSession(admin.id);
    await mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: discarded.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed", setAsideAt: expect.any(Date) });

    const lessons = await findSecondTakes({ skillIds: [survivor.id], userId: admin.id });
    expect(lessons.get(survivor.id)?.lessonId).toBe(kept.id);
  });
});

describe(ensureSecondTake, () => {
  it("converges under concurrent asks and retries, and all learners see the one written lesson", async () => {
    const [first, other, skill] = await Promise.all([userFixture(), userFixture(), skillFixture()]);
    await firstLesson({ skillId: skill.id });

    const [lessonId, concurrent] = await Promise.all([
      ensureSecondTake({ skillId: skill.id, userId: first.id }),
      ensureSecondTake({ skillId: skill.id, userId: other.id }),
    ]);

    expect(lessonId).not.toBeNull();
    expect(concurrent).toBe(lessonId);
    await expect(ensureSecondTake({ skillId: skill.id, userId: first.id })).resolves.toBe(lessonId);

    await expect(
      requestLessonGenerationFor({ lessonId: lessonId ?? "", userId: first.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const row = await prisma.lesson.findUniqueOrThrow({
      include: { chapters: true, skills: true },
      where: {
        languageIdentity: {
          identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId: skill.id }),
          language: skill.language,
        },
      },
    });

    expect(row).toMatchObject({
      chapters: [],
      estimatedMinutes: 4,
      homeChapterId: null,
      id: lessonId,
      ownerId: null,
      skills: [{ skillId: skill.id }],
      visibility: "public",
    });

    await expect(
      findSecondTakes({ skillIds: [skill.id], userId: first.id }),
    ).resolves.toStrictEqual(new Map());

    const workflowRunId = randomUUID();

    await expect(
      claimLibraryGeneration({ id: row.id, target: "lessonContent", workflowRunId }),
    ).resolves.toBe("claimed");

    await saveLessonContent({
      language: skill.language,
      lessonId: row.id,
      screens: [
        {
          content: playableStepContent.check,
          kind: "check",
          mathItem: null,
          provenance: {
            generatedAt: new Date(),
            model: "fixture",
            promptVersion: "fixture",
            runId: workflowRunId,
            sources: [],
          },
          skillId: skill.id,
          standsAlone: true,
        },
      ],
      summary: { ...FIRST_MAP, ideas: [...FIRST_MAP.ideas] },
      workflowRunId,
    });

    await expect(completeLessonContent({ lessonId: row.id, workflowRunId })).resolves.toBe(true);

    await expect(
      prisma.step.findFirstOrThrow({ where: { lessonId: row.id } }),
    ).resolves.toMatchObject({ itemId: null, kind: "check", skillId: skill.id });

    await expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(0);

    const ready = new Map([
      [skill.id, { estimatedMinutes: 4, lessonId: row.id, title: row.title }],
    ]);

    await expect(
      findSecondTakes({ skillIds: [skill.id], userId: first.id }),
    ).resolves.toStrictEqual(ready);

    await expect(
      findSecondTakes({ skillIds: [skill.id], userId: other.id }),
    ).resolves.toStrictEqual(ready);

    await expect(ensureSecondTake({ skillId: skill.id, userId: other.id })).resolves.toBeNull();
  });

  it("uses the owner's scope for a private skill and rejects a second learner", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const skill = await skillFixture({ ownerId: owner.id, visibility: "private" });
    await firstLesson({ ownerId: owner.id, skillId: skill.id });

    await expect(ensureSecondTake({ skillId: skill.id, userId: other.id })).resolves.toBeNull();

    const lessonId = await ensureSecondTake({ skillId: skill.id, userId: owner.id });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId ?? "" } }),
    ).resolves.toMatchObject({
      identityKey: getSecondTakeIdentityKey({ ownerId: owner.id, skillId: skill.id }),
      ownerId: owner.id,
      visibility: "private",
    });

    await expect(loadLessonReuse({ lessonId: lessonId ?? "" })).resolves.toBe("personal");
    await libraryStepFixture({ lessonId: lessonId ?? "", skillId: skill.id });

    await prisma.lesson.update({
      data: { contentStatus: "completed" },
      where: { id: lessonId ?? "" },
    });

    const ready = await findSecondTakes({ skillIds: [skill.id], userId: owner.id });
    expect(ready.get(skill.id)?.lessonId).toBe(lessonId);

    await expect(
      findSecondTakes({ skillIds: [skill.id], userId: other.id }),
    ).resolves.toStrictEqual(new Map());
  });

  it("writes nothing if a public skill has no public lesson with a map", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const [unmapped] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      firstLesson({ ownerId: user.id, skillId: skill.id }),
    ]);

    await lessonSkillFixture({ lessonId: unmapped.id, skillId: skill.id });
    await expect(ensureSecondTake({ skillId: skill.id, userId: user.id })).resolves.toBeNull();

    await expect(
      prisma.lesson.findUnique({
        where: {
          languageIdentity: {
            identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId: skill.id }),
            language: skill.language,
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("keeps shared spec inputs on Library content, with check and item distractors", async () => {
    const [user, skill, course] = await Promise.all([
      userFixture({ name: "LEARNER_NAME_SENTINEL" }),
      skillFixture({ name: "Compare unit fractions" }),
      courseFixture({ title: "Mathematics" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, title: "Fractions" });
    const source = await firstLesson({ homeChapterId: chapter.id, skillId: skill.id });

    const [item] = await Promise.all([
      itemFixture({
        content: {
          ...choiceItemContent("Which fraction names one piece of a whole cut into four?"),
          options: [
            {
              isCorrect: true,
              misconception: null,
              reason: "Four pieces make a whole.",
              text: "1/4",
            },
            {
              isCorrect: false,
              misconception: "Confuses the count and size",
              reason: "One half takes two of the four pieces.",
              text: "1/2",
            },
          ],
        },
        skillId: skill.id,
      }),
      goalFixture({ details: { goal: "LEARNER_GOAL_SENTINEL" }, userId: user.id }),
      memoryFactFixture({ statement: "LEARNER_MEMORY_SENTINEL", userId: user.id }),
      attemptFixture({
        answer: { text: "LEARNER_ANSWER_SENTINEL" },
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const content = {
      basis: null,
      options: [
        {
          id: "small",
          isCorrect: true,
          reason: "There are more equal pieces in the whole.",
          text: "1/5",
        },
        {
          id: "large",
          isCorrect: false,
          reason: "Two equal pieces are larger than five equal pieces.",
          text: "1/2",
        },
      ],
      question: "Which unit fraction is smaller?",
    };

    await Promise.all([
      ...[1, 2].map((position) =>
        libraryStepFixture({
          content,
          kind: "check",
          lessonId: source.id,
          position,
          skillId: skill.id,
        }),
      ),
      libraryStepFixture({ itemId: item.id, lessonId: source.id, position: 3, skillId: skill.id }),
    ]);

    const lessonId = await ensureSecondTake({ skillId: skill.id, userId: user.id });
    const inputs = await loadLessonSpecInputs(lessonId ?? "");

    expect(inputs?.prompt).toMatchObject({
      chapterTitle: "Fractions",
      courseTitle: "Mathematics",
      language: "en",
      lessonCanDo: source.canDo,
      lessonDescription: source.description,
      lessonTitle: source.title,
      level: "intermediate",
      secondTake: {
        firstLessonMap: FIRST_MAP,
        wrongAnswers: [
          { answer: "1/2", question: content.question, reason: content.options[1]?.reason },
          {
            answer: "1/2",
            question: "Which fraction names one piece of a whole cut into four?",
            reason: "Confuses the count and size: One half takes two of the four pieces.",
          },
        ],
      },
      skills: [skill.name],
    });

    expect(inputs?.prompt.quick).toBeUndefined();
    expect(inputs?.prompt.chapterLessons).toBeUndefined();
    expect(JSON.stringify(inputs?.prompt)).not.toContain("SENTINEL");
  });

  it("uses the first lesson's language exercise feedback as wrong-answer reasons", async () => {
    const [user, skill] = await Promise.all([
      userFixture(),
      skillFixture({ targetLanguage: "fr" }),
    ]);

    const source = await firstLesson({ skillId: skill.id });

    await libraryStepFixture({
      content: {
        options: [
          { feedback: "Use du before pain.", id: "partitive", isCorrect: true, text: "du pain" },
          {
            feedback: "Des is for plural nouns.",
            id: "plural",
            isCorrect: false,
            text: "des pain",
          },
        ],
        question: "How do you say some bread?",
      },
      kind: "multipleChoice",
      lessonId: source.id,
      skillId: skill.id,
    });

    const lessonId = await ensureSecondTake({ skillId: skill.id, userId: user.id });
    const inputs = await loadLessonSpecInputs(lessonId ?? "");

    expect(inputs?.prompt.secondTake?.wrongAnswers).toStrictEqual([
      {
        answer: "des pain",
        question: "How do you say some bread?",
        reason: "Des is for plural nouns.",
      },
    ]);
  });

  it("never chooses a written second take when looking for the skill's ordinary lesson", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const retake = await libraryLessonFixture({
      contentStatus: "completed",
      identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId: skill.id }),
    });

    await lessonSkillFixture({ lessonId: retake.id, skillId: skill.id });
    const source = await firstLesson({ skillId: skill.id });
    const context = { skillIds: [skill.id], userId: user.id };

    await expect(
      loadSkillLessons({ ...context, goal: { examBlueprintId: null, kind: "learn" } }),
    ).resolves.toMatchObject([{ lessonId: source.id }]);

    await expect(loadLessonsForSkills({ limit: 2, skillIds: [skill.id] })).resolves.toMatchObject([
      { lessonId: source.id },
    ]);

    await expect(findTeachingLessonIds(context)).resolves.toStrictEqual(
      new Map([[skill.id, source.id]]),
    );

    await expect(
      findMistakeLessons({
        places: [{ id: user.id, lessonId: retake.id, skillId: skill.id }],
        userId: user.id,
      }),
    ).resolves.toStrictEqual(new Map([[user.id, { id: source.id, title: source.title }]]));

    await expect(getPublicLibraryLesson({ lessonId: retake.id })).resolves.toBeNull();
  });
});
