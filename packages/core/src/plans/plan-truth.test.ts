import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { type LearnerPlanOperation } from "./plan-contract";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const AREAS = ["Matemática", "Direito", "Inglês"] as const;

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

/** Each area's basics in the first phase and what builds on them in the next, a topic each. */
const SKILLS = AREAS.flatMap((area) => [
  { area, lessons: 6, phase: 0, topic: `${area}: fundamentos` },
  { area, lessons: 6, phase: 1, topic: `${area}: aplicação` },
]);

/**
 * An exam learner whose Library lessons take twice the time the skill graph sized them at, as
 * written lessons often do, three weeks before the exam.
 */
async function setup({ dailyMinutes }: { dailyMinutes: number }) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: AREAS.map((area) => ({
        citation,
        name: area,
        questions: 10,
        topics: SKILLS.filter((skill) => skill.area === area).map((skill) => skill.topic),
        weight: null,
      })),
    },
  });

  const library = await planLibraryFixture({ phases: ["Basics", "Further"], skills: SKILLS });

  await prisma.lesson.updateMany({
    data: { estimatedMinutes: 6 },
    where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      topics: [SKILLS[index]?.topic ?? ""],
    })),
  };

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  return { goal, library, user };
}

/** What the plan's headline says about every topic, and what each subject page says. */
async function readTruth(goalId: string) {
  const [plan, syllabus] = await Promise.all([getGoalPlan(goalId), getSyllabusView({ goalId })]);
  const feasibility = plan.status === "ready" ? plan.plan.feasibility : null;

  const topics =
    syllabus.status === "ready"
      ? syllabus.syllabus.subjects.flatMap((subject) => subject.topics)
      : [];

  return {
    coreFits: feasibility?.coreFits ?? null,
    coreMinutes: feasibility?.coreMinutes ?? null,
    outForTime: topics
      .filter((topic) => topic.status === "notPlanned" && topic.notPlannedReason === "time")
      .map((topic) => topic.name),
    reasons: Object.fromEntries(topics.map((topic) => [topic.name, topic.notPlannedReason])),
  };
}

async function change(goalId: string, operations: LearnerPlanOperation[]) {
  const result = await changeGoalPlan({ goalId, input: { operations } });
  expect(result.status).toBe("applied");
}

describe("a plan's headline and its topics tell one truth", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps every topic's core through a focus, harder lessons and more time, and says so", async () => {
    const { goal } = await setup({ dailyMinutes: 30 });

    const first = await readTruth(goal.id);
    expect(first).toMatchObject({ coreFits: true, outForTime: [] });

    await change(goal.id, [{ areas: ["Inglês"], kind: "focusAreas" }]);
    await expect(readTruth(goal.id)).resolves.toMatchObject({ coreFits: true, outForTime: [] });

    await change(goal.id, [{ bias: "harder", kind: "setDifficultyBias" }]);
    await expect(readTruth(goal.id)).resolves.toMatchObject({ coreFits: true, outForTime: [] });

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: 60 }]);
    await expect(readTruth(goal.id)).resolves.toMatchObject({ coreFits: true, outForTime: [] });
  });

  it("says topics don't fit exactly when subject pages leave some out, and the time that brings them in", async () => {
    // Enough time for every topic as the skill graph sizes them, not as the lessons are written.
    const { goal } = await setup({ dailyMinutes: 8 });

    const short = await readTruth(goal.id);

    expect(short.outForTime.length).toBeGreaterThan(0);
    expect(short.coreFits).toBe(false);
    expect(short.coreMinutes).not.toBeNull();

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: short.coreMinutes ?? 0 }]);

    await expect(readTruth(goal.id)).resolves.toMatchObject({ coreFits: true, outForTime: [] });
  });

  it("says a subject's basics are past, not out of time, once harder lessons skip them", async () => {
    const { goal, library, user } = await setup({ dailyMinutes: 30 });

    // Right every time in law's basics: harder lessons start law past them.
    await Promise.all(
      Array.from({ length: 8 }, () =>
        attemptFixture({ skillId: library.skills[2]?.id ?? "", userId: user.id }),
      ),
    );

    await change(goal.id, [{ bias: "harder", kind: "setDifficultyBias" }]);

    const truth = await readTruth(goal.id);

    expect(truth.reasons["Direito: fundamentos"]).toBe("pastBasics");
    expect(truth).toMatchObject({ coreFits: true, outForTime: [] });
  });
});
