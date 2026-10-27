import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../_test-utils/learner-revision";
import { mockSession } from "../_test-utils/mock-session";
import { followGoalTimeZone } from "../learner/follow-goal-time-zone";
import { getSession } from "../users/get-session";
import { buildExamIdentityKey } from "./exams/exam-identity";
import { readBlueprintContent, saveExamBlueprint } from "./exams/save-exam-blueprint";
import { setSkillPrerequisites } from "./skills/create-skill";
import { mergeSkillForAdmin } from "./skills/merge-skill";

const WRITERS = ["prerequisites", "blueprint", "merge", "zone"] as const;
type Writer = (typeof WRITERS)[number];

async function dependentPlan({
  userId,
  ...attrs
}: { userId?: string } & Omit<Parameters<typeof planFixture>[0], "goalId">) {
  const user = userId ? { id: userId } : await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ ...attrs, goalId: goal.id });
  return { goal, plan, user };
}

async function fixture(writer: Writer) {
  if (writer === "zone") {
    const first = await dependentPlan({});
    const second = await dependentPlan({ userId: first.user.id });

    await prisma.goal.update({
      data: { timezone: "America/Sao_Paulo" },
      where: { id: first.goal.id },
    });

    mockSession(first.user.id);

    return {
      lock: (tx: TransactionClient) =>
        tx.$queryRaw`SELECT id FROM goals WHERE id = ${first.goal.id}::uuid FOR UPDATE`,
      plans: [first.plan, second.plan],
      read: () => prisma.goal.findUniqueOrThrow({ where: { id: first.goal.id } }),
      write: () =>
        followGoalTimeZone({ goalId: first.goal.id, timeZone: "America/Argentina/Buenos_Aires" }),
    };
  }

  if (writer === "blueprint") {
    const source = await sourceFixture();

    const identity = {
      board: null,
      country: "BR",
      language: "en",
      name: crypto.randomUUID(),
      ownerId: null,
      role: null,
    };

    const blueprint = await examBlueprintFixture({ identityKey: buildExamIdentityKey(identity) });
    const plans = await Promise.all([dependentPlan({}), dependentPlan({})]);

    await prisma.goal.updateMany({
      data: { examBlueprintId: blueprint.id },
      where: { id: { in: plans.map(({ goal }) => goal.id) } },
    });

    const content = readBlueprintContent(blueprint);

    return {
      lock: (tx: TransactionClient) =>
        tx.$queryRaw`SELECT id FROM exam_blueprints WHERE id = ${blueprint.id}::uuid FOR UPDATE`,
      plans: plans.map(({ plan }) => plan),
      read: () => prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      write: () =>
        saveExamBlueprint({
          content: {
            ...content,
            edition: { ...content.edition, questionCount: 42, sourceHash: source.contentHash },
          },
          identity,
          provenance: {
            generatedAt: new Date(),
            model: "test/fixture",
            promptVersion: "test",
            runId: crypto.randomUUID(),
          },
          sourceId: source.id,
        }),
    };
  }

  const [duplicate, survivor, alias] = await Promise.all([
    skillFixture(),
    skillFixture(),
    skillFixture(),
  ]);

  if (writer === "prerequisites") {
    const plans = await Promise.all([
      dependentPlan({ sourceSkillIds: [duplicate.id] }),
      dependentPlan({ sourceSkillIds: [duplicate.id] }),
    ]);

    return {
      lock: (tx: TransactionClient) =>
        tx.$queryRaw`SELECT id FROM skills WHERE id = ${duplicate.id}::uuid FOR UPDATE`,
      plans: plans.map(({ plan }) => plan),
      read: () => prisma.skillPrerequisite.findMany({ where: { skillId: duplicate.id } }),
      write: () =>
        setSkillPrerequisites({
          among: new Set([survivor.id]),
          prerequisiteIds: [survivor.id],
          skillId: duplicate.id,
        }),
    };
  }

  await prisma.skill.update({ data: { mergedIntoId: duplicate.id }, where: { id: alias.id } });

  const [duplicatePlan, survivorPlan, aliasPlan, masteryPlan] = await Promise.all([
    dependentPlan({ sourceSkillIds: [duplicate.id] }),
    dependentPlan({ sourceSkillIds: [survivor.id] }),
    dependentPlan({ sourceSkillIds: [alias.id] }),
    dependentPlan({ sourceSkillIds: [crypto.randomUUID()] }),
  ]);

  await learnerSkillFixture({ skillId: duplicate.id, userId: masteryPlan.user.id });
  const admin = await userFixture({ role: "admin" });

  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The command reads only trusted identity and role.
    { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );

  return {
    lock: (tx: TransactionClient) =>
      tx.$queryRaw`SELECT id FROM learner_skills WHERE skill_id = ${duplicate.id}::uuid FOR UPDATE`,
    plans: [duplicatePlan.plan, survivorPlan.plan, aliasPlan.plan, masteryPlan.plan],
    read: () => prisma.skill.findUniqueOrThrow({ where: { id: duplicate.id } }),
    write: () => mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id }),
  };
}

async function inputVersions(planIds: string[]) {
  return prisma.plan.findMany({
    orderBy: { id: "asc" },
    select: { inputVersion: true },
    where: { id: { in: planIds } },
  });
}

describe("plan input writers", () => {
  it.each(WRITERS)(
    "%s rolls back its domain write when an owner cannot be marked",
    async (writer) => {
      const context = await fixture(writer);
      const before = await context.read();
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: context.plans[0]!.goalId } });

      await prisma.user.update({
        data: { learnerRevision: 9_223_372_036_854_775_807n },
        where: { id: goal.userId },
      });

      await expect(context.write()).rejects.toThrow();
      await expect(context.read()).resolves.toStrictEqual(before);

      await expect(inputVersions(context.plans.map(({ id }) => id))).resolves.toStrictEqual(
        context.plans.map(() => ({ inputVersion: 0 })),
      );
    },
  );

  it.each(WRITERS)(
    "%s marks the complete affected union without touching unrelated plans",
    async (writer) => {
      const context = await fixture(writer);
      const unrelated = await dependentPlan({});
      await context.write();

      await expect(inputVersions(context.plans.map(({ id }) => id))).resolves.toStrictEqual(
        context.plans.map(() => ({ inputVersion: 1 })),
      );

      await expect(inputVersions([unrelated.plan.id])).resolves.toStrictEqual([
        { inputVersion: 0 },
      ]);
    },
  );

  it.each(WRITERS)("%s waits for the plan before changing its domain inputs", async (writer) => {
    const context = await fixture(writer);
    const before = await context.read();
    const held = Promise.withResolvers<number>();
    const resume = Promise.withResolvers<null>();

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${context.plans[0]!.id}::uuid FOR UPDATE`;
      await context.lock(tx);
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend!.pid);
      await resume.promise;
    });

    const pid = await held.promise;
    const writing = context.write();

    try {
      await waitForBlockedStatement(pid, /FROM plans[\s\S]*FOR UPDATE/u);
      await expect(context.read()).resolves.toStrictEqual(before);
    } finally {
      resume.resolve(null);
      await Promise.all([holder, writing]);
    }

    await expect(inputVersions(context.plans.map(({ id }) => id))).resolves.toStrictEqual(
      context.plans.map(() => ({ inputVersion: 1 })),
    );
  });
});
