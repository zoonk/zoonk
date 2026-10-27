import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { decidePlanChange } from "../plans/decide-plan-change";
import { getTodayStudySession } from "./_test-utils/open-today";
import { loadDayPlan } from "./_utils/day-plan";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { followPlanChangeToday } from "./_utils/refresh-day-session";
import { readBlockPayload } from "./block-payload";
import { loadDayMissionFacts } from "./missions/day-facts";

const DATE = new Date("2020-09-28T00:00:00Z");
const pending = new Set<Promise<void>>();

function runBody(body: () => Promise<void>) {
  const promise = body();
  pending.add(promise);
  return promise.finally(() => pending.delete(promise));
}

async function setup(spent: number, open = true) {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({
    activeGoalId: goal.id,
    dailyLimitMinutes: spent > 0 ? 30 : null,
    userId: user.id,
  });

  if (spent > 0) {
    await prisma.dailyProgress.create({
      data: {
        date: DATE,
        dayOfWeek: DATE.getUTCDay(),
        timeSpentSeconds: spent * 60,
        userId: user.id,
      },
    });
  }

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  if (open) {
    const opened = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    if (opened.status !== "ready") {
      throw new Error(`Expected an opened day, received ${opened.status}`);
    }
  }

  const readDay = () =>
    prisma.studySession.findFirstOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id, localDate: DATE },
    });

  return { goal, plan, readDay, user };
}

describe("a changed day's queue and missions share its post-commit plan facts", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
    await keepPaceOwn();
  });

  afterEach(async () => {
    await Promise.allSettled(pending);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([0, 10])(
    "rebuilds one unstarted day with %i minutes already used, then replays with conservative freshness",
    (spent) =>
      runBody(async () => {
        const { goal, plan, readDay, user } = await setup(spent);
        const original = await readDay();

        const measured = await countDatabaseStatements(() =>
          changeGoalPlan({
            goalId: goal.id,
            input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], timeZone: "UTC" },
          }),
        );

        expect(measured.result).toMatchObject({
          change: { todaySession: "changed" },
          status: "applied",
        });

        const after = await readDay();
        const savedPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

        expect(after).toMatchObject({
          id: original.id,
          planVersion: savedPlan.version,
          startedAt: null,
          status: "planned",
        });

        expect(after.blocks.length).toBeGreaterThan(original.blocks.length);

        expect(after.plannedMinutes).toBe(
          after.blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
        );

        expect(after.plannedMinutes).toBeLessThanOrEqual(spent > 0 ? 30 - spent : 30);
        expect(after.missions).toStrictEqual(original.missions);

        expect(after.blocks.map((block) => block.position)).toStrictEqual(
          after.blocks.map((_, index) => index),
        );

        expect(after.blocks.every((block) => block.status === "pending")).toBe(true);
        await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);

        const context = {
          goal: await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
          localDate: DATE,
          now: new Date(),
          timeZone: "UTC",
          userId: user.id,
        };

        const dayPlan = await loadDayPlan(context);
        const unsharedInput = await loadSessionBuildInput(context);

        await expect(loadSessionBuildInput({ ...context, dayPlan })).resolves.toStrictEqual(
          unsharedInput,
        );

        const missionInput = {
          ...context,
          blocks: after.blocks.map((block) => ({
            ...block,
            estimatedMinutes: block.estimatedMinutes ?? 0,
            payload: readBlockPayload(block),
          })),
          plannedMinutes: after.plannedMinutes,
        };

        const unsharedFacts = await countDatabaseStatements(() =>
          loadDayMissionFacts(missionInput),
        );

        const sharedFacts = await countDatabaseStatements(() =>
          loadDayMissionFacts({ ...missionInput, dayPlan }),
        );

        expect(sharedFacts.result).toStrictEqual(unsharedFacts.result);
        // Reusing the day also skips the plan's single skill-survivor lookup.
        expect(unsharedFacts.statements - sharedFacts.statements).toBe(17);

        await expect(
          followPlanChangeToday({
            goalId: goal.id,
            localDate: DATE,
            timeZone: "UTC",
            userId: user.id,
          }),
        ).resolves.toBe("same");

        await expect(readDay()).resolves.toStrictEqual(after);

        if (measured.result.status !== "applied" || !measured.result.change) {
          throw new Error("Expected an applied change with an Undo snapshot");
        }

        await expect(
          decidePlanChange({
            changeId: measured.result.change.id,
            goalId: goal.id,
            input: { status: "undone", timeZone: "UTC" },
          }),
        ).resolves.toMatchObject({ status: "updated" });

        const undone = await readDay();
        expect(undone.blocks).toStrictEqual(original.blocks);
        expect(undone.missions).toStrictEqual(original.missions);
        // An unstarted day's refresh reads its day selection, as Open does (+2 measured statements).
        expect(measured.statements).toBeLessThanOrEqual(176);
      }),
  );

  it("rebuilds the opened day when Undo has no saved session snapshot, preserving eligible targets", () =>
    runBody(async () => {
      const { goal, readDay, user } = await setup(0, false);

      const applied = await changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], timeZone: "UTC" },
      });

      expect(applied).toMatchObject({ change: { todaySession: null }, status: "applied" });
      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

      if (applied.status !== "applied" || !applied.change) {
        throw new Error("Expected the learner's change before opening a day");
      }

      await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
      const before = await readDay();
      expect(before.plannedMinutes).toBeGreaterThan(12);

      expect(before.missions).toMatchObject({
        picks: [
          { kind: "askBuddy", total: 1 },
          { kind: "somethingNew", total: 1 },
        ],
      });

      await expect(
        decidePlanChange({
          changeId: applied.change.id,
          goalId: goal.id,
          input: { status: "undone", timeZone: "UTC" },
        }),
      ).resolves.toMatchObject({ status: "updated" });

      const after = await readDay();
      expect(after).toMatchObject({ id: before.id, startedAt: null, status: "planned" });
      expect(after.plannedMinutes).toBeLessThanOrEqual(12);
      expect(after.blocks.length).toBeGreaterThan(0);
      expect(after.blocks.length).toBeLessThan(before.blocks.length);
      // One anchored lesson and a Buddy question still fit the smaller selected day.
      expect(after.missions).toStrictEqual(before.missions);

      expect(after.blocks.map((block) => block.position)).toStrictEqual(
        after.blocks.map((_, index) => index),
      );

      await expect(
        followPlanChangeToday({
          goalId: goal.id,
          localDate: DATE,
          timeZone: "UTC",
          userId: user.id,
        }),
      ).resolves.toBe("same");

      await expect(readDay()).resolves.toStrictEqual(after);
    }));
});
