import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanEffect } from "./planner/plan-effect";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const AREAS = ["Matemática", "Natureza", "Humanas"] as const;

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

/** Each area's basics in the first phase and what builds on them in the next, a topic each. */
const SKILLS = AREAS.flatMap((area) => [
  { area, lessons: 6, phase: 0, topic: `${area}: fundamentos` },
  { area, lessons: 6, phase: 1, topic: `${area}: aplicação` },
]);

/** An exam learner short on time: the plan can't teach every topic by the exam. */
async function setup({ dailyMinutes, daysAway }: { dailyMinutes: number; daysAway: number }) {
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

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      topics: [SKILLS[index]?.topic ?? ""],
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date(NOW.getTime() + daysAway * 86_400_000),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  return { goal, library, plan };
}

/** The notice topics the plan's lesson items teach, whatever their status. */
async function plannedTopics({
  library,
  planId,
}: {
  library: { skills: readonly { id: string }[] };
  planId: string;
}): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId } });
  const skillIds = new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  return new Set(
    library.skills.flatMap((skill, index) =>
      skillIds.has(skill.id) ? [SKILLS[index]?.topic ?? ""] : [],
    ),
  );
}

/** The topics a change's effect names coming in and leaving, flattened. */
function namedTopics(effect: PlanEffect | undefined) {
  return {
    added: (effect?.topicsAdded ?? []).flatMap((area) => area.topics).toSorted(),
    leftOut: (effect?.topicsLeftOut ?? []).flatMap((area) => area.topics).toSorted(),
  };
}

/** What a recorded change says it did, from its saved payload. */
async function readChange({
  kind,
  planId,
}: {
  kind: "missedDays" | "resumed" | "testedOut";
  planId: string;
}) {
  const change = await prisma.planChange.findFirstOrThrow({ where: { kind, planId } });
  const { effect } = change.payload as { effect?: PlanEffect };

  return namedTopics(effect);
}

/** The topics one set has that the other doesn't. */
function difference(from: Set<string>, to: Set<string>): string[] {
  return [...from].filter((topic) => !to.has(topic)).toSorted();
}

describe("a change the learner didn't make names the topics it moves", () => {
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

  // Placement found the learner knows mathematics' basics: the time it frees brings mathematics'
  // application into a plan short on time, and the test-out's change says so.
  it("names the topics a test-out brings into the plan", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 5, daysAway: 14 });
    const before = await plannedTopics({ library, planId: plan.id });
    const [known] = library.skills;

    if (!known) {
      throw new Error("The library has no skills.");
    }

    const { items } = await loadGoalPlan(goal.id);

    await markPlanItemsTestedOut({
      goalId: goal.id,
      items,
      knownSkillIds: new Set([known.id]),
      testedOutAt: NOW,
      timeZone: "UTC",
    });

    const after = await plannedTopics({ library, planId: plan.id });

    expect(difference(after, before)).toStrictEqual(["Matemática: aplicação"]);

    await expect(readChange({ kind: "testedOut", planId: plan.id })).resolves.toStrictEqual({
      added: ["Matemática: aplicação"],
      leftOut: [],
    });
  });

  // Four days missed on a plan that just fit: what's left no longer fits by the exam, and the
  // missed-days change names what leaves, not only that the plan covers less.
  it("names the topics missed days leave out of the plan", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 10, daysAway: 14 });
    const before = await plannedTopics({ library, planId: plan.id });

    vi.setSystemTime(new Date("2020-10-02T12:00:00Z"));
    await refreshGoalPlan({ goalId: goal.id });

    const after = await plannedTopics({ library, planId: plan.id });
    const leftOut = difference(before, after);

    expect(leftOut.length).toBeGreaterThan(0);

    await expect(readChange({ kind: "missedDays", planId: plan.id })).resolves.toStrictEqual({
      added: difference(after, before),
      leftOut,
    });
  });

  // Back from a pause with less time left: the resumed plan names what no longer fits.
  it("names the topics a goal back from a pause leaves out of the plan", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 10, daysAway: 14 });
    const before = await plannedTopics({ library, planId: plan.id });

    await updateGoal({ goalId: goal.id, input: { status: "paused" } });
    vi.setSystemTime(new Date("2020-10-02T12:00:00Z"));
    await updateGoal({ goalId: goal.id, input: { status: "active" } });

    const after = await plannedTopics({ library, planId: plan.id });
    const leftOut = difference(before, after);

    expect(leftOut.length).toBeGreaterThan(0);

    await expect(readChange({ kind: "resumed", planId: plan.id })).resolves.toStrictEqual({
      added: difference(after, before),
      leftOut,
    });
  });
});
