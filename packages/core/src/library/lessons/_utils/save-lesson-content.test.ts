import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../../_test-utils/learner-lock";
import { mockSession } from "../../../_test-utils/mock-session";
import { listCheckpointQuestions } from "../../../checkpoints/_utils/checkpoint-candidates";
import { learnerGoalFixture } from "../../../learner/_test-utils/learner-goal";
import { lessonRunFixture } from "../../../lesson-player/_test-utils/lesson-run-fixture";
import { checkLessonStep } from "../../../lesson-player/check-lesson-step";
import { mistakeListInputSchema } from "../../../mistakes/contract";
import { listCurrentUserMistakes } from "../../../mistakes/list-current-user-mistakes";
import { loadPracticeItems } from "../../../sessions/_utils/load-practice";
import { completeLessonContent } from "../../generation/lesson-generation-state";
import { writtenTemperatureLesson } from "../../quality/_test-utils/written-lessons";
import { toStepContent } from "../../steps/written-screens";
import { readLessonMap } from "../lesson-map";
import {
  type LessonScreenToSave,
  publishStagedLessonVersion,
  saveLessonContent,
  stageLessonVersion,
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

function numericScreen(skillId: string): LessonScreenToSave {
  const written = writtenTemperatureLesson().screens[3];
  const converted = written && toStepContent(written, { allowImage: false, language: "en" });

  if (!converted?.ok) {
    throw new Error("Expected a valid numeric screen");
  }

  return { ...screen(skillId), ...converted };
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

async function saveReadyLesson(input: Parameters<typeof saveLessonContent>[0]) {
  await saveLessonContent(input);
  await completeLessonContent(input);
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
      summary: { ideas: [], shape: "hub" },
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
      summary: { ideas: [], shape: "hub" },
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
      summary: { ideas: [], shape: "hub" },
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
      summary: { ideas: [{ text: "A whole contains two halves." }], shape: "hub" },
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
      summary: { ideas: [], shape: "hub" },
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
        summary: { ideas: [], shape: "hub" },
        workflowRunId,
      }),
    ).rejects.toThrow("no linked skill");

    await expect(prisma.step.count({ where: { lessonId: lesson.id } })).resolves.toBe(0);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "running" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      sourceVersion: plan.sourceVersion,
    });
  });

  it("marks each plan reading the lesson changed content when publishing it and staging its next version, once", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });
    const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await saveReadyLesson({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: { ideas: [], shape: "hub" },
      workflowRunId,
    });

    await expect(readPlan()).resolves.toMatchObject({ sourceVersion: plan.sourceVersion + 1 });

    await stageLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen(skill.id)],
      summary: { ideas: [], shape: "hub" },
    });

    await expect(readPlan()).resolves.toMatchObject({ sourceVersion: plan.sourceVersion + 2 });
  });

  it("keeps the whole lesson map, its labels and shape, when publishing and when a staged version replaces it", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();

    const nested = {
      ideas: [
        { label: "Organism", text: "An organism is one living thing." },
        { label: "Population", text: "A population is one species in one place." },
      ],
      shape: "nested" as const,
    };

    const hub = {
      ideas: [{ label: "Community", text: "A community is every population in one place." }],
      shape: "hub" as const,
    };

    const readMap = async () => {
      const stored = await prisma.lesson.findUniqueOrThrow({
        select: { summary: true },
        where: { id: lesson.id },
      });

      return readLessonMap(stored.summary);
    };

    await saveReadyLesson({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: nested,
      workflowRunId,
    });

    await expect(readMap()).resolves.toStrictEqual(nested);

    const version = await stageLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen(skill.id)],
      summary: hub,
    });

    await expect(readMap()).resolves.toStrictEqual(nested);
    await publishStagedLessonVersion({ lessonId: lesson.id, version: version ?? 0 });
    await expect(readMap()).resolves.toStrictEqual(hub);
  });

  it("keeps a staged version's numeric questions out of practice and checkpoints until it's published", async () => {
    const [{ lesson, skill, workflowRunId }, user] = await Promise.all([
      claimedLesson(),
      userFixture(),
    ]);

    await saveReadyLesson({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: { ideas: [], shape: "hub" },
      workflowRunId,
    });

    const version = await stageLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [numericScreen(skill.id)],
      summary: { ideas: [], shape: "hub" },
    });

    const listAskable = async () => {
      const [checkpoint, practice] = await Promise.all([
        listCheckpointQuestions({ examBlueprintId: null, skillIds: [skill.id] }),
        loadPracticeItems({
          difficultyBias: "standard",
          everySkill: true,
          examBlueprintId: null,
          excludeItemIds: new Set(),
          field: null,
          maxMinutes: 45,
          now: new Date(),
          skillIds: [skill.id],
          typed: true,
          userId: user.id,
        }),
      ]);

      return {
        checkpoint: checkpoint.map((item) => item.id),
        practice: practice.map((item) => item.itemId),
      };
    };

    await expect(listAskable()).resolves.toStrictEqual({ checkpoint: [], practice: [] });

    await publishStagedLessonVersion({ lessonId: lesson.id, version: version ?? 0 });

    const step = await prisma.step.findFirstOrThrow({
      where: { lessonId: lesson.id, version: version ?? 0 },
    });

    expect(step.itemId).not.toBeNull();

    await expect(listAskable()).resolves.toStrictEqual({
      checkpoint: [step.itemId],
      practice: [step.itemId],
    });
  });

  it("leaves no bank questions behind for a staged version a newer one replaced", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();

    await saveReadyLesson({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: { ideas: [], shape: "hub" },
      workflowRunId,
    });

    const stage = () =>
      stageLessonVersion({
        language: "en",
        lessonId: lesson.id,
        replaces: 1,
        screens: [numericScreen(skill.id)],
        summary: { ideas: [], shape: "hub" },
      });

    await stage();
    const version = await stage();
    await publishStagedLessonVersion({ lessonId: lesson.id, version: version ?? 0 });

    const published = await prisma.step.findFirstOrThrow({
      where: { lessonId: lesson.id, version: version ?? 0 },
    });

    await expect(
      prisma.item.findMany({ select: { id: true }, where: { skillId: skill.id } }),
    ).resolves.toStrictEqual([{ id: published.itemId }]);
  });

  it("repairs skills in replacement versions too", async () => {
    const { lesson, skill, workflowRunId } = await claimedLesson();

    await saveReadyLesson({
      language: "en",
      lessonId: lesson.id,
      screens: [screen(skill.id)],
      summary: { ideas: [], shape: "hub" },
      workflowRunId,
    });

    await stageLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [screen()],
      summary: { ideas: [], shape: "hub" },
    });

    await expect(
      prisma.step.findFirstOrThrow({ where: { lessonId: lesson.id, version: 2 } }),
    ).resolves.toMatchObject({ skillId: skill.id });
  });
});
