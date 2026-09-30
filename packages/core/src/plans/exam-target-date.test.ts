import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

const citation = { passage: "", sourceId: "notice" };

/** A stored notice with its exam days. */
function examBlueprint({ days, year }: { days: string[]; year: number }) {
  return examBlueprintFixture({
    edition: {
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam" })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      year,
    },
  });
}

/**
 * Plans an exam goal without a date of its own for the stored notice, with the year the learner
 * named, and returns the date the plan counts down to.
 */
async function planExam({
  days,
  examYear,
  year,
}: {
  days: string[];
  examYear: number | null;
  year: number;
}): Promise<string | null> {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprint({ days, year }),
    planLibraryFixture({ skills: [{ lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: examYear === null ? { examName: "Test Exam" } : { examName: "Test Exam", examYear },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const planned = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  return planned.targetDate?.toISOString().slice(0, 10) ?? null;
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

  it("is two weeks before the estimated first day of a year the notice isn't for", async () => {
    // The notice's 2nd and 3rd Sundays of November fall on the 13th and 20th in 2022.
    await expect(
      planExam({ days: ["2020-11-08", "2020-11-15"], examYear: 2022, year: 2020 }),
    ).resolves.toBe("2022-10-30");
  });

  it("is two weeks before the next edition's estimated first day once the notice's days passed", async () => {
    await expect(
      planExam({ days: ["2019-11-03", "2019-11-10"], examYear: null, year: 2019 }),
    ).resolves.toBe("2020-10-18");
  });

  it("is the estimated day itself when two weeks before it has already passed", async () => {
    await expect(planExam({ days: ["2021-10-03"], examYear: 2020, year: 2021 })).resolves.toBe(
      "2020-10-04",
    );
  });
});
