import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { endFollowUp, listFollowUps } from "../../follow-ups/follow-up-rows";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createSetUpGoalPlan } from "../../plans/_test-utils/set-up-plan";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { findPlanTimeToCover } from "../../plans/get-time-advice";
import { endNoticeWait } from "../../plans/notice-wait";
import { runPlanSetupTask } from "../../plans/plan-setup";
import { getOnboarding } from "./get-onboarding";

const BUILDING = { readingNotice: false, ready: false };
const READING_NOTICE = { readingNotice: true, ready: false };
const READY = { readingNotice: false, ready: true };

async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] });
  const { goal } = await unplannedGoalFixture({ dailyMinutes: 15, userId: user.id });

  mockSession(user.id);

  return { goal, library };
}

async function readReadiness(goalId: string) {
  const [view, time] = await Promise.all([
    getOnboarding({ goalId }),
    findPlanTimeToCover({ goalId, input: {} }),
  ]);

  if (view.status !== "ready" || time.status !== "ready") {
    throw new Error(`Expected the onboarding and the time, got ${view.status} and ${time.status}`);
  }

  const { readingNotice, ready } = time.time;

  return { time: { readingNotice, ready }, view: view.onboarding.planReadiness };
}

describe("the onboarding view's plan readiness", () => {
  it("holds the old plan's reveal while its rebuild is owed or running", async () => {
    const { goal, library } = await setup();
    await createSetUpGoalPlan({ goalId: goal.id, graph: library.graph });
    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: READY, view: READY });

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: goal.userId,
    });

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: BUILDING, view: BUILDING });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { ready: false },
      status: "ready",
    });

    const [owed] = await listFollowUps(goal.userId);
    await endFollowUp({ id: owed!.id, revision: owed!.revision });

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: READY, view: READY });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { ready: true },
      status: "ready",
    });
  });

  it("says the plan isn't ready while it's built or waits for placement, as the time answers do", async () => {
    const { goal, library } = await setup();

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: BUILDING, view: BUILDING });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: BUILDING, view: BUILDING });

    await runPlanSetupTask({ goalId: goal.id, task: "placement" });

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: READY, view: READY });
  });

  it("says the plan waits while its exam's notice is read, as the time answers do", async () => {
    const { goal, library } = await setup();
    await createSetUpGoalPlan({ goalId: goal.id, graph: library.graph, waitsForNotice: true });

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({
      time: READING_NOTICE,
      view: READING_NOTICE,
    });

    await endNoticeWait(goal.id);

    await expect(readReadiness(goal.id)).resolves.toStrictEqual({ time: READY, view: READY });
  });
});
