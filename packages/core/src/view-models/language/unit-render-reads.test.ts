import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../_test-utils/mock-session";
import { type readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { getLearnerSummary } from "../../learner/summary/get-learner-summary";
import { getLanguageUnitView } from "./get-language-unit-view";

vi.mock("../../learner/_utils/read-goal-plan", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readGoalPlan: typeof readGoalPlan }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readGoalPlan: keepRequestReads(actual.readGoalPlan) };
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe("a language unit's render reads", () => {
  it("resolves the plan's merged skills once for the unit and the learner summary", async () => {
    const { renting, skills, user } = await languageGoalFixture();
    const survivor = await skillFixture({ language: "pt" });

    await Promise.all([
      prisma.skill.update({ data: { mergedIntoId: survivor.id }, where: { id: skills[2]?.id } }),
      mistakeFixture({
        createdAt: new Date(Date.now() - 2 * DAY_MS),
        skillId: skills[3]?.id,
        userId: user.id,
      }),
    ]);

    mockAccountSession({ user });

    const reads = await countDatabaseRows(
      () => Promise.all([getLanguageUnitView({ chapterId: renting.id }), getLearnerSummary()]),
      '"merged_into_id" IS NOT NULL',
    );

    expect(reads.result[0].status).toBe("ready");
    expect(reads.rows).toBe(1);
  });
});
