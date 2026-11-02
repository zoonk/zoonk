import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { logError } from "@zoonk/utils/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { loadPlanContext } from "./_utils/plan-context";
import { computePlan } from "./_utils/replan";

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const NATURE = "Natural Sciences and their Technologies";
const MATH = "Mathematics and its Technologies";
const citation = { passage: "Syllabus", sourceId: "notice" };

function subject(name: string, topics: string[]) {
  return { citation, group: "Objective tests", name, questions: 45, topics, weight: null };
}

function skill(row: { id: string; name: string }, area: string, topics: string[]) {
  return { area, lessons: 2, name: row.name, phase: 0, skillId: row.id, topics };
}

async function createEntranceExamLearner({ dailyMinutes }: { dailyMinutes?: number } = {}) {
  const user = await userFixture();
  const today = toUTCMidnight(new Date());

  const [blueprint, cells, numbers] = await Promise.all([
    examBlueprintFixture({
      name: "Entrance exam",
      structure: {
        formats: [],
        mock: null,
        pastTopicFrequency: { checkedAt: new Date().toISOString(), subjects: [] },
        rules: [],
        subjects: [
          {
            ...subject(NATURE, [
              "Energy, work and power",
              "Molecules, cells and tissues",
              "Heredity and the diversity of life",
            ]),
            shortName: "Natural Sciences",
          },
          { ...subject(MATH, ["Numbers"]), shortName: "Mathematics" },
        ],
      },
    }),
    skillFixture({ name: "Explain how cells work" }),
    skillFixture({ name: "Work with numbers" }),
  ]);

  const goal = await goalFixture({
    details: {
      courseWeights: {
        course: "Medicine",
        edition: "SISU 2026",
        institution: "UFMG",
        source: { title: "Weights", url: "https://www.ufmg.br/sisu/weights.pdf" },
        status: "found",
        subjects: [
          { name: NATURE, weight: 2 },
          { name: MATH, weight: 1 },
        ],
      },
    },
    ...(dailyMinutes === undefined ? {} : { dailyMinutes }),
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(today.getTime() + 90 * MS_PER_DAY),
    timezone: "UTC",
    title: "Entrance exam",
    userId: user.id,
  });

  const [chapter, plan] = await Promise.all([
    libraryChapterFixture({ title: "Cells up close" }),
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: [
          skill(cells, NATURE, ["Molecules, cells and tissues"]),
          skill(numbers, MATH, ["Numbers"]),
        ],
      },
      phases: [{ name: "Foundations" }],
    }),
  ]);

  await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      planId: plan.id,
      position: 0,
      scheduledFor: today,
      skillId: cells.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal };
}

async function planBosses(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const context = await loadPlanContext({ goal });

  if (!context) {
    throw new Error("Expected the goal's plan");
  }

  const { built, state } = await computePlan({ context, mode: "forced" });

  const overflow = new Map(
    state.settings.checkpointOverflow.map((entry) => [entry.date, entry.minutes]),
  );

  return built.items
    .filter((item) => item.kind === "boss" && item.scheduledFor)
    .map((item) => {
      const date = item.scheduledFor?.toISOString().slice(0, 10) ?? "";
      return { date, minutes: item.minutes, overflow: overflow.get(date) ?? 0 };
    });
}

describe("an entrance exam plan's challenges", () => {
  afterEach(() => {
    vi.mocked(logError).mockClear();
  });

  it("opens the Plan, its challenges placed after the lessons they test", async () => {
    const { goal } = await createEntranceExamLearner();

    await expect(getPlanTabView({ goalId: goal.id })).resolves.toMatchObject({ status: "ready" });
    expect(logError).not.toHaveBeenCalled();
  });

  it("plans its challenges at 5 minutes a day", async () => {
    const { goal } = await createEntranceExamLearner({ dailyMinutes: 5 });
    const bosses = await planBosses(goal.id);

    expect(bosses.length).toBeGreaterThan(0);
    expect(logError).not.toHaveBeenCalled();
  });

  it("asks each challenge's day for all of its time, on top of its lessons", async () => {
    const { goal } = await createEntranceExamLearner();
    const bosses = await planBosses(goal.id);

    expect(bosses.length).toBeGreaterThan(0);
    expect(bosses.every((boss) => boss.minutes > 0 && boss.overflow >= boss.minutes)).toBe(true);
    expect(logError).not.toHaveBeenCalled();
  });
});
