import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession, mockSession } from "../../_test-utils/mock-session";
import { type readPracticeMistakes } from "../../learner/facts/practice-mistakes";
import { type readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { getLearnerSummary } from "../../learner/summary/get-learner-summary";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
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

vi.mock("../../learner/facts/practice-mistakes", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readPracticeMistakes: typeof readPracticeMistakes }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readPracticeMistakes: keepRequestReads(actual.readPracticeMistakes) };
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

  it("checks the open mistakes' practice material once for the missions, the count and the summary", async () => {
    const user = await userFixture();

    const { goal, items, plan, skills } = await sessionGoalFixture({
      goal: { kind: "exam" },
      userId: user.id,
    });

    await Promise.all([
      layOutPlanFixture(plan.id),
      ...skills.map((skill, index) =>
        mistakeFixture({
          createdAt: daysAgo(2),
          itemId: items[index * 3]!.id,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    ]);

    mockAccountSession({ user });

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getTodayView({ goalId: goal.id, timeZone: "UTC" }),
          listCurrentUserMistakes({ goalId: goal.id, limit: 1, offset: 0, status: "open" }),
          getLearnerSummary(),
        ]),
      'SELECT "public"."items"."skill_id" FROM "public"."items"',
    );

    const [today, mistakes, summary] = reads.result;

    expect(today.status).toBe("ready");
    expect(mistakes).toMatchObject({ availability: { ready: skills.length, tomorrow: 0 } });
    expect(summary?.places.readyMistakes).toBe(skills.length);
    expect(reads.rows).toBe(skills.length);
  });
});
