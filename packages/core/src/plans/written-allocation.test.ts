import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createWritingBlock } from "../exams/essays/create-writing-block";
import { toProduceBlock } from "../exams/essays/produce-block";
import { CGU } from "../exams/mocks/_test-utils/cgu-written";
import { getMockOptions } from "../exams/mocks/get-mock-options";
import { mockConditionsSchema, mockResultSchema } from "../exams/mocks/mock-contract";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { listWritingPreparation } from "../lookahead/writing-preparation";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { loadDayPlan } from "../sessions/_utils/day-plan";
import {
  captureDaySession,
  lockDaySession,
  restoreDaySession,
} from "../sessions/_utils/day-session-snapshot";
import { loadDayWriting } from "../sessions/_utils/day-writing";
import { loadSessionBuildInput } from "../sessions/_utils/load-build-inputs";
import { followPlanChangeToday } from "../sessions/_utils/refresh-day-session";
import { addWritingDrill } from "../sessions/_utils/writing-drills";
import { readBlockPayload, toBlockPayload } from "../sessions/block-payload";
import { refreshOwedStudyDay } from "../sessions/refresh-owed-study-day";
import { buildSessionBlocks } from "../sessions/session-builder";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { addDays, toIsoDate } from "./planner/plan-calendar";
import { parsePlanPhases, parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";
import { catchUpMockReplan } from "./replan-after-mock";

const START = new Date("2026-09-30");
const DAYS = 35;
const TARGET = addDays(START, DAYS);

async function setup({
  dailyMinutes,
  structure,
  targetDate = TARGET,
  writtenArea = "Writing",
  secondWritingArea,
  skippedAreas = [],
}: {
  dailyMinutes: number;
  structure: ExamStructure;
  targetDate?: Date | null;
  writtenArea?: string;
  secondWritingArea?: string;
  skippedAreas?: string[];
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
        ...(secondWritingArea ? [{ area: secondWritingArea, lessons: 30 }] : []),
      ],
    }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { skippedAreas, startDate: toIsoDate(START) },
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
    const placement = blocks.find(({ payload }) => payload.writingPlacement && payload.writing);

    if (placement?.payload.writing) {
      // oxlint-disable-next-line no-await-in-loop -- Later days must see the placement as completed.
      await recordWritingBlock({
        goal,
        localDate,
        status: "completed",
        taskKey: placement.payload.writing.taskKey,
      });
    }

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

function advanceTo(offset: number) {
  vi.setSystemTime(addDays(new Date("2026-09-30T12:00:00Z"), offset));
}

async function recordWritingBlock({
  goal,
  localDate = START,
  status,
  taskKey = "short",
}: {
  goal: { id: string; userId: string };
  localDate?: Date;
  status: "active" | "completed";
  taskKey?: string;
}) {
  const session = await studySessionFixture({
    goalId: goal.id,
    localDate,
    plannedMinutes: 70,
    startedAt: new Date(),
    status,
    userId: goal.userId,
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 70,
    kind: "produce",
    payload: {
      extra: false,
      writing: { admissionId: randomUUID(), draft: null, taskKey, unit: "answer" },
      writingPlacement: true,
    },
    sessionId: session.id,
    startedAt: new Date(),
    status,
  });

  return { block, session };
}

const OPENED_OFFSET = 2;
const OPENED = addDays(START, OPENED_OFFSET);

/** A day past the plan's first, opened before the plan has placed its first essay anywhere. */
async function openDayWithoutWriting() {
  const fixture = await setup({ dailyMinutes: 45, structure: CGU });
  const settings = parsePlanSettings(fixture.saved.settings);

  await prisma.plan.update({
    data: { settings: { ...settings, writingSchedule: [] } },
    where: { id: fixture.saved.id },
  });

  advanceTo(OPENED_OFFSET);
  const opened = await getTodayStudySession({ goalId: fixture.goal.id, timeZone: "UTC" });

  if (opened.status !== "ready") {
    throw new Error(`Expected the day to open, got ${opened.status}`);
  }

  return { ...fixture, session: opened.session };
}

async function readOpenedDay({ goalId, sessionId }: { goalId: string; sessionId: string }) {
  const [session, view] = await Promise.all([
    prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: sessionId },
    }),
    getTodayView({ goalId, timeZone: "UTC" }),
  ]);

  return {
    blocks: session.blocks.map(({ estimatedMinutes, id, kind }) => ({
      estimatedMinutes,
      id,
      kind,
    })),
    minutes: view.status === "ready" ? view.today.session?.minutes : null,
    plannedMinutes: session.plannedMinutes,
  };
}

