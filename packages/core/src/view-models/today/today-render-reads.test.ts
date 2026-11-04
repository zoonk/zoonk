import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getAllowance } from "../../entitlements/get-allowance";
import { type readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { type readSavedPlan } from "../../learner/facts/saved-plan";
import { type readUsageTotals } from "../../learner/facts/usage-totals";
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
