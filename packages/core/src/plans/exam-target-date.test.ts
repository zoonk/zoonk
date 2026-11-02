import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

/** A Monday in 2020, before the learning events other tests write. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

const citation = { passage: "", sourceId: "notice" };

function examBlueprint({ days, year }: { days: string[]; year: number }) {
  return examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam", startTime: null })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year,
    },
  });
}

type PlanExamInput = {
  days: string[];
  examMonth?: number | null;
  examYear: number | null;
  year: number;
};

async function planExamGoal({
  days,
  examMonth = null,
  examYear,
  year,
}: PlanExamInput): Promise<{ goalId: string; targetDate: string | null }> {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprint({ days, year }),
    planLibraryFixture({ skills: [{ lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: { examName: "Test Exam", ...(examYear === null ? {} : { examMonth, examYear }) },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const planned = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  return { goalId: goal.id, targetDate: planned.targetDate?.toISOString().slice(0, 10) ?? null };
}

async function planExam(input: PlanExamInput): Promise<string | null> {
  const { targetDate } = await planExamGoal(input);
  return targetDate;
}

function findNoticeProposals(goalId: string) {
  return prisma.planChange.findMany({
    where: {
      payload: { equals: "notice", path: ["source"] },
      plan: { goalId },
      status: "proposed",
    },
  });
}

describe("the date an exam plan counts down to", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(`${TODAY}T00:00:00Z`),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the first exam day of the notice for the year the learner named", async () => {
    await expect(
      planExam({ days: ["2020-11-08", "2020-11-15"], examYear: 2020, year: 2020 }),
    ).resolves.toBe("2020-11-08");
  });

  it("is the estimated first day of a year the notice isn't for, the day the exam screen shows", async () => {
    await expect(
      planExam({ days: ["2020-11-08", "2020-11-15"], examYear: 2021, year: 2020 }),
    ).resolves.toBe("2021-11-14");
  });

  it("is the estimated day in the month the learner named", async () => {
    await expect(
      planExam({ days: ["2020-11-08"], examMonth: 3, examYear: 2021, year: 2020 }),
    ).resolves.toBe("2021-03-14");
  });

  it("follows the notice's day when it's in the month the learner named", async () => {
    const planned = await planExamGoal({
      days: ["2020-11-08"],
      examMonth: 11,
      examYear: 2020,
      year: 2020,
    });

    expect(planned.targetDate).toBe("2020-11-08");
    await expect(findNoticeProposals(planned.goalId)).resolves.toStrictEqual([]);
  });

  it("is the next edition's estimated first day once the notice's days passed", async () => {
    await expect(
      planExam({ days: ["2019-11-03", "2019-11-10"], examYear: null, year: 2019 }),
    ).resolves.toBe("2020-11-01");
  });
});
