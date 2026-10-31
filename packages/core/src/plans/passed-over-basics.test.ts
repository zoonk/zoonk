import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { loadPracticeClaims } from "../sessions/_utils/practice-claims";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { bringBackMissedLessons } from "./bring-back-missed-lessons";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanGraph } from "./planner/plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");
const DAY_MS = 86_400_000;

function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

function setClock(offset: number) {
  const now = new Date(day(offset).getTime() + 12 * 60 * 60 * 1000);

  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: day(offset),
    currentInstant: now,
    timeZone: "UTC",
  });
}

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Deeper"],
    skills: [
      { area: "English", lessons: 2, phase: 0 },
      { area: "English", lessons: 2, phase: 0 },
      { area: "English", builds: 0, lessons: 2, phase: 1 },
      { area: "English", builds: 1, lessons: 2, phase: 1 },
      { area: "Law", lessons: 4, phase: 0 },
    ],
  });

  const [grammar, vocabulary] = library.skills as [Skill, Skill];

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    settings: { startDate: "2026-10-12" },
    timezone: "UTC",
    userId: user.id,
  });

  const items = await Promise.all(
    library.skills.flatMap((skill) =>
      [0, 1, 2].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    ),
  );

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const changed = await changeGoalPlan({
    goalId: goal.id,
    input: { operations: [{ areas: ["English"], kind: "setAreaStart", start: "pastBasics" }] },
  });

  expect(changed.status).toBe("applied");

  const itemsOf = (skill: Skill) =>
    items.filter((item) => item.skillId === skill.id).map((item) => item.id);

  return { goal, grammar, itemsOf, plan, user, vocabulary };
}

function countTodo({ planId, skillId }: { planId: string; skillId: string }) {
  return prisma.planItem.count({ where: { kind: "lesson", planId, skillId, status: "todo" } });
}

describe("basics a learner passed over as too basic", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("are asked in practice within two weeks, and a miss brings back only that one's lessons", async () => {
    const { goal, grammar, itemsOf, plan, user, vocabulary } = await setup();

    await expect(countTodo({ planId: plan.id, skillId: grammar.id })).resolves.toBe(0);
    await expect(countTodo({ planId: plan.id, skillId: vocabulary.id })).resolves.toBe(0);

    setClock(7);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const claims = await loadPracticeClaims({
      goal,
      graph: parsePlanGraph(saved.graph),
      now: new Date(),
      skillIds: [grammar.id, vocabulary.id],
      today: day(7),
      userId: user.id,
    });

    expect([...claims.first].toSorted()).toStrictEqual([grammar.id, vocabulary.id].toSorted());

    const skillIds = [grammar.id];

    await expect(
      loadSkillsToConfirm({ goalId: goal.id, skillIds, userId: user.id }),
    ).resolves.toStrictEqual(new Set(skillIds));

    const [question] = itemsOf(grammar);

    await attemptFixture({
      isCorrect: false,
      itemId: question ?? null,
      skillId: grammar.id,
      userId: user.id,
    });

    await bringBackMissedLessons({ goalId: goal.id, now: new Date(), skillIds, timeZone: "UTC" });

    await expect(countTodo({ planId: plan.id, skillId: grammar.id })).resolves.toBeGreaterThan(0);
    await expect(countTodo({ planId: plan.id, skillId: vocabulary.id })).resolves.toBe(0);

    const relearn = await prisma.planChange.findFirstOrThrow({
      where: { kind: "relearn", planId: plan.id },
    });

    expect(relearn.payload).toMatchObject({
      effect: { topicsAdded: [{ area: "English", topics: [grammar.name] }] },
    });
  });
});
