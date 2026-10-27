import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { keepPaceOwn } from "./_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { readSelectedItemFacts } from "./_utils/selected-item-contract";
import { createGoalPlan } from "./create-goal-plan";
import * as producer from "./planner/build-plan";
import { toIsoDate } from "./planner/plan-calendar";
import { parsePlanPhases } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const START = new Date("2020-09-28T12:00:00Z");
const pending = new Set<Promise<void>>();

function runBody(body: () => Promise<void>) {
  const promise = body();
  pending.add(promise);
  return promise.finally(() => pending.delete(promise));
}

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: START,
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-30"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const readPlan = () =>
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

  return { goal, plan, readPlan, user };
}

async function setupMissedMock() {
  const [user, library, blueprint] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: [
        { area: "Math", lessons: 8 },
        { area: "Math", lessons: 6 },
      ],
    }),
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "One point per correct answer", method: "raw" },
          sections: [{ day: 1, kind: "objective", minutes: 330, name: "Math", questions: 60 }],
          timeLimitMinutes: 330,
          totalQuestions: 60,
        },
        rules: [],
        subjects: [],
      },
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date("2026-10-12"),
    dailyMinutes: 90,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2026-10-12" },
    targetDate: new Date("2027-01-12"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  await prisma.$transaction(async (tx) => {
    await markPlansChanged(tx, { planIds: [plan.id] });

    await tx.planItem.updateMany({
      data: { completedAt: new Date("2026-10-23T12:00:00Z"), status: "done" },
      where: { kind: { in: ["lesson", "chapter", "boss"] }, planId: plan.id },
    });
  });

  const finished = await readTested(plan.id);

  vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
  await refreshGoalPlan({ goalId: goal.id });
  return { finished, goal, plan };
}

/** What each of the plan's challenges tests, as its saved facts keep it. */
async function readTested(planId: string) {
  const bosses = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { facts: true, id: true },
    where: { kind: "boss", planId },
  });

  return bosses.map((boss) => ({
    id: boss.id,
    testedKeys: readSelectedItemFacts(boss.facts)?.boss?.testedKeys,
  }));
}

