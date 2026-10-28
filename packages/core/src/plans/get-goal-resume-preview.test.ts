import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { keptEndPlanFixture, readPlan } from "./_test-utils/kept-end-plan";
import { getGoalResumePreview } from "./get-goal-resume-preview";

/** The Monday the plan starts, and the Thursday the learner comes back after pausing on it. */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const THURSDAY = new Date("2020-10-01T12:00:00Z");

function setNow(now: Date) {
  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`),
    currentInstant: now,
    timeZone: "UTC",
  });
}

/** A paused goal whose plan had lessons for the days of the pause. */
async function pausedGoal() {
  const fixture = await keptEndPlanFixture();
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: fixture.user.id });
  await updateGoal({ goalId: fixture.goal.id, input: { status: "paused" } });
  return fixture;
}

describe(getGoalResumePreview, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setNow(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says resuming changes nothing when the pause left nothing behind", async () => {
    const { goal } = await pausedGoal();

    await expect(getGoalResumePreview(goal.id)).resolves.toStrictEqual({
      preview: { effect: null, feasibility: null, ready: true, unchanged: true },
      status: "ready",
    });
  });

  // Back after days with lessons on them, the plan starts again from today: the learner sees what
  // that moves before they resume, and resuming then does what they saw.
  it("reads a generic resume preview and saves the exact move on resume", async () => {
    const { goal, plan } = await pausedGoal();
    const shown = await readPlan(plan.id);
    setNow(THURSDAY);

    const result = await getGoalResumePreview(goal.id);
    const preview = result.status === "ready" ? result.preview : null;

    // The kept end of the first phase moves back to its lessons: the preview names it.
    expect(preview).toMatchObject({ effect: null, ready: true, unchanged: false });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);

    const resumed = await updateGoal({ goalId: goal.id, input: { status: "active" } });

    expect(resumed).toMatchObject({
      change: {
        effect: { phaseEnds: [expect.objectContaining({ name: "Basics" })] },
        kind: "resumed",
      },
    });
  });

  it("keeps another learner's goal hidden, and needs a signed-in learner", async () => {
    const { goal } = await pausedGoal();
    const other = await userFixture();

    mockSession(other.id);
    await expect(getGoalResumePreview(goal.id)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(getGoalResumePreview(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "paused",
    });
  });
});
