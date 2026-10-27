import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../../_test-utils/learner-revision";
import { mockSession } from "../../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../../learner/_test-utils/learner-goal";
import { lessonRunFixture } from "../../../lesson-player/_test-utils/lesson-run-fixture";
import { checkLessonStep } from "../../../lesson-player/check-lesson-step";
import { mistakeListInputSchema } from "../../../mistakes/contract";
import { listCurrentUserMistakes } from "../../../mistakes/list-current-user-mistakes";
import { writtenTemperatureLesson } from "../../quality/_test-utils/written-lessons";
import { toStepContent } from "../../steps/written-screens";
import {
  type LessonScreenToSave,
  saveLessonContent,
  saveLessonVersion,
} from "./save-lesson-content";

const content = {
  basis: null,
  options: [
    { id: "right", isCorrect: true, reason: "Two halves make a whole.", text: "2" },
    { id: "wrong", isCorrect: false, reason: "A whole contains two halves.", text: "3" },
  ],
  question: "How many halves make a whole?",
};

function screen(skillId: string | null = null): LessonScreenToSave {
  return {
    content,
    kind: "check",
    mathItem: null,
    provenance: {
      generatedAt: new Date(),
      model: "test/fixture",
      promptVersion: "test-v1",
      runId: randomUUID(),
    },
    skillId,
  };
}

async function claimedLesson() {
  const workflowRunId = randomUUID();

  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ contentRunId: workflowRunId, contentStatus: "running" }),
    skillFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
  return { lesson, skill, workflowRunId };
}

describe(saveLessonContent, () => {
  it("keeps the surviving identity of a screen skill merged while its writer was running", async () => {
    const { lesson, workflowRunId } = await claimedLesson();
    const [survivor, duplicate] = await Promise.all([skillFixture(), skillFixture()]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: survivor.id }),
      prisma.skill.update({ data: { mergedIntoId: survivor.id }, where: { id: duplicate.id } }),
    ]);

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(duplicate.id)],
      summary: [],
      workflowRunId,
    });

    await expect(
      prisma.step.findFirstOrThrow({ where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject({ skillId: survivor.id });
  });

  it("stores screens on the skill a merge moved the lesson to while the write waited for a plan", async () => {
    const { lesson, skill: duplicate, workflowRunId } = await claimedLesson();
    const [survivor, user] = await Promise.all([skillFixture(), userFixture()]);
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });
    const written = writtenTemperatureLesson().screens[3];
    const converted = written && toStepContent(written, { allowImage: false, language: "en" });

    if (!converted?.ok) {
      throw new Error("Expected a valid numeric screen");
    }

    const held = Promise.withResolvers<number>();
    const released = Promise.withResolvers<null>();

    // A merge of the lesson's skill holds the plan reading it, then moves the lesson to the survivor.
    const merge = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await released.promise;
      await tx.lessonSkill.deleteMany({ where: { lessonId: lesson.id, skillId: duplicate.id } });
      await tx.lessonSkill.create({ data: { lessonId: lesson.id, skillId: survivor.id } });
      await tx.skill.update({ data: { mergedIntoId: survivor.id }, where: { id: duplicate.id } });
    });

    merge.catch((error: unknown) => held.reject(error));
    const pid = await held.promise;

    const writing = saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [{ ...screen(), ...converted, skillId: duplicate.id }],
      summary: [],
      workflowRunId,
    });

    try {
      await waitForBlockedStatement(pid, /FOR UPDATE OF plan/u);
    } finally {
      released.resolve(null);
      await merge;
    }

    await writing;

    await expect(
      prisma.step.findFirstOrThrow({ include: { item: true }, where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject({ item: { skillId: survivor.id }, skillId: survivor.id });
  });

  it("repairs a numeric question before saving the item used by reviews", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();
    const written = writtenTemperatureLesson().screens[3];

    if (!written) {
      throw new Error("Expected a numeric screen");
    }

    const converted = toStepContent(written, { allowImage: false, language: "en" });

    if (!converted.ok) {
      throw new Error("Expected a valid numeric screen");
    }

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [{ ...screen(), ...converted }],
      summary: [],
      workflowRunId,
    });

    await expect(
      prisma.step.findFirstOrThrow({ include: { item: true }, where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject({ item: { skillId: skill.id }, skillId: skill.id });
  });

  it("repairs missing and unrelated question skills before publishing, preserving a valid skill", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();
    const [second, unrelated] = await Promise.all([skillFixture(), skillFixture()]);
    await lessonSkillFixture({ lessonId: lesson.id, skillId: second.id });

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(), screen(unrelated.id), screen(second.id)],
      summary: ["A whole contains two halves."],
      workflowRunId,
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(steps.map((step) => step.skillId)).toStrictEqual([skill.id, skill.id, second.id]);
  });

  it("publishes a repaired question whose miss appears in the goal's notebook under its finer lesson skill", async () => {
    const [user, { lesson, skill, workflowRunId }] = await Promise.all([
      userFixture(),
      claimedLesson(),
    ]);

    const { goal, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    await prisma.planItem.update({
      data: { lessonId: lesson.id },
      where: { id: planItems[0]?.id },
    });

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [screen()],
      summary: [],
      workflowRunId,
    });

    const step = await prisma.step.findFirstOrThrow({ where: { lessonId: lesson.id } });
    mockSession(user.id);
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    const result = await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "wrong" },
        durationMs: 8000,
        runId: run.id,
        timeZone: "UTC",
      },
      stepId: step.id,
    });

    expect(result).toMatchObject({
      result: { isCorrect: false, savedMistake: true },
      status: "checked",
    });

    const notebook = await listCurrentUserMistakes(
      mistakeListInputSchema.parse({ goalId: goal.id }),
    );

    expect(notebook).toMatchObject({
      counts: { open: 1 },
      mistakes: [
        { skill: { id: skill.id }, snapshot: { answer: "3", question: content.question } },
      ],
      status: "ready",
    });

    expect(step.skillId).toBe(skill.id);
  });

  it("rolls back publishing an answerable lesson without any linked skill", async () => {
    const workflowRunId = randomUUID();

    const [lesson, user] = await Promise.all([
      libraryLessonFixture({ contentRunId: workflowRunId, contentStatus: "running" }),
      userFixture(),
    ]);

    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });

    await expect(
      saveLessonContent({
        language: "en",
        lessonId: lesson.id,
        screens: [screen()],
        summary: [],
        workflowRunId,
      }),
    ).rejects.toThrow("no linked skill");

    await expect(prisma.step.count({ where: { lessonId: lesson.id } })).resolves.toBe(0);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "running" });

    // The plan's mark rolled back with the publication.
    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });

  it("marks each plan reading the lesson changed content when publishing it and its next version, once", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });
    const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: [],
      workflowRunId,
    });

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });

    await saveLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen(skill.id)],
      summary: [],
    });

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 2 });
  });

  it("repairs skills in replacement versions too", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();

    await saveLessonContent({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: [],
      workflowRunId,
    });

    await saveLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen()],
      summary: [],
    });

    await expect(
      prisma.step.findFirstOrThrow({ where: { lessonId: lesson.id, version: 2 } }),
    ).resolves.toMatchObject({ skillId: skill.id });
  });
});