describe("automatic refresh admits fresh inputs before running the producer", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    await keepPaceOwn();
  });

  afterEach(async () => {
    await Promise.allSettled(pending);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does no build or write when the actual inputs and saved progress are unchanged", () =>
    runBody(async () => {
      const { goal, readPlan, user } = await setup();
      const before = await readPlan();
      const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const builds = vi.spyOn(producer, "buildPlan");

      const read = await countDatabaseStatements(() => refreshGoalPlan({ goalId: goal.id }));

      expect(read.result).toStrictEqual({ status: "unchanged" });
      expect(builds).not.toHaveBeenCalled();
      expect(read.writes).toBe(0);
      await expect(readPlan()).resolves.toStrictEqual(before);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toStrictEqual(actor);
    }));

  it("withdraws only an obsolete phase quote without rebuilding, then does no work on replay", () =>
    runBody(async () => {
      const { goal, plan, readPlan, user } = await setup();
      const before = await readPlan();
      const phase = parsePlanPhases(before.phases).find((entry) => entry.endDate !== null);

      if (!phase?.endDate) {
        throw new Error("Expected a saved phase end for the quote validity control");
      }

      const quotes = await Promise.all(
        ["2020-01-01", phase.endDate].map((from) =>
          prisma.planChange.create({
            data: {
              kind: "edited",
              payload: {
                effect: {
                  endDateAfter: null,
                  endDateBefore: null,
                  lessonsAdded: 0,
                  lessonsRemoved: 0,
                  phaseEnds: [{ after: "2020-12-01", before: from, name: phase.name }],
                },
                operations: [{ kind: "fitPhaseDates" }],
                source: "phaseDates",
              },
              planId: plan.id,
              reason: "",
              status: "proposed",
            },
          }),
        ),
      );

      const builds = vi.spyOn(producer, "buildPlan");
      const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
        status: "unchanged",
      });

      expect(builds).not.toHaveBeenCalled();

      await expect(
        prisma.planChange.findMany({ where: { id: { in: quotes.map((quote) => quote.id) } } }),
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: quotes[0]?.id, status: "replaced" }),
          expect.objectContaining({ id: quotes[1]?.id, status: "proposed" }),
        ]),
      );

      const after = await readPlan();
      expect(after.items).toStrictEqual(before.items);
      expect(after.version).toBe(before.version);
      expect(after.inputVersion).toBe(before.inputVersion + 1);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: actor.learnerRevision + 1n });

      const replay = await countDatabaseStatements(() => refreshGoalPlan({ goalId: goal.id }));
      expect(replay.result).toStrictEqual({ status: "unchanged" });
      expect(replay.writes).toBe(0);
      expect(builds).not.toHaveBeenCalled();
      await expect(readPlan()).resolves.toStrictEqual(after);
    }));

  it("rebuilds for a newly eligible missed-mock rescue without overdue teaching or progress changes", () =>
    runBody(async () => {
      vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
      const { goal, plan } = await setupMissedMock();

      const readItems = () =>
        prisma.planItem.findMany({
          omit: { updatedAt: true },
          orderBy: { position: "asc" },
          where: { planId: plan.id },
        });

      const before = await readItems();

      expect(
        before
          .filter((item) => item.kind === "mock")
          .map((item) => item.scheduledFor && toIsoDate(item.scheduledFor)),
      ).toContain("2026-10-25");

      expect(
        before.filter(
          (item) => ["lesson", "chapter", "boss"].includes(item.kind) && item.status === "todo",
        ),
      ).toStrictEqual([]);

      const builds = vi.spyOn(producer, "buildPlan");
      vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
      await refreshGoalPlan({ goalId: goal.id });
      expect(builds).not.toHaveBeenCalled();
      vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
      await refreshGoalPlan({ goalId: goal.id });
      expect(builds).toHaveBeenCalledWith(expect.objectContaining({ goalId: goal.id }));
      const after = await readItems();

      expect(
        after
          .filter((item) => item.kind === "mock")
          .map((item) => item.scheduledFor && toIsoDate(item.scheduledFor)),
      ).toContain("2026-11-03");

      expect(after.filter((item) => item.status === "done")).toStrictEqual(
        before.filter((item) => item.status === "done"),
      );
    }));

  it("keeps what each finished challenge tested when it plans again", () =>
    runBody(async () => {
      vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
      const { finished, goal, plan } = await setupMissedMock();

      expect(finished).not.toHaveLength(0);
      expect(finished.every((boss) => (boss.testedKeys?.length ?? 0) > 0)).toBe(true);
      await expect(readTested(plan.id)).resolves.toStrictEqual(finished);

      vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
      await refreshGoalPlan({ goalId: goal.id });
      await expect(readTested(plan.id)).resolves.toStrictEqual(finished);
    }));

  it.each(["minutes", "date", "progress"] as const)(
    "still builds for a genuine change in %s, then skips its unchanged replay",
    (input) =>
      runBody(async () => {
        const { goal, plan, readPlan } = await setup();
        const before = await readPlan();

        const lesson = before.items.find(
          (item) => item.kind === "lesson" && item.status === "todo",
        );

        if (!lesson) {
          throw new Error("Expected a real selected lesson for the progress change");
        }

        await prisma.$transaction(async (tx) => {
          await markPlansChanged(tx, { planIds: [plan.id] });

          if (input === "progress") {
            await tx.planItem.update({
              data: { completedAt: new Date(), status: "done" },
              where: { id: lesson.id },
            });

            return;
          }

          await tx.goal.update({
            data:
              input === "minutes" ? { dailyMinutes: 30 } : { targetDate: new Date("2020-11-06") },
            where: { id: goal.id },
          });
        });

        const builds = vi.spyOn(producer, "buildPlan");
        await refreshGoalPlan({ goalId: goal.id });
        expect(builds).toHaveBeenCalledWith(expect.objectContaining({ goalId: goal.id }));
        const after = await readPlan();
        expect(after.inputsKey).not.toBe(before.inputsKey);

        expect(after.items.find((item) => item.id === lesson.id)?.status).toBe(
          input === "progress" ? "done" : lesson.status,
        );

        builds.mockClear();
        const replay = await countDatabaseStatements(() => refreshGoalPlan({ goalId: goal.id }));
        expect(replay.result).toStrictEqual({ status: "unchanged" });
        expect(builds).not.toHaveBeenCalled();
        expect(replay.writes).toBe(0);
        await expect(readPlan()).resolves.toStrictEqual(after);
      }),
  );
});
