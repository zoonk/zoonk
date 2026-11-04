import { prisma } from "@zoonk/db";
import { layOutPlanFixture, planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getAllowance } from "../../entitlements/get-allowance";
import { type readClaimEvents } from "../../learner/facts/claim-events";
import { type readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { type readSavedPlan } from "../../learner/facts/saved-plan";
import { type readUndoneTestOuts } from "../../learner/facts/undone-test-outs";
import { type readUsageTotals } from "../../learner/facts/usage-totals";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getSyllabusView } from "../syllabus/get-syllabus-view";
import { getTodayView } from "./get-today-view";

vi.mock("../../learner/facts/preparation-inputs", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readPreparationInputs: typeof readPreparationInputs }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readPreparationInputs: keepRequestReads(actual.readPreparationInputs) };
});

vi.mock("../../learner/facts/claim-events", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readClaimEvents: typeof readClaimEvents }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readClaimEvents: keepRequestReads(actual.readClaimEvents) };
});

vi.mock("../../learner/facts/undone-test-outs", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readUndoneTestOuts: typeof readUndoneTestOuts }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readUndoneTestOuts: keepRequestReads(actual.readUndoneTestOuts) };
});

vi.mock("../../learner/facts/saved-plan", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readSavedPlan: typeof readSavedPlan }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readSavedPlan: keepRequestReads(actual.readSavedPlan) };
});

vi.mock("../../learner/facts/usage-totals", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readUsageTotals: typeof readUsageTotals }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readUsageTotals: keepRequestReads(actual.readUsageTotals) };
});

describe("Today's render reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads preparation once for the day's weak spot, its progress and the syllabus", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await sessionGoalFixture({
      goal: { kind: "exam" },
      itemsPerSkill: 20,
      userId: user.id,
    });

    await Promise.all([
      layOutPlanFixture(plan.id),
      ...skills.flatMap((skill) => [
        dueSkillFixture({ skillId: skill.id, userId: user.id }),
        attemptFixture({ answeredAt: daysAgo(4), skillId: skill.id, userId: user.id }),
      ]),
    ]);

    mockSession(user.id);

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getTodayView({ goalId: goal.id, timeZone: "UTC" }),
          getSyllabusView({ goalId: goal.id }),
        ]),
      '"_min$answered_at"',
    );

    expect(reads.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(reads.rows).toBe(skills.length);
  });

  it.each(["as planned", "with an area skipped", "after a skill merge"] as const)(
    "reads an unopened day's undone test-outs once, and each skill set's answers once, %s",
    async (variant) => {
      const user = await userFixture();

      const { goal, plan, skills } = await sessionGoalFixture({
        goal: { kind: "exam" },
        userId: user.id,
      });

      await layOutPlanFixture(plan.id);

      const survivor = variant === "after a skill merge" ? await skillFixture() : null;

      if (survivor) {
        const move = { data: { skillId: survivor.id }, where: { skillId: skills[0]?.id } };

        await Promise.all([
          prisma.skill.update({
            data: { mergedIntoId: survivor.id },
            where: { id: skills[0]?.id },
          }),
          prisma.planItem.updateMany(move),
          prisma.item.updateMany(move),
        ]);
      }

      const items = await prisma.item.findMany({
        distinct: ["skillId"],
        select: { id: true, skillId: true },
        where: {
          skillId: { in: [...skills.map((skill) => skill.id), ...(survivor ? [survivor.id] : [])] },
        },
      });

      const { graph } = await prisma.plan.findUniqueOrThrow({
        select: { graph: true },
        where: { id: plan.id },
      });

      await Promise.all([
        prisma.plan.update({
          data: {
            graph: {
              skills: parsePlanGraph(graph).skills.map((skill, index) => ({
                ...skill,
                area: index === 0 ? "Speaking" : "Reading",
              })),
            },
            settings: { skippedAreas: variant === "with an area skipped" ? ["Speaking"] : [] },
          },
          where: { id: plan.id },
        }),
        planChangeFixture({ kind: "testedOut", planId: plan.id, status: "undone" }),
        ...items.map((item) =>
          attemptFixture({
            answeredAt: daysAgo(4),
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
      ]);

      mockSession(user.id);

      const undone = await countDatabaseRows(
        () =>
          countDatabaseRows(
            () =>
              Promise.all([
                getTodayView({ goalId: goal.id, timeZone: "UTC" }),
                getSyllabusView({ goalId: goal.id }),
              ]),
            '"public"."attempts"."item_id" IS NOT NULL AND "public"."attempts"."skill_id" IN',
          ),
        '"public"."plan_changes"."created_at", "public"."plan_changes"."payload" FROM',
      );

      const answers = undone.result;

      expect(answers.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);

      // Skipping an area or merging a skill gives practice other skills than the syllabus: one more read.
      expect({ answers: answers.rows, undone: undone.rows }).toStrictEqual({
        answers: variant === "as planned" ? items.length : items.length * 2 - 1,
        undone: 1,
      });
    },
  );

  it("counts usage once for an unopened day's missions and the allowance", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { kind: "language", targetLanguage: "en" },
      userId: user.id,
    });

    await Promise.all([
      layOutPlanFixture(plan.id),
      usageRecordsFixture({
        count: 2,
        createdAt: SESSION_NOW,
        kind: "conversation",
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const reads = await countDatabaseRows(
      () => Promise.all([getTodayView({ goalId: goal.id, timeZone: "UTC" }), getAllowance()]),
      'FROM "public"."usage_records"',
    );

    expect(reads.result[0].status).toBe("ready");
    // One call kind: a row each from the all-time, this month's and today's counts.
    expect(reads.rows).toBe(3);
  });

  it.each(["exam", "language"] as const)(
    "reads an unopened %s day's saved plan once",
    async (kind) => {
      const user = await userFixture();
      const blueprint = kind === "exam" ? await examBlueprintFixture() : null;

      const { goal, plan } = await sessionGoalFixture({
        goal: {
          examBlueprintId: blueprint?.id ?? null,
          kind,
          targetLanguage: kind === "language" ? "en" : null,
        },
        userId: user.id,
      });

      await layOutPlanFixture(plan.id);
      mockSession(user.id);

      const reads = await countDatabaseRows(
        () => getTodayView({ goalId: goal.id, timeZone: "UTC" }),
        'FROM "public"."plans" WHERE ("public"."plans"."goal_id" = $1',
      );

      expect(reads.result.status).toBe("ready");
      expect(reads.rows).toBe(1);
    },
  );
});