async function readWritingDates(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return (parsePlanSettings(plan.settings).writingSchedule ?? []).map(({ date }) => date);
}

async function finishMockMissing({
  goal,
  skillId,
}: {
  goal: { id: string; userId: string };
  skillId: string;
}) {
  const item = await itemFixture({ content: choiceItemContent(), skillId });

  const mock = await prisma.mockExam.create({
    data: {
      conditions: mockConditionsSchema.parse({
        day: null,
        examQuestions: null,
        fullLength: true,
        partialCredit: "allOrNothing",
        purpose: "practice",
        reused: 0,
        scoring: "raw",
        sections: [],
        shape: null,
        startTime: null,
        timeZone: "UTC",
        timedOutSections: [],
        wrongPenalty: 0,
      }),
      finishedAt: new Date(),
      goalId: goal.id,
      result: mockResultSchema.parse({
        areas: [],
        blank: 0,
        calibration: null,
        coherence: null,
        correct: 0,
        irt: null,
        minutesUsed: 10,
        net: null,
        plannedMinutes: 10,
        points: null,
        preparation: null,
        previous: null,
        scoring: "raw",
        topics: [{ area: null, correct: 0, name: "Writing", skillId, total: 1 }],
        total: 1,
        unansweredAtTimeout: 0,
      }),
      sectionStartedAt: new Date(),
      startedAt: new Date(),
      status: "finished",
      userId: goal.userId,
    },
  });

  await Promise.all([
    prisma.mockExamAnswer.create({
      data: { answer: { selectedIndex: 1 }, itemId: item.id, mockExamId: mock.id },
    }),
    attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: item.id,
      mockExamId: mock.id,
      skillId,
      userId: goal.userId,
    }),
  ]);
}

describe("an opened day without an essay", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps its blocks and minutes when lessons landing re-plan it, and the essay goes to a later day", async () => {
    const { goal, saved, session } = await openDayWithoutWriting();
    const shown = await readOpenedDay({ goalId: goal.id, sessionId: session.id });

    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [saved.id] }));
    await refreshOwedStudyDay({ sessionId: session.id, timeZone: "UTC", userId: goal.userId });

    const [day, plan, dates] = await Promise.all([
      readOpenedDay({ goalId: goal.id, sessionId: session.id }),
      prisma.plan.findUniqueOrThrow({ where: { id: saved.id } }),
      readWritingDates(goal.id),
    ]);

    expect(day).toStrictEqual(shown);
    expect(plan.version).toBe(saved.version + 1);
    expect(dates[0]).toBe(toIsoDate(addDays(OPENED, 1)));
  });

  it("keeps its blocks and minutes when a finished mock re-plans it", async () => {
    const { goal, saved, session, writingSkill } = await openDayWithoutWriting();
    const shown = await readOpenedDay({ goalId: goal.id, sessionId: session.id });

    await finishMockMissing({ goal, skillId: writingSkill ?? "" });
    await catchUpMockReplan({ goal, now: new Date(), timeZone: "UTC" });
    await refreshOwedStudyDay({ sessionId: session.id, timeZone: "UTC", userId: goal.userId });

    const [day, plan, dates] = await Promise.all([
      readOpenedDay({ goalId: goal.id, sessionId: session.id }),
      prisma.plan.findUniqueOrThrow({ where: { id: saved.id } }),
      readWritingDates(goal.id),
    ]);

    expect(day).toStrictEqual(shown);
    expect(parsePlanSettings(plan.settings).mockReplan).toMatchObject({ applied: true });
    expect(dates[0]).toBe(toIsoDate(addDays(OPENED, 1)));
  });
});

