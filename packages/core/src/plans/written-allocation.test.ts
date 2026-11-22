import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { CGU } from "../exams/mocks/_test-utils/cgu-written";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { loadSessionBuildInput } from "../sessions/_utils/load-build-inputs";
import { buildSessionBlocks } from "../sessions/session-builder";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { addDays, toIsoDate } from "./planner/plan-calendar";
import { parsePlanPhases, parsePlanSettings } from "./planner/plan-state";

const START = new Date("2026-09-30");
const DAYS = 35;
const TARGET = addDays(START, DAYS);

async function setup({
  dailyMinutes,
  structure,
  targetDate = TARGET,
  writtenArea = "Writing",
}: {
  dailyMinutes: number;
  structure: ExamStructure;
  targetDate?: Date | null;
  writtenArea?: string;
}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));

  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    planLibraryFixture({
      skills: [
        { area: "Control", lessons: 60 },
        { area: writtenArea, lessons: 30 },
      ],
    }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: toIsoDate(START) },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  const [control] = library.skills;

  if (!control) {
    throw new Error("Expected the objective skill");
  }

  await Promise.all(
    Array.from({ length: 170 }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: control.id,
      }),
    ),
  );

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  const saved = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { goalId: goal.id },
  });

  return { blueprint, goal, saved, writingSkill: library.skills[1]?.id };
}

async function measurePlan({ goal, writingSkill }: Awaited<ReturnType<typeof setup>>) {
  const usedLessons = new Set<string>();
  const days = [];

  for (let offset = 0; offset < DAYS; offset += 1) {
    const localDate = addDays(START, offset);
    // oxlint-disable-next-line no-await-in-loop -- Each day has the lessons from earlier days already used.
    const input = await loadSessionBuildInput({
      goal,
      keptLessonIds: usedLessons,
      localDate,
      now: localDate,
      timeZone: "UTC",
      userId: goal.userId,
    });

    const { blocks } = buildSessionBlocks(input);

    for (const { lessonId } of blocks) {
      if (lessonId) {
        usedLessons.add(lessonId);
      }
    }

    days.push({ blocks, date: toIsoDate(localDate), minutes: input.dailyMinutes });
  }

  return days.reduce(
    (total, { blocks, minutes }) => {
      const writing = blocks
        .filter(({ kind, payload }) => kind === "produce" || payload.checkpoint?.written)
        .reduce((sum, block) => sum + block.estimatedMinutes, 0);

      const writtenLessons = blocks
        .filter(({ kind, payload }) => kind === "learn" && payload.planSkillId === writingSkill)
        .reduce((sum, block) => sum + block.estimatedMinutes, 0);

      return {
        everythingElse: total.everythingElse + minutes - writing - writtenLessons,
        writing: total.writing + writing,
        writtenLessons: total.writtenLessons + writtenLessons,
      };
    },
    { everythingElse: 0, writing: 0, writtenLessons: 0 },
  );
}

