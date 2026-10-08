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

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const MINUTE_MS = 60_000;

const citation = { passage: "", sourceId: "notice" };

/** The request's clock, so the plan reads its wait at that instant. */
function setNow(now: Date) {
  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${TODAY}T00:00:00Z`),
    currentInstant: now,
    timeZone: "UTC",
  });
}

/** An exam goal whose plan was just built, before or from an estimated notice. */
async function builtExam({ days, year }: { days: string[]; year: number }) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
        citations: [],
        dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam" })),
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
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

    // A reading that lands in time is part of the plan, and the reveal waits while it's built.
    await expect(
      claimNoticeLanding({ goalId: goal.id, now: new Date(NOW.getTime() + 2 * MINUTE_MS) }),
    ).resolves.toBe(true);

    setNow(new Date(NOW.getTime() + 4 * MINUTE_MS));
    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: "reading" });

    // Past the wait, the learner sees the plan and the reading becomes a change to apply.
    const late = new Date(NOW.getTime() + 10 * MINUTE_MS);
    setNow(late);

    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: "usual" });
    await expect(claimNoticeLanding({ goalId: goal.id, now: late })).resolves.toBe(false);

    await endNoticeWait(goal.id);
    await expect(readPlan(goal.id)).resolves.toMatchObject({ notice: null });

    // When it stopped waiting is kept: what was read before then is the plan's own.
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    expect(plan).toMatchObject({ noticeWaitEndedAt: late, noticeWaitUntil: null });
  });

  it("says when the date it counts down to is an estimate, and when it's the notice's own", async () => {
    // The 2019 notice's first Sunday of November falls on the 1st in 2020.
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
