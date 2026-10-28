import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "./notice-wait";

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const MINUTE_MS = 60_000;

const citation = { passage: "", sourceId: "notice" };

function setNow(now: Date) {
  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${TODAY}T00:00:00Z`),
    currentInstant: now,
    timeZone: "UTC",
  });
}

async function builtExam({ days, year }: { days: string[]; year: number }) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: days.map((date) => ({
          citation,
          date,
          kind: "exam",
          label: "Exam",
          startTime: null,
        })),
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year,
      },
    }),
    planLibraryFixture({ skills: [{ lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: { examName: "Test Exam" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return goal;
}

async function readPlan(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`The plan isn't ready: ${result.status}`);
  }

  return result.plan;
}

describe("an exam plan waiting for its notice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setNow(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the notice while the wait runs, then follows the usual structure until it lands", async () => {
    const goal = await builtExam({ days: ["2020-11-08"], year: 2020 });

    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: null });

    await startNoticeWait({ goalId: goal.id, now: NOW });
    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: "reading" });

    await expect(
      claimNoticeLanding({ goalId: goal.id, now: new Date(NOW.getTime() + 2 * MINUTE_MS) }),
    ).resolves.toBe(true);

    setNow(new Date(NOW.getTime() + 4 * MINUTE_MS));
    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: "reading" });

    const late = new Date(NOW.getTime() + 10 * MINUTE_MS);
    setNow(late);

    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: "usual" });
    await expect(claimNoticeLanding({ goalId: goal.id, now: late })).resolves.toBe(false);

    await endNoticeWait(goal.id);
    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: null });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    expect(plan).toMatchObject({ noticeWaitEndedAt: late, noticeWaitUntil: null });
  });

  it("says when the date it counts down to is an estimate, and when it's the notice's own", async () => {
    const estimated = await builtExam({ days: ["2019-11-03"], year: 2019 });

    await expect(readPlan(estimated.id)).resolves.toMatchObject({
      schedule: { targetDate: "2020-11-01", targetDateEstimated: true },
    });

    const official = await builtExam({ days: ["2020-11-08"], year: 2020 });

    await expect(readPlan(official.id)).resolves.toMatchObject({
      schedule: { targetDate: "2020-11-08", targetDateEstimated: false },
    });
  });
});
