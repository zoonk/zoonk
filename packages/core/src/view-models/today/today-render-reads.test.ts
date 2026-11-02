import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type readPreparationInputs } from "../../learner/facts/preparation-inputs";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getSyllabusView } from "../syllabus/get-syllabus-view";
import { getTodayView } from "./get-today-view";

vi.mock("../../learner/facts/preparation-inputs", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readPreparationInputs: typeof readPreparationInputs }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readPreparationInputs: keepRequestReads(actual.readPreparationInputs) };
});

describe("Today's render reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads preparation once for the day's weak spot, its progress and the syllabus", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await sessionGoalFixture({
      goal: { kind: "exam" },
      itemsPerSkill: 20,
      userId: user.id,
    });

    await Promise.all([
      layOutPlanFixture(plan.id),
      ...skills.flatMap((skill) => [
        dueSkillFixture({ skillId: skill.id, userId: user.id }),
        attemptFixture({ answeredAt: daysAgo(4), skillId: skill.id, userId: user.id }),
      ]),
    ]);

    mockSession(user.id);

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getTodayView({ goalId: goal.id, timeZone: "UTC" }),
          getSyllabusView({ goalId: goal.id }),
        ]),
      '"_min$answered_at"',
    );

    expect(reads.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(reads.rows).toBe(skills.length);
  });
});
