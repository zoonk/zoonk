import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
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
      pendingAdaptation: [],
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

    await expect(readPlan()).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
      pendingAdaptation: ["content"],
    });

    await saveLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen(skill.id)],
      summary: [],
    });

    await expect(readPlan()).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 2,
      pendingAdaptation: ["content"],
    });
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