describe("written exam allocation", () => {
  afterEach(() => vi.useRealTimers());

  it("pays about half of a five-week CGU plan mostly in whole answers and drills", async () => {
    const fixture = await setup({ dailyMinutes: 240, structure: CGU });
    const schedule = parsePlanSettings(fixture.saved.settings).writingSchedule ?? [];
    expect(schedule.filter(({ test }) => test)).toHaveLength(2);
    expect(schedule[0]?.tasks[0]).toMatchObject({ minutes: 70, placement: true, taskKey: "short" });

    const itemMinutes = fixture.saved.items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
    const writingMinutes = schedule.reduce((sum, day) => sum + day.minutes, 0);
    expect.soft(fixture.saved.estimateHours).toBe(Math.round(itemMinutes + writingMinutes) / 60);

    const phases = parsePlanPhases(fixture.saved.phases);

    for (const [index, phase] of phases.entries()) {
      const phaseItemMinutes = fixture.saved.items
        .filter((item) => item.phase === index)
        .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

      const phaseWritingMinutes = schedule
        .filter(
          ({ date }) =>
            phase.startDate && phase.endDate && date >= phase.startDate && date <= phase.endDate,
        )
        .reduce((sum, day) => sum + day.minutes, 0);

      expect
        .soft(phase.minutes, phase.kind)
        .toBe(Math.round(phaseItemMinutes + phaseWritingMinutes));
    }

    const minutes = await measurePlan(fixture);
    expect(minutes.writtenLessons).toBeGreaterThan(0);
    expect(minutes.writing).toBeGreaterThan(4 * minutes.writtenLessons);

    const total = minutes.writing + minutes.writtenLessons + minutes.everythingElse;
    expect((minutes.writing + minutes.writtenLessons) / total).toBeGreaterThanOrEqual(0.47);
    expect((minutes.writing + minutes.writtenLessons) / total).toBeLessThanOrEqual(0.53);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: fixture.goal.userId, status: "active" },
    });

    const tests = await Promise.all(
      schedule
        .filter(({ test }) => test)
        .map(async ({ date }) => {
          const localDate = new Date(date);

          const input = await loadSessionBuildInput({
            goal: fixture.goal,
            localDate,
            now: localDate,
            timeZone: "UTC",
            userId: fixture.goal.userId,
          });

          return buildSessionBlocks(input);
        }),
    );

    expect(tests.map(({ blocks }) => blocks)).toMatchObject([
      [{ estimatedMinutes: 210, kind: "checkpoint", payload: { checkpoint: { written: true } } }],
      [{ estimatedMinutes: 210, kind: "checkpoint", payload: { checkpoint: { written: true } } }],
    ]);
  });

  it("starts an oversize whole answer on a 15-minute day even for a small written share", async () => {
    const structure = structuredClone(CGU);

    for (const part of structure.mock?.scoring.finalShares ?? []) {
      part.share = part.parts.includes("Written test") ? 0.1 : 0.9;
    }

    const fixture = await setup({ dailyMinutes: 15, structure });
    const schedule = parsePlanSettings(fixture.saved.settings).writingSchedule ?? [];
    const [first, ...continuations] = schedule;

    expect(first).toMatchObject({
      date: toIsoDate(START),
      minutes: 15,
      tasks: [{ minutes: 70, placement: true, taskKey: "short" }],
    });

    expect(continuations.map(({ minutes, tasks }) => ({ minutes, tasks }))).toStrictEqual([
      { minutes: 15, tasks: [] },
      { minutes: 15, tasks: [] },
      { minutes: 15, tasks: [] },
      { minutes: 10, tasks: [] },
    ]);

    const { blocks } = buildSessionBlocks(
      await loadSessionBuildInput({
        goal: fixture.goal,
        localDate: START,
        now: START,
        timeZone: "UTC",
        userId: fixture.goal.userId,
      }),
    );

    expect(blocks).toMatchObject([{ estimatedMinutes: 70, kind: "produce" }]);
  });

  it.each([
    { hasTest: false, targetDate: null, writtenArea: "Writing" },
    { hasTest: true, targetDate: TARGET, writtenArea: "A different subject" },
  ])(
    "reserves the same writing the day builds when the graph or date is incomplete ($writtenArea, $targetDate)",
    async ({ hasTest, targetDate, writtenArea }) => {
      const { goal, saved } = await setup({
        dailyMinutes: 240,
        structure: CGU,
        targetDate,
        writtenArea,
      });

      const schedule = parsePlanSettings(saved.settings).writingSchedule ?? [];

      expect(schedule[0]).toMatchObject({
        date: toIsoDate(START),
        minutes: 70,
        tasks: [{ taskKey: "short" }],
      });

      expect(schedule.some(({ test }) => test)).toBe(hasTest);

      const { blocks } = buildSessionBlocks(
        await loadSessionBuildInput({
          goal,
          localDate: START,
          now: START,
          timeZone: "UTC",
          userId: goal.userId,
        }),
      );

      const writing = blocks.find(({ kind }) => kind === "produce");

      expect(writing).toMatchObject({
        estimatedMinutes: 70,
        payload: { writing: { taskKey: "short" } },
      });
    },
  );

  it("keeps the original allocation for an objective-only notice", async () => {
    const structure = structuredClone(CGU);
    const mock = structure.mock;

    if (!mock) {
      throw new Error("Expected the CGU objective test");
    }

    mock.sections = mock.sections.filter(({ kind }) => kind === "objective");
    mock.scoring.parts = mock.scoring.parts?.filter(({ name }) => name === "Objective test");
    mock.scoring.finalShares = undefined;
    structure.subjects = structure.subjects.filter(({ name }) => name !== "Writing");

    const fixture = await setup({ dailyMinutes: 240, structure });
    expect(parsePlanSettings(fixture.saved.settings).writingSchedule).toBeUndefined();
    expect(fixture.saved.items.filter(({ kind }) => kind === "lesson")).toHaveLength(90);
    await expect(measurePlan(fixture)).resolves.toMatchObject({ writing: 0 });
  });
});
