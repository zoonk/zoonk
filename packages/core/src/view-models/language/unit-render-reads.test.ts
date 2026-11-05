import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../_test-utils/mock-session";
import { type readActiveSubscription } from "../../learner/facts/subscription";
import { getLearnerSummary } from "../../learner/summary/get-learner-summary";
import { getPlanTabView } from "../plan/get-plan-view";
import { getLanguageUnitView } from "./get-language-unit-view";

vi.mock("../../learner/facts/subscription", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readActiveSubscription: typeof readActiveSubscription }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readActiveSubscription: keepRequestReads(actual.readActiveSubscription) };
});

describe("a language unit's render reads", () => {
  it("reads a Plus learner's subscription once for the unit, the plan and the learner summary", async () => {
    const { renting, user } = await languageGoalFixture();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    mockAccountSession({ user });

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getLanguageUnitView({ chapterId: renting.id }),
          getPlanTabView(),
          getLearnerSummary(),
        ]),
      'FROM "public"."subscriptions"',
    );

    const [unit, plan, summary] = reads.result;

    const lockedChallenges =
      plan.status === "ready"
        ? plan.view.plan.phases.flatMap((phase) => phase.checkpoint?.locked ?? [])
        : null;

    expect({
      lockedChallenges,
      plusOnlyCallMinutes: unit.status === "ready" ? unit.unit.conversation.plusMinutes : null,
      tier: summary?.tier,
    }).toStrictEqual({ lockedChallenges: [false, false], plusOnlyCallMinutes: [], tier: "plus" });

    expect(reads.rows).toBe(1);
  });
});
