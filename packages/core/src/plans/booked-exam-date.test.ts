import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");
const citation = { passage: "", sourceId: "notice" };

async function plannedExam(examDay: "booked" | "official") {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam", startTime: null }],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2020,
      },
    }),
    planLibraryFixture({ skills: [{ lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: { examDay, examName: "Test Exam" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: null,
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  return saved.targetDate?.toISOString().slice(0, 10) ?? null;
}

describe("a booked exam's date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never takes the notice's day, which only an official exam's candidates all sit", async () => {
    await expect(plannedExam("booked")).resolves.toBeNull();
    await expect(plannedExam("official")).resolves.toBe("2020-11-15");
  });
});