describe("written exam allocation", () => {
  afterEach(() => vi.useRealTimers());

  it("removes writing from the plan, an already built day, and new days, then restores it", async () => {
    const { blueprint, goal, saved, writingSkill } = await setup({
      dailyMinutes: 240,
      structure: CGU,
    });

    const context = {
      blueprint,
      goal,
      localDate: START,
      now: new Date(),
      timeZone: "UTC",
      userId: goal.userId,
    };

    const plan = await loadDayPlan(context);

    const before = await loadDayWriting({ context, includesMockExams: true, plan });
    expect(before.produces.length).toBeGreaterThan(0);

    const day = await studySessionFixture({
      goalId: goal.id,
      localDate: START,
      status: "planned",
      userId: goal.userId,
    });

    await studySessionBlockFixture({
      ...toProduceBlock(before.produces[0]!),
      sessionId: day.id,
      status: "pending",
    });

    const writtenLesson = saved.items.find(
      (item) => item.skillId === writingSkill && item.lessonId,
    );

    const lessonId = writtenLesson?.lessonId;

    if (!lessonId || !writingSkill) {
      throw new Error("Expected a scheduled writing lesson");
    }

    await studySessionBlockFixture({ lessonId, sessionId: day.id, status: "completed" });

    const drill = toProduceBlock({
      ...before.produces[0]!,
      minutes: 8,
      skillId: writingSkill,
      unit: "drill",
    });

    await studySessionBlockFixture({
      ...drill,
      payload: { ...drill.payload, writingLessonId: lessonId },
      sessionId: day.id,
      status: "pending",
    });

    const change = (kind: "skipAreas" | "restoreAreas") =>
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Writing"], kind }], timeZone: "UTC" },
      });

    await expect(change("skipAreas")).resolves.toMatchObject({ status: "applied" });
    const skipped = await loadDayPlan(context);
    const settings = parsePlanSettings(skipped.settings);
    const writing = await loadDayWriting({ context, includesMockExams: true, plan: skipped });

    const stale = await loadDayWriting({
      context,
      includesMockExams: true,
      plan: {
        ...skipped,
        settings: {
          ...settings,
          writingSchedule: parsePlanSettings(saved.settings).writingSchedule,
        },
      },
    });

    expect.soft(settings.writingSchedule ?? []).toStrictEqual([]);
    expect.soft(writing.produces).toStrictEqual([]);
    expect.soft(stale.produces).toStrictEqual([]);

    const lesson = {
      canDo: null,
      chapterId: null,
      lessonId: randomUUID(),
      minutes: 15,
      planItemId: null,
      planSkillId: writingSkill ?? null,
      skillIds: [],
      title: "Writing lesson",
    };

    expect(before.reserveDrill(lesson).drill?.unit).toBe("drill");
    expect(stale.reserveDrill(lesson)).toStrictEqual(lesson);

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { writtenPractice: null },
      status: "ready",
    });

    await expect(
      prisma.studySessionBlock.count({
        where: { kind: "produce", sessionId: day.id, status: "pending" },
      }),
    ).resolves.toBe(0);

    await expect(
      listWritingPreparation({ goalId: goal.id, timeZone: "UTC", userId: goal.userId }),
    ).resolves.toStrictEqual([]);

    await expect(createWritingBlock({ goalId: goal.id, taskKey: "short" })).resolves.toMatchObject({
      status: "notFound",
    });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { options: expect.arrayContaining([expect.objectContaining({ kind: "written" })]) },
    });

    await expect(change("restoreAreas")).resolves.toMatchObject({ status: "applied" });
    const restored = await loadDayPlan(context);
    expect(parsePlanSettings(restored.settings).writingSchedule?.length).toBeGreaterThan(0);
  });

  it.each([2, null])(
    "schedules only the kept task when one of two written areas is skipped (second paper day %s)",
    async (day) => {
      const structure = structuredClone(CGU);
      const original = structure.mock!.sections.find(({ kind }) => kind === "written")!;
      const [short, long] = original.tasks!;
      original.tasks = [short!];
      structure.mock!.sections.push({ ...original, day, name: "Written cases", tasks: [long!] });
      structure.subjects.push({ ...structure.subjects[1]!, group: "Written cases", name: "Cases" });

      const { goal, saved } = await setup({
        dailyMinutes: 240,
        secondWritingArea: "Cases",
        skippedAreas: ["Writing"],
        structure,
      });

      const schedule = parsePlanSettings(saved.settings).writingSchedule ?? [];
      const keys = new Set(schedule.flatMap(({ tasks }) => tasks.map(({ taskKey }) => taskKey)));
      expect([...keys]).toStrictEqual(["long"]);
      expect(schedule.some(({ test }) => test)).toBe(day !== null);
      const view = await getGoalPlan(goal.id);

      if (view.status !== "ready") {
        throw new Error(`Expected a ready plan, got ${view.status}`);
      }

      expect(view.plan.writtenPractice?.subjects?.map(({ points }) => points.name)).toStrictEqual([
        "Written cases",
      ]);
    },
  );

  it("restores only the unmatched writing occurrences when undo keeps a new answer", async () => {
    const { goal } = await setup({ dailyMinutes: 120, structure: CGU });
    const key = { goalId: goal.id, localDate: START, userId: goal.userId };
    const day = await studySessionFixture({ ...key, plannedMinutes: 120, status: "active" });

    const answer = toProduceBlock({
      minutes: 45,
      taskKey: "short",
      title: "Written answer",
      unit: "answer",
    });

    const drill = toProduceBlock({
      minutes: 8,
      taskKey: "short",
      title: "Writing exercise",
      unit: "drill",
    });

    const originals = await Promise.all(
      [answer, answer, drill].map((block, position) =>
        studySessionBlockFixture({ ...block, position, sessionId: day.id, status: "pending" }),
      ),
    );

    await prisma.$transaction(async (tx) => {
      const snapshot = await captureDaySession({ ...key, tx });

      if (!snapshot) {
        throw new Error("Expected a saved day");
      }

      await tx.studySessionBlock.deleteMany({ where: { sessionId: day.id } });

      const started = await tx.studySessionBlock.create({
        data: {
          ...answer,
          position: 0,
          sessionId: day.id,
          startedAt: new Date(),
          status: "active",
        },
      });

      const session = await lockDaySession({ ...key, snapshot, tx });

      if (!session) {
        throw new Error("Expected to lock the saved day");
      }

      await restoreDaySession({ session, snapshot, tx });

      const blocks = await tx.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: day.id },
      });

      expect(blocks.map(({ id }) => id)).toStrictEqual([
        started.id,
        originals[1]?.id,
        originals[2]?.id,
      ]);
    });
  });

  it.each(["admitted", "opened", "drill"] as const)(
    "keeps the pending writing after refreshing a day with a kept answer (%s)",
    async (shape) => {
      const { goal, saved, writingSkill } = await setup({ dailyMinutes: 120, structure: CGU });

      const answer = {
        minutes: 45,
        taskKey: "short",
        title: "Written answer",
        unit: "answer",
      } as const;

      const tasks = shape === "drill" ? [answer] : [answer, answer];
      const plan = parsePlanSettings(saved.settings);

      await prisma.plan.update({
        data: {
          settings: {
            ...plan,
            writingSchedule: [
              { date: toIsoDate(START), minutes: tasks.length * answer.minutes, tasks },
            ],
          },
        },
        where: { id: saved.id },
      });

      const day = await studySessionFixture({
        goalId: goal.id,
        localDate: START,
        plannedMinutes: 120,
        startedAt: new Date(),
        status: "active",
        userId: goal.userId,
      });

      const kept = toProduceBlock(answer);

      const first = await studySessionBlockFixture({
        ...kept,
        payload: {
          ...kept.payload,
          writing: {
            admissionId: shape === "opened" ? null : randomUUID(),
            draft: null,
            taskKey: "short",
            unit: "answer",
          },
        },
        sessionId: day.id,
        startedAt: new Date(),
        status: shape === "opened" ? "active" : "completed",
      });

      async function savePendingWriting() {
        if (shape !== "drill") {
          return studySessionBlockFixture({
            ...toProduceBlock(answer),
            sessionId: day.id,
            status: "pending",
          });
        }

        const lesson = saved.items.find((item) => item.lessonId && item.skillId === writingSkill);

        if (!lesson?.lessonId) {
          throw new Error("Expected a writing lesson");
        }

        const lessonBlock = {
          canDo: null,
          estimatedMinutes: 23,
          kind: "learn" as const,
          lessonId: lesson.lessonId,
          payload: toBlockPayload({ planItemId: lesson.id }),
        };

        const [parent, drill] = addWritingDrill({
          block: lessonBlock,
          lesson: {
            canDo: null,
            chapterId: null,
            drill: { ...answer, minutes: 8, unit: "drill" },
            lessonId: lesson.lessonId,
            minutes: 23,
            planItemId: lesson.id,
            planSkillId: writingSkill ?? null,
            skillIds: [],
            title: "Writing lesson",
          },
        });

        await studySessionBlockFixture({ ...parent!, sessionId: day.id, status: "completed" });
        return studySessionBlockFixture({ ...drill!, sessionId: day.id, status: "pending" });
      }

      const pending = await savePendingWriting();

      await followPlanChangeToday({
        goalId: goal.id,
        localDate: START,
        timeZone: "UTC",
        userId: goal.userId,
      });

      const writing = await prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { kind: "produce", sessionId: day.id },
      });

      expect(writing[0]?.id).toBe(first.id);

      const remaining = writing.filter(({ status }) => status === "pending");

      const pendingAnswers = remaining.filter(
        (block) => readBlockPayload(block).writing?.unit === "answer",
      );

      const source = readBlockPayload(pending).writingLessonId;

      const keptDrill = remaining.filter(
        (block) => source && readBlockPayload(block).writingLessonId === source,
      );

      expect(pendingAnswers).toHaveLength(shape === "drill" ? 0 : 1);
      expect(keptDrill.map(({ id }) => id)).toStrictEqual(shape === "drill" ? [pending.id] : []);
    },
  );

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

  it("offers the whole answer on the next study day when its start day was missed", async () => {
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

    const nextDay = addDays(START, 1);

    const continuation = buildSessionBlocks(
      await loadSessionBuildInput({
        blueprint: fixture.blueprint,
        goal: fixture.goal,
        localDate: nextDay,
        now: nextDay,
        timeZone: "UTC",
        userId: fixture.goal.userId,
      }),
    );

    expect(continuation.blocks).toMatchObject([{ estimatedMinutes: 70, kind: "produce" }]);

    advanceTo(1);
    const { goal } = fixture;
    const request = { goalId: goal.id, timeZone: "UTC" };

    const writingDay = {
      status: "ready",
      today: {
        session: {
          blocks: [{ estimatedMinutes: 70, kind: "produce" }],
          extraTime: { available: false },
          minutes: { dailyGoal: 15, left: 70, planned: 70 },
          missions: expect.arrayContaining([expect.objectContaining({ kind: "essay" })]),
        },
      },
    };

    await expect(getTodayView(request)).resolves.toMatchObject(writingDay);

    await expect(
      listWritingPreparation({ ...request, userId: goal.userId }),
    ).resolves.toMatchObject([{ taskKey: "short", unit: "answer" }]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: START,
      userId: goal.userId,
    });

    await studySessionBlockFixture({
      kind: "produce",
      payload: blocks[0]?.payload,
      sessionId: session.id,
      status: "skipped",
    });

    // The learner has skipped the original block and missed all of its reserved dates.
    advanceTo(5);
    await expect(getTodayView(request)).resolves.toMatchObject(writingDay);
  });

  it("carries an admitted answer through a plan rebuild and releases the day when the answer finishes", async () => {
    const { goal } = await setup({ dailyMinutes: 15, structure: CGU });
    const request = { goalId: goal.id, timeZone: "UTC" };
    const { block, session } = await recordWritingBlock({ goal, status: "active" });

    advanceTo(1);

    const carried = {
      status: "ready",
      today: {
        session: {
          blocks: [{ id: block.id, kind: "produce", status: "active" }],
          extraTime: { available: false },
          id: session.id,
          minutes: { left: 70 },
        },
      },
    };

    await expect(getTodayView(request)).resolves.toMatchObject(carried);

    await expect(
      refreshGoalPlan({ goalId: goal.id, mode: "forced", settleMissedDays: false }),
    ).resolves.toMatchObject({ status: "refreshed" });

    await expect(getTodayView(request)).resolves.toMatchObject(carried);
    const before = await getGoalPlan(goal.id);
    const rebuilt = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const placements = parsePlanSettings(rebuilt.settings).writingSchedule?.flatMap(({ tasks }) =>
      tasks.filter(({ placement }) => placement),
    );

    expect(placements).toHaveLength(1);

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: block.id },
    });

    vi.setSystemTime(new Date("2026-10-01T14:00:00Z"));

    const after = await getGoalPlan(goal.id);

    if (before.status !== "ready" || after.status !== "ready") {
      throw new Error("Expected the learner's plan estimates");
    }

    // Each estimate is rounded independently to one decimal place.
    const change = before.plan.estimate.remainingHours - after.plan.estimate.remainingHours;
    expect(Math.round(change * 10)).toBeOneOf([11, 12]);
    expect(before.plan.estimate.totalHours).toBe(after.plan.estimate.totalHours);

    expect(
      (before.plan.numbers?.scheduledMinutes ?? 0) - (after.plan.numbers?.scheduledMinutes ?? 0),
    ).toBeCloseTo(70);

    const today = await getTodayView(request);

    if (today.status !== "ready") {
      throw new Error("Expected the learner's next study day");
    }

    expect(today).toMatchObject({
      status: "ready",
      today: { session: { localDate: addDays(START, 1) } },
    });

    expect(today.today.session.blocks.length).toBeGreaterThan(0);

    expect(today.today.session.blocks.map(({ writingUnit }) => writingUnit)).not.toContain(
      "answer",
    );

    expect(today.today.session.minutes.left).toBeGreaterThan(0);
  });

  it("fills the first continuation day normally when the answer finished on its start day", async () => {
    const { goal } = await setup({ dailyMinutes: 15, structure: CGU });
    await recordWritingBlock({ goal, status: "completed" });

    advanceTo(1);
    const day = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (day.status !== "ready") {
      throw new Error("Expected the learner's continuation day");
    }

    const { session } = day.today;
    expect(session.localDate).toStrictEqual(addDays(START, 1));
    expect(session.blocks.some(({ kind }) => kind === "learn" || kind === "practice")).toBe(true);
    expect(session.blocks.map(({ writingUnit }) => writingUnit)).not.toContain("answer");
    expect(session.minutes.left).toBeGreaterThan(0);
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
