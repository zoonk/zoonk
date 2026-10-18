import { type Lesson, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  heldBackDraftFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-revision";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import {
  type LessonScreenToSave,
  saveLessonContent,
  saveLessonVersion,
} from "./_utils/save-lesson-content";

const WRITERS = ["holdback", "publish", "version"] as const;
type Writer = (typeof WRITERS)[number];
const MAX_REVISION = 9_223_372_036_854_775_807n;

function screen(invalidSource = false): LessonScreenToSave {
  return {
    citation: invalidSource ? { page: 1, sourceId: crypto.randomUUID() } : null,
    content: { text: "One whole is two halves.", title: "Halves" },
    kind: "explanation",
    mathItem: null,
    provenance: {
      generatedAt: new Date(),
      model: "test/fixture",
      promptVersion: "test",
      runId: crypto.randomUUID(),
    },
    skillId: null,
  };
}

async function dependentPlan({
  lessonId,
  skillId,
  userId,
}: {
  lessonId?: string;
  skillId?: string;
  userId: string;
}) {
  const goal = await goalFixture({ userId });
  const plan = await planFixture({ goalId: goal.id, sourceSkillIds: skillId ? [skillId] : [] });
  const item = lessonId ? await planItemFixture({ lessonId, planId: plan.id }) : null;
  return { goal, item, plan };
}

async function fixture(writer: Writer) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const workflowRunId = crypto.randomUUID();

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: writer === "version" ? "completed" : "running",
    heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture()],
  });

  const [{ goal, item, plan }, step] = await Promise.all([
    dependentPlan({ lessonId: lesson.id, userId: user.id }),
    libraryStepFixture({ lessonId: lesson.id, version: 1 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });
  return { block, item: item!, lesson, plan, skill, step, user, workflowRunId };
}

function write({
  invalid = false,
  lesson,
  stale = false,
  workflowRunId,
  writer,
}: {
  invalid?: boolean;
  lesson: Lesson;
  stale?: boolean;
  workflowRunId: string;
  writer: Writer;
}) {
  if (writer === "holdback") {
    return holdBackLessonDraft({
      lessonId: lesson.id,
      model: invalid ? "invalid\u0000model" : "test/fixture",
      problems: [{ problem: "The answer is incorrect.", screen: 0 }],
      workflowRunId: stale ? crypto.randomUUID() : workflowRunId,
    });
  }

  const input = {
    language: "en",
    lessonId: lesson.id,
    screens: [screen(invalid)],
    summary: ["One whole is two halves."],
  };

  if (writer === "publish") {
    return saveLessonContent({
      ...input,
      workflowRunId: stale ? crypto.randomUUID() : workflowRunId,
    });
  }

  return saveLessonVersion({ ...input, replaces: stale ? 0 : 1 });
}

async function revision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}

async function inputVersion(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return plan.inputVersion;
}

async function unchanged(context: Awaited<ReturnType<typeof fixture>>) {
  await expect(revision(context.user.id)).resolves.toBe(0n);
  await expect(inputVersion(context.plan.id)).resolves.toBe(0);

  await expect(
    prisma.lesson.findUniqueOrThrow({ where: { id: context.lesson.id } }),
  ).resolves.toStrictEqual(context.lesson);

  await expect(
    prisma.step.findMany({ where: { lessonId: context.lesson.id } }),
  ).resolves.toStrictEqual([context.step]);

  await expect(
    prisma.planItem.findUniqueOrThrow({ where: { id: context.item.id } }),
  ).resolves.toStrictEqual(context.item);

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: context.block.id } }),
  ).resolves.toStrictEqual(context.block);
}

