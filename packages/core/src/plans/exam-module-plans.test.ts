import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  BIOLOGY,
  CHEMISTRY,
  ECONOMICS,
  LAW,
  MODULES,
  PREMED,
  READING_ES,
  moduleBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { chooseExamOption } from "../exams/choices/choose-exam-option";
import { hasUnpickedChoice } from "../exams/choices/load-exam-choices";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanGraph } from "./planner/plan-state";

const NOW = new Date("2020-09-28T12:00:00Z");
const TIME_ZONE = "America/Mexico_City";

const AREAS = [BIOLOGY, LAW, ECONOMICS, PREMED, CHEMISTRY, READING_ES];

async function setup() {
  const [user, blueprint] = await Promise.all([userFixture(), moduleBlueprintFixture()]);

  const library = await planLibraryFixture({ skills: AREAS.map((area) => ({ area, lessons: 1 })) });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "es",
    settings: { startDate: "2020-09-28" },
    timezone: TIME_ZONE,
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan };
}

async function loadStudiedAreas(planId: string): Promise<string[]> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const studied = new Set(parsePlanGraph(plan.graph).skills.map((skill) => skill.area));
  return AREAS.filter((area) => studied.has(area));
}

function pickModules({ goalId, subjects }: { goalId: string; subjects: string[] }) {
  return chooseExamOption({ goalId, input: { group: MODULES, subjects, timeZone: TIME_ZONE } });
}

describe("plans of an exam whose candidates take two of its modules", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("study no module and ask which ones until the learner picks them", async () => {
    const { goal, plan } = await setup();

    await expect(loadStudiedAreas(plan.id)).resolves.toStrictEqual([READING_ES]);
    await expect(hasUnpickedChoice(goal)).resolves.toBe(true);
  });

  it("study exactly the modules picked, and swap them when the pick changes", async () => {
    const { goal, plan } = await setup();

    const picked = await pickModules({ goalId: goal.id, subjects: [CHEMISTRY, BIOLOGY] });

    expect(picked.status).toBe("applied");

    await expect(loadStudiedAreas(plan.id)).resolves.toStrictEqual([
      BIOLOGY,
      CHEMISTRY,
      READING_ES,
    ]);

    await expect(hasUnpickedChoice(goal)).resolves.toBe(false);

    await pickModules({ goalId: goal.id, subjects: [PREMED] });

    await expect(loadStudiedAreas(plan.id)).resolves.toStrictEqual([PREMED, READING_ES]);
  });

  it("refuse more modules than candidates take", async () => {
    const { goal } = await setup();

    await expect(
      pickModules({ goalId: goal.id, subjects: [BIOLOGY, CHEMISTRY, LAW] }),
    ).resolves.toStrictEqual({ error: "unknownOption", status: "invalid" });
  });
});
