import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { loadGoalPreparation } from "../../preparation/_utils/load-goal-preparation";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { readStudyDay } from "../../sessions/_utils/read-study-day";
import { getSelectedCatchUpItems } from "../../sessions/_utils/selected-day-plan";
import { openStudyDay } from "../../sessions/open-study-day";
import { getTodayView } from "./get-today-view";

describe("Today preparation read budgets", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["exam", "learn", "language"] as const)(
    "reuses authorized %s preparation facts on preview and the saved day",
    async (kind) => {
      const user = await userFixture();

      const { goal } = await sessionGoalFixture({
        goal: { kind, targetLanguage: kind === "language" ? "en" : null },
        userId: user.id,
      });

      mockSession(user.id);

      const preview = await countDatabaseStatements(() =>
        getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      );

      const preparation = await getGoalPreparation(goal.id);
      expect(preview.result.status).toBe("ready");
      expect(preparation.status).toBe("ready");

      if (preview.result.status !== "ready" || preparation.status !== "ready") {
        throw new Error("Expected owned Today and preparation");
      }

      expect(preview.result.today.progress?.value).toBe(preparation.preparation.value);

      const opened = await openStudyDay({
        goalId: goal.id,
        keepEmpty: true,
        shownDate: "2026-09-30",
        timeZone: "UTC",
      });

      expect(opened.status).toBe("opened");

      const saved = await countDatabaseStatements(() =>
        getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      );

      expect(saved.result.status).toBe("ready");

      if (saved.result.status !== "ready") {
        throw new Error("Expected the saved day");
      }

      expect(saved.result.today.progress).toStrictEqual(preview.result.today.progress);
      const budgets = { exam: [106, 66], language: [134, 78], learn: [114, 77] } as const;
      assertReadBudget(preview, budgets[kind][0]);
      assertReadBudget(saved, budgets[kind][1]);
    },
  );

  it("uses selected zero catch-up rather than re-reading the saved overdue allocation", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: SESSION_NOW,
      dailyMinutes: 12,
      kind: "exam",
      settings: { startDate: "2026-09-30" },
      targetDate: new Date("2026-10-30T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    const day = await readStudyDay({ goal, now: new Date(), timeZone: "UTC", userId: user.id });
    expect(day?.selection?.computed).toBeNull();

    if (!day?.selection) {
      throw new Error("Expected the moved-forward selected plan");
    }

    const selectedPlan = { ...day.selection.context, catchUp: 0 };

    const counted = await countDatabaseStatements(() =>
      loadGoalPreparation({ goalId: goal.id, selectedPlan }),
    );

    expect(counted.result.status).toBe("ready");

    expect(counted.result.status === "ready" && counted.result.preparation.status?.kind).toBe(
      "behind",
    );

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    assertReadBudget(counted, 23);
  });

  it("keeps explanations outside preparation even when the learner has a study goal", async () => {
    const user = await userFixture();

    const [{ goal }] = await Promise.all([
      sessionGoalFixture({ goal: { kind: "explain" }, userId: user.id }),
      goalFixture({ kind: "learn", userId: user.id }),
    ]);

    mockSession(user.id);

    const result = await countDatabaseStatements(() =>
      getTodayView({ goalId: goal.id, timeZone: "UTC" }),
    );

    expect(result.result.status).toBe("ready");
    expect(result.result.status === "ready" && result.result.today.progress).toBeNull();
    expect(result.writes).toBe(0);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it.each(["exam", "learn", "language"] as const)(
    "preserves %s evidence and selected status through the public computed Today read",
    async (kind) => {
      vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

      const [user, library] = await Promise.all([
        userFixture(),
        planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
      ]);

      const { goal } = await unplannedGoalFixture({
        createdAt: new Date(),
        dailyMinutes: 12,
        details: { placementDeclined: true },
        kind,
        settings: { startDate: "2020-09-28" },
        targetDate: new Date("2020-10-30T00:00:00Z"),
        targetLanguage: kind === "language" ? "en" : null,
        timezone: "UTC",
        userId: user.id,
      });

      mockSession(user.id);
      await createGoalPlan({ goalId: goal.id, graph: library.graph });
      const goalPlan = await loadGoalPlan(goal.id);
      const first = goalPlan.skills.at(0);

      if (!first) {
        throw new Error("Expected the first actual measured plan skill");
      }

      await Promise.all([
        learnerSkillFixture({
          createdAt: new Date(),
          difficulty: 5,
          lastReviewedAt: new Date(),
          recallDays: 10,
          reps: 2,
          skillId: first.id,
          stability: 10,
          state: "learning",
          userId: user.id,
        }),
        attemptFixture({ answeredAt: new Date(), skillId: first.id, userId: user.id }),
      ]);

      vi.setSystemTime(new Date("2020-10-01T12:00:00Z"));
      const day = await readStudyDay({ goal, now: new Date(), timeZone: "UTC", userId: user.id });
      expect(day?.selection?.computed).toBeNull();

      if (!day?.selection) {
        throw new Error("Expected an authorized moved-forward selection");
      }

      expect(day.selection.left.length).toBeGreaterThan(0);
      const catchUp = getSelectedCatchUpItems(day.selection).length;
      expect(catchUp).toBeGreaterThan(0);
      const selectedPlan = { ...day.selection.context, catchUp };
      const evidence = await getGoalPreparation(goal.id);
      const projected = await loadGoalPreparation({ goalId: goal.id, selectedPlan });

      const preview = await countDatabaseStatements(() =>
        getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      );

      if (
        evidence.status !== "ready" ||
        projected.status !== "ready" ||
        preview.result.status !== "ready"
      ) {
        throw new Error("Expected owned public preparation and computed Today");
      }

      expect(evidence.preparation.value).toBeGreaterThan(0);
      expect(evidence.preparation.components.coverage.studiedSkills).toBe(1);

      expect({ ...projected.preparation, status: null }).toStrictEqual({
        ...evidence.preparation,
        status: null,
      });

      expect(preview.result.today.progress?.status).toStrictEqual(projected.preparation.status);
      expect(preview.writes).toBe(0);

      const opened = await openStudyDay({
        goalId: goal.id,
        keepEmpty: true,
        shownDate: "2020-10-01",
        timeZone: "UTC",
      });

      expect(opened.status).toBe("opened");

      const saved = await countDatabaseStatements(() =>
        getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      );

      if (saved.result.status !== "ready") {
        throw new Error("Expected the same saved Today");
      }

      expect(saved.result.today.progress?.value).toBe(preview.result.today.progress?.value);
      expect(saved.writes).toBe(0);
      const afterEvidence = await getGoalPreparation(goal.id);

      if (afterEvidence.status !== "ready") {
        throw new Error("Expected saved preparation evidence");
      }

      expect({ ...afterEvidence.preparation, status: null }).toStrictEqual({
        ...evidence.preparation,
        status: null,
      });
    },
  );
});