describe("lesson writer learner revisions", () => {
  it.each(WRITERS)(
    "%s marks each dependent plan and owner once, including guests",
    async (writer) => {
      const context = await fixture(writer);
      const [guest, outsider] = await Promise.all([userFixture(), userFixture()]);
      await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

      const [second, guestPlan, unrelated] = await Promise.all([
        dependentPlan({ skillId: context.skill.id, userId: context.user.id }),
        dependentPlan({ lessonId: context.lesson.id, skillId: context.skill.id, userId: guest.id }),
        dependentPlan({ userId: outsider.id }),
      ]);

      await expect(write({ ...context, writer })).resolves.not.toBeNull();
      await expect(revision(context.user.id)).resolves.toBe(1n);
      await expect(revision(guest.id)).resolves.toBe(1n);
      await expect(revision(outsider.id)).resolves.toBe(0n);
      await expect(inputVersion(context.plan.id)).resolves.toBe(1);
      await expect(inputVersion(second.plan.id)).resolves.toBe(1);
      await expect(inputVersion(guestPlan.plan.id)).resolves.toBe(1);
      await expect(inputVersion(unrelated.plan.id)).resolves.toBe(0);

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: context.item.id } }),
      ).resolves.toMatchObject({ status: writer === "holdback" ? "skipped" : context.item.status });

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: context.block.id } }),
      ).resolves.toMatchObject({
        status: writer === "holdback" ? "skipped" : context.block.status,
      });

      await expect(
        prisma.step.findFirstOrThrow({ where: { lessonId: context.lesson.id, retiredAt: null } }),
      ).resolves.toMatchObject({ version: writer === "holdback" ? 1 : 2 });
    },
  );

  it.each(WRITERS)(
    "%s rejects stale claims or versions without a committed mark",
    async (writer) => {
      const context = await fixture(writer);
      await expect(write({ ...context, stale: true, writer })).resolves.toBeNull();
      await unchanged(context);
    },
  );

  it.each(WRITERS)(
    "%s leaves content and queues unchanged if an owner revision overflows",
    async (writer) => {
      const context = await fixture(writer);

      await prisma.user.update({
        data: { learnerRevision: MAX_REVISION },
        where: { id: context.user.id },
      });

      await expect(write({ ...context, writer })).rejects.toThrow();
      await expect(revision(context.user.id)).resolves.toBe(MAX_REVISION);
      await expect(inputVersion(context.plan.id)).resolves.toBe(0);

      await expect(
        prisma.lesson.findUniqueOrThrow({ where: { id: context.lesson.id } }),
      ).resolves.toStrictEqual(context.lesson);

      await expect(
        prisma.step.findMany({ where: { lessonId: context.lesson.id } }),
      ).resolves.toStrictEqual([context.step]);

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: context.item.id } }),
      ).resolves.toStrictEqual(context.item);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: context.block.id } }),
      ).resolves.toStrictEqual(context.block);
    },
  );

  it.each(WRITERS)("%s rolls back admission when the real domain write fails", async (writer) => {
    const context = await fixture(writer);
    /** A missing source violates the step FK; NUL is invalid in PostgreSQL JSONB held-back drafts. */
    await expect(write({ ...context, invalid: true, writer })).rejects.toThrow();
    await unchanged(context);
  });

  it.each(WRITERS)("%s takes plan locks first and rolls back a lost race", async (writer) => {
    const context = await fixture(writer);
    const locked = Promise.withResolvers<number>();
    const resume = Promise.withResolvers<null>();

    const first = prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [context.plan.id] });
      await tx.$queryRaw`SELECT id FROM library_lessons WHERE id = ${context.lesson.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(backend!.pid);
      await resume.promise;

      if (writer === "version") {
        await tx.step.update({ data: { version: 2 }, where: { id: context.step.id } });
      } else {
        await tx.lesson.update({
          data: { contentRunId: crypto.randomUUID() },
          where: { id: context.lesson.id },
        });
      }
    });

    const pid = await locked.promise;
    const attempt = write({ ...context, writer });

    try {
      await waitForBlockedStatement(pid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);
    } finally {
      resume.resolve(null);
      const outcomes = await Promise.allSettled([first, attempt]);

      for (const outcome of outcomes) {
        expect(outcome.status).toBe("fulfilled");
      }
    }

    await expect(attempt).resolves.toBeNull();
    await expect(revision(context.user.id)).resolves.toBe(1n);
    await expect(inputVersion(context.plan.id)).resolves.toBe(1);
    await expect(prisma.step.count({ where: { lessonId: context.lesson.id } })).resolves.toBe(1);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: context.item.id } }),
    ).resolves.toStrictEqual(context.item);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: context.block.id } }),
    ).resolves.toStrictEqual(context.block);
  });
});
