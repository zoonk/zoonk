import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations } from "./_utils/part-areas";
import { createGoalPlan } from "./create-goal-plan";
import { type LearnerPlanOperation } from "./plan-contract";

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const LANGUAGES = "Linguagens";
const ENGLISH = "Língua Inglesa";
const MATH = "Matemática";

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

async function loadContext(focusAreas: string[]) {
  const user = await userFixture();
  const areas = [LANGUAGES, ENGLISH, MATH];

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({
      structure: examStructureSchema.parse({
        formats: [],
        mock: null,
        rules: [],
        subjects: areas.map((name) => ({
          citation,
          name,
          partOf: name === ENGLISH ? LANGUAGES : null,
          questions: 10,
          topics: [`${name}: fundamentos`],
          weight: null,
        })),
      }),
    }),
    planLibraryFixture({ skills: areas.map((area) => ({ area, lessons: 2 })) }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { focusAreas, startDate: "2020-09-28" },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const owned = await findOwnedPlan({ goalId: goal.id, timeZone: "UTC" });

  if (owned.status !== "ready") {
    throw new Error("Expected the learner's plan");
  }

  return owned.context;
}

async function focus({ areas, from }: { areas: string[]; from: string[] }) {
  const operations: LearnerPlanOperation[] = [{ areas, kind: "focusAreas" }];
  const result = await applyChangeOperations({ context: await loadContext(from), operations });

  if ("error" in result) {
    throw new Error(`Expected the focus to apply: ${result.error}`);
  }

  return result;
}

describe("a focus on the subject the learner's foreign language is part of", () => {
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

  it("focuses the language with Linguagens, and plans the change with it", async () => {
    const result = await focus({ areas: [LANGUAGES], from: [] });

    expect(result.operations).toStrictEqual([{ areas: [LANGUAGES, ENGLISH], kind: "focusAreas" }]);

    expect(result.state.settings.focusAreas).toStrictEqual([LANGUAGES, ENGLISH]);
  });

  it("takes the language out of focus with Linguagens", async () => {
    const result = await focus({ areas: [MATH], from: [LANGUAGES, ENGLISH] });

    expect(result.operations).toStrictEqual([{ areas: [MATH], kind: "focusAreas" }]);
    expect(result.state.settings.focusAreas).toStrictEqual([MATH]);
  });
});
