import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { mockConditionsSchema, mockResultSchema } from "../exams/mocks/mock-contract";
import { PLAN_SHOWN } from "../learner/_test-utils/exam-test-goal";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { readBlockPayload } from "../sessions/block-payload";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadMockMisses, loadPlanMockMisses } from "./_utils/mock-misses";
import * as guard from "./_utils/mock-replan-guard";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanPhases, parsePlanSettings } from "./planner/plan-state";
import { catchUpMockReplan, replanAfterMock } from "./replan-after-mock";

/** A Wednesday, so the plan's first days teach (see `shortPlanExamGoalFixture`). */
const START = new Date("2026-11-11T12:00:00Z");
const AREAS = ["Direito", "Português"] as const;
const TOPICS_PER_AREA = 4;
const UTC = "UTC";

type Outcome = "blank" | "right" | "wrong";

async function setup({ dailyMinutes = 6 }: { dailyMinutes?: number } = {}) {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(START);

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      name: "Concurso",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: AREAS.map((name) => ({
          citation: { passage: "passage", sourceId: "source" },
          name,
          questions: 10,
          topics: [],
          weight: null,
        })),
      },
    }),
    planLibraryFixture({
      phases: ["Prova"],
      skills: AREAS.flatMap((area) =>
        Array.from({ length: TOPICS_PER_AREA }, () => ({ area, lessons: 2 })),
      ),
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    ...PLAN_SHOWN,
    dailyMinutes,
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(START.getTime() + 45 * MS_PER_DAY),
    timezone: UTC,
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const items = await Promise.all(
    library.skills.map((skill) =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: skill.id,
      }),
    ),
  );

  const itemOf = (skill: Skill) => items.find((item) => item.skillId === skill.id)!;

  return { goal, itemOf, library, plan, user };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function finishedMock({
  answers,
  finishedAt = new Date(),
  fixture,
  points = null,
  purpose = "practice",
}: {
  answers: { outcome: Outcome; skill: Skill }[];
  finishedAt?: Date;
  fixture: Setup;
  points?: unknown;
  purpose?: "placement" | "practice";
}) {
  const conditions = mockConditionsSchema.parse({
    day: null,
    examQuestions: null,
    fullLength: true,
    partialCredit: "allOrNothing",
    purpose,
    reused: 0,
    scoring: "raw",
    sections: [],
    shape: null,
    startTime: null,
    timeZone: UTC,
    timedOutSections: [],
    wrongPenalty: 0,
  });

  const areaOf = (skill: Skill) =>
    fixture.library.graph.skills.find((node) => node.skillId === skill.id)?.area ?? null;

  const answerIn = (answer: { skill: Skill }, area: string) => areaOf(answer.skill) === area;

  const result = mockResultSchema.parse({
    areas: AREAS.map((name) => ({
      correct: answers.filter((answer) => answerIn(answer, name) && answer.outcome === "right")
        .length,
      name,
      part: name,
      score: null,
      secondsPerQuestion: 60,
      targetSecondsPerQuestion: null,
      total: answers.filter((answer) => answerIn(answer, name)).length,
    })),
    blank: answers.filter((answer) => answer.outcome === "blank").length,
    calibration: null,
    coherence: null,
    correct: answers.filter((answer) => answer.outcome === "right").length,
    irt: null,
    minutesUsed: 10,
    net: null,
    plannedMinutes: 10,
    points,
    preparation: null,
    previous: null,
    scoring: "raw",
    topics: answers.map((answer) => ({
      area: areaOf(answer.skill),
      correct: Number(answer.outcome === "right"),
      name: answer.skill.name,
      skillId: answer.skill.id,
      total: 1,
    })),
    total: answers.length,
    unansweredAtTimeout: 0,
  });

  const mock = await prisma.mockExam.create({
    data: {
      conditions,
      finishedAt,
      goalId: fixture.goal.id,
      result,
      sectionStartedAt: finishedAt,
      startedAt: finishedAt,
      status: "finished",
      userId: fixture.user.id,
    },
  });

  await Promise.all(
    answers.flatMap(({ outcome, skill }) => {
      const item = fixture.itemOf(skill);

      return [
        prisma.mockExamAnswer.create({
          data: {
            answer:
              outcome === "blank" ? undefined : { selectedIndex: outcome === "right" ? 0 : 1 },
            itemId: item.id,
            mockExamId: mock.id,
          },
        }),
        attemptFixture({
          answer: outcome === "blank" ? { dontKnow: true } : { selectedIndex: 0 },
          isCorrect: outcome === "right",
          itemId: item.id,
          mockExamId: mock.id,
          skillId: skill.id,
          userId: fixture.user.id,
        }),
      ];
    }),
  );

  return mock;
}

async function readPlan(planId: string) {
  const [plan, items, changes] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
    prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } }),
    prisma.planChange.findMany({ orderBy: { createdAt: "asc" }, where: { planId } }),
  ]);

  const taught = await prisma.lessonSkill.findMany({
    where: { lessonId: { in: items.flatMap((item) => item.lessonId ?? []) } },
  });

  const firstDay = (skill: Skill) => {
    const lessonIds = new Set(
      taught.filter((row) => row.skillId === skill.id).map((row) => row.lessonId),
    );

    return Math.min(
      ...items
        .filter((item) => item.status === "todo" && lessonIds.has(item.lessonId ?? ""))
        .map((item) => item.scheduledFor?.getTime() ?? Infinity),
    );
  };

  return {
    changes,
    coveredShare: plan.coveredShare,
    firstDay,
    inputVersion: plan.inputVersion,
    items,
    phaseEnds: parsePlanPhases(plan.phases).map((phase) => phase.endDate),
    settings: parsePlanSettings(plan.settings),
    version: plan.version,
  };
}

function tested(name: string, met: boolean) {
  return {
    asked: 10,
    earned: met ? 8 : 2,
    max: 10,
    met,
    minimum: { unit: "points", value: 5 },
    name,
    projected: null,
    qualifying: false,
    short: met ? null : 3,
  };
}

function lastTopic(fixture: Setup, area: (typeof AREAS)[number]): Skill {
  const index = AREAS.indexOf(area) * TOPICS_PER_AREA + TOPICS_PER_AREA - 1;
  return fixture.library.skills[index]!;
}

/** A topic tested out by the plan and missed in a finished mock, and another missed one not taught yet. */
async function relearnSetup() {
  const fixture = await setup();
  const known = fixture.library.skills[0]!;
  const missed = lastTopic(fixture, "Português");
  const taught = await prisma.lessonSkill.findMany({ where: { skillId: known.id } });

  await prisma.planItem.updateMany({
    data: { completedAt: new Date(), status: "testedOut" },
    where: { lessonId: { in: taught.map((row) => row.lessonId) }, planId: fixture.plan.id },
  });

  const mock = await finishedMock({
    answers: [
      { outcome: "wrong", skill: known },
      { outcome: "wrong", skill: missed },
    ],
    fixture,
  });

  return { fixture, known, missed, mock, taught };
}

function relearnedStatuses({
  after,
  taught,
}: {
  after: Awaited<ReturnType<typeof readPlan>>;
  taught: { lessonId: string }[];
}) {
  return after.items
    .filter((item) => taught.some((row) => row.lessonId === item.lessonId))
    .map((item) => item.status);
}

describe(replanAfterMock, () => {
  it("moves a topic the mock missed, not yet taught, earlier with the same phase dates and coverage, and leaves an aced one where it was", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const aced = fixture.library.skills[TOPICS_PER_AREA - 2]!;
    const before = await readPlan(fixture.plan.id);

    const mock = await finishedMock({
      answers: [
        { outcome: "wrong", skill: missed },
        { outcome: "right", skill: aced },
      ],
      fixture,
    });

    await expect(
      replanAfterMock({ goalId: fixture.goal.id, mockId: mock.id, now: new Date(), timeZone: UTC }),
    ).resolves.toStrictEqual([missed.name]);

    const after = await readPlan(fixture.plan.id);

    expect(after.firstDay(missed)).toBeLessThan(before.firstDay(missed));
    expect(after.firstDay(aced)).toBeGreaterThanOrEqual(before.firstDay(aced));
    expect(after.phaseEnds).toStrictEqual(before.phaseEnds);
    expect(after.coveredShare).toBeGreaterThanOrEqual(before.coveredShare ?? 0);
    expect(after.settings.mockReplan).toStrictEqual({ applied: true, mockId: mock.id });

    expect(after.changes.slice(before.changes.length).map((change) => change.kind)).toStrictEqual([
      "mockReordered",
    ]);

    await expect(
      loadTodayPlanChange({ goal: fixture.goal, now: new Date(), timeZone: UTC }),
    ).resolves.toBeNull();
  });

  it("moves a missed topic's lesson up with the earlier lesson of the chapter run it shares", async () => {
    const fixture = await setup();
    const first = fixture.library.skills[TOPICS_PER_AREA - 2]!;
    const missed = lastTopic(fixture, "Direito");
    // Each topic has two lessons: the first topic's second and the missed topic's first teach both.
    const earlier = fixture.library.lessons[(TOPICS_PER_AREA - 2) * 2 + 1]!;
    const later = fixture.library.lessons[(TOPICS_PER_AREA - 1) * 2]!;

    await prisma.lessonSkill.createMany({
      data: [
        { lessonId: earlier.id, skillId: missed.id },
        { lessonId: later.id, skillId: first.id },
      ],
    });

    const before = await readPlan(fixture.plan.id);
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });

    await replanAfterMock({
      goalId: fixture.goal.id,
      mockId: mock.id,
      now: new Date(),
      timeZone: UTC,
    });

    const after = await readPlan(fixture.plan.id);
    const was = before.items.findIndex((item) => item.lessonId === later.id);

    const position = (lessonId: string) =>
      after.items.findIndex((item) => item.lessonId === lessonId);

    expect(position(later.id)).toBeLessThan(was);
    expect(position(earlier.id)).toBeLessThan(position(later.id));
  });

  it("commits an earlier lesson position on the same date", async () => {
    const fixture = await setup({ dailyMinutes: 90 });
    const missed = lastTopic(fixture, "Direito");
    const before = await readPlan(fixture.plan.id);
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });

    await replanAfterMock({
      goalId: fixture.goal.id,
      mockId: mock.id,
      now: new Date(),
      timeZone: UTC,
    });

    const after = await readPlan(fixture.plan.id);

    const links = await prisma.lessonSkill.findMany({ where: { skillId: missed.id } });
    const lessonIds = new Set(links.map(({ lessonId }) => lessonId));

    const first = (plan: typeof before) =>
      plan.items.find(({ lessonId }) => lessonIds.has(lessonId ?? ""));

    expect(first(after)?.scheduledFor).toStrictEqual(first(before)?.scheduledFor);
    expect(first(after)?.position).toBeLessThan(first(before)?.position ?? -1);

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toMatchObject({ result: { movedTopics: [missed.name] } });
  });

  it("moves nothing for questions left blank", async () => {
    const fixture = await setup();
    const blank = lastTopic(fixture, "Direito");
    const before = await readPlan(fixture.plan.id);
    const mock = await finishedMock({ answers: [{ outcome: "blank", skill: blank }], fixture });

    await expect(
      replanAfterMock({ goalId: fixture.goal.id, mockId: mock.id, now: new Date(), timeZone: UTC }),
    ).resolves.toStrictEqual([]);

    const after = await readPlan(fixture.plan.id);

    expect(after.items).toStrictEqual(before.items);
    expect(after.changes).toHaveLength(before.changes.length);
    expect(after.settings.mockReplan).toStrictEqual({ applied: true, mockId: mock.id });
  });

  it("brings back a topic taken as known in the same plan write that moves the missed one", async () => {
    const { fixture, missed, mock, taught } = await relearnSetup();
    const before = await readPlan(fixture.plan.id);

    const moved = await replanAfterMock({
      goalId: fixture.goal.id,
      mockId: mock.id,
      now: new Date(),
      timeZone: UTC,
    });

    const after = await readPlan(fixture.plan.id);

    expect(moved).toContain(missed.name);
    expect(after.version).toBe(before.version + 1);

    expect(after.changes.slice(before.changes.length).map((change) => change.kind)).toStrictEqual([
      "relearn",
    ]);

    expect(relearnedStatuses({ after, taught })).toStrictEqual(["todo", "todo"]);
    expect(after.firstDay(missed)).toBeLessThan(before.firstDay(missed));
  });

  it("re-plans once for a mock however often its finish is retried", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });
    const before = await readPlan(fixture.plan.id);
    const replan = { goalId: fixture.goal.id, mockId: mock.id, timeZone: UTC };

    await replanAfterMock({ ...replan, now: new Date() });
    await expect(replanAfterMock({ ...replan, now: new Date() })).resolves.toStrictEqual([]);

    const after = await readPlan(fixture.plan.id);

    expect(after.version).toBe(before.version + 1);
    expect(after.changes).toHaveLength(before.changes.length + 1);
  });

  it("keeps the schedule when the move would cost coverage or phase dates, and tries again each day the learner opens until it holds", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });
    const before = await readPlan(fixture.plan.id);

    const holds = vi.spyOn(guard, "holdsSchedule").mockReturnValue(false);
    onTestFinished(() => holds.mockRestore());

    await expect(
      replanAfterMock({ goalId: fixture.goal.id, mockId: mock.id, now: new Date(), timeZone: UTC }),
    ).resolves.toStrictEqual([]);

    const catchUp = () =>
      catchUpMockReplan({ goalId: fixture.goal.id, timeZone: UTC, userId: fixture.goal.userId });

    await catchUp();

    const refused = await readPlan(fixture.plan.id);

    expect(refused.items).toStrictEqual(before.items);
    expect(refused.version).toBe(before.version);
    expect(refused.changes).toHaveLength(before.changes.length);
    expect(refused.settings.mockReplan).toBeUndefined();
    expect(holds).toHaveBeenCalledTimes(2);

    holds.mockRestore();
    await catchUp();

    const applied = await readPlan(fixture.plan.id);

    expect(applied.settings.mockReplan).toStrictEqual({ applied: true, mockId: mock.id });
    expect(applied.firstDay(missed)).toBeLessThan(before.firstDay(missed));
  });
});

/** Opens today's day and runs the mock re-plan it owes, as the follow-ups workflow does. */
async function openToday({ id: goalId, userId }: { id: string; userId: string }) {
  await getTodayStudySession({ goalId, timeZone: UTC });

  const owed = await prisma.followUp.findMany({ where: { kind: "catchUpMockReplan", userId } });
  await prisma.followUp.deleteMany({ where: { id: { in: owed.map(({ id }) => id) } } });

  if (owed.length > 0) {
    await catchUpMockReplan({ goalId, timeZone: UTC, userId });
  }

  return owed.map(({ input }) => input);
}

async function readToday(goalId: string) {
  const view = await getTodayView({ goalId, timeZone: UTC });

  if (view.status !== "ready") {
    throw new Error(view.status);
  }

  return view.today.session.blocks.map(({ kind, lessonId, screen }) => ({
    kind,
    lessonId,
    screen,
  }));
}

describe(catchUpMockReplan, () => {
  it("opens the day with its mistakes block and lessons as previewed, and re-plans only later days, once", async () => {
    const fixture = await setup({ dailyMinutes: 20 });
    const missed = lastTopic(fixture, "Direito");
    const [practiced] = fixture.library.skills;

    if (!practiced) {
      throw new Error("Expected the plan's first topic");
    }

    await Promise.all([
      finishedMock({
        answers: [{ outcome: "wrong", skill: missed }],
        finishedAt: new Date(Date.now() - 3 * MS_PER_DAY),
        fixture,
      }),
      attemptFixture({
        answeredAt: new Date(Date.now() - 2 * MS_PER_DAY),
        cause: "gap",
        evidence: "independent",
        isCorrect: false,
        itemId: fixture.itemOf(practiced).id,
        skillId: practiced.id,
        userId: fixture.user.id,
      }),
      mistakeFixture({
        createdAt: new Date(Date.now() - 2 * MS_PER_DAY),
        itemId: fixture.itemOf(practiced).id,
        skillId: practiced.id,
        userId: fixture.user.id,
      }),
    ]);

    const [preview, before] = await Promise.all([
      readToday(fixture.goal.id),
      readPlan(fixture.plan.id),
    ]);

    expect(preview[0]).toMatchObject({ screen: "mistakesPractice" });

    const today = (plan: typeof before) =>
      plan.items
        .filter((item) => item.scheduledFor?.getTime() === before.items[0]?.scheduledFor?.getTime())
        .map((item) => item.id);

    await expect(openToday(fixture.goal)).resolves.toStrictEqual([
      { goalId: fixture.goal.id, timeZone: UTC },
    ]);

    const opened = await readPlan(fixture.plan.id);
    const reordered = opened.changes.filter((change) => change.kind === "mockReordered");

    await expect(readToday(fixture.goal.id)).resolves.toStrictEqual(preview);
    expect(today(opened)).toStrictEqual(today(before));
    expect(reordered).toHaveLength(1);
    expect(opened.firstDay(missed)).toBeLessThan(before.firstDay(missed));

    await expect(openToday(fixture.goal)).resolves.toStrictEqual([]);

    await expect(readToday(fixture.goal.id)).resolves.toStrictEqual(preview);
    await expect(readPlan(fixture.plan.id)).resolves.toMatchObject({ version: opened.version });
  });

  it("keeps today's opened lessons in the day's order whatever order its blocks are read in", async () => {
    const fixture = await setup({ dailyMinutes: 20 });
    const missed = lastTopic(fixture, "Direito");

    await getTodayStudySession({ goalId: fixture.goal.id, timeZone: UTC });

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { session: { goalId: fixture.goal.id } },
    });

    const lessons = blocks.filter((block) => block.lessonId && readBlockPayload(block).planItemKey);
    const [first, second] = lessons;

    if (!first || !second) {
      throw new Error("Expected two lessons on the opened day");
    }

    // The day now shows the second lesson first, and both rewritten rows are stored after the rest.
    await prisma.$transaction([
      prisma.studySessionBlock.update({ data: { position: 1000 }, where: { id: first.id } }),
      prisma.studySessionBlock.update({
        data: { position: first.position },
        where: { id: second.id },
      }),
      prisma.studySessionBlock.update({
        data: { position: second.position },
        where: { id: first.id },
      }),
    ]);

    await finishedMock({
      answers: [{ outcome: "wrong", skill: missed }],
      finishedAt: new Date(Date.now() - 3 * MS_PER_DAY),
      fixture,
    });

    await catchUpMockReplan({
      goalId: fixture.goal.id,
      timeZone: UTC,
      userId: fixture.goal.userId,
    });

    const plan = await readPlan(fixture.plan.id);
    const shown = [second, first, ...lessons.slice(2)].map((block) => block.lessonId);

    expect(plan.changes.filter((change) => change.kind === "mockReordered")).toHaveLength(1);

    expect(
      plan.items
        .filter((item) => item.lessonId && shown.includes(item.lessonId))
        .map((item) => item.lessonId),
    ).toStrictEqual(shown);
  });

  it("applies the relearn and the reorder of a mock marked finished whose re-plan never ran when the learner opens a new day, once", async () => {
    const { fixture, missed, mock, taught } = await relearnSetup();
    const before = await readPlan(fixture.plan.id);

    await openToday(fixture.goal);

    const opened = await readPlan(fixture.plan.id);
    const added = opened.changes.slice(before.changes.length).map((change) => change.kind);

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toMatchObject({ result: { movedTopics: expect.arrayContaining([missed.name]) } });

    expect(added.filter((kind) => kind === "relearn" || kind === "mockReordered")).toStrictEqual([
      "relearn",
    ]);

    expect(relearnedStatuses({ after: opened, taught })).toStrictEqual(["todo", "todo"]);
    expect(opened.firstDay(missed)).toBeLessThan(before.firstDay(missed));

    await catchUpMockReplan({
      goalId: fixture.goal.id,
      timeZone: UTC,
      userId: fixture.goal.userId,
    });

    await expect(readPlan(fixture.plan.id)).resolves.toMatchObject({ version: opened.version });
  });

  it("applies a mock finished before plans followed mocks when the learner opens a new day, once, and never on a read", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const before = await readPlan(fixture.plan.id);

    await finishedMock({
      answers: [{ outcome: "wrong", skill: missed }],
      finishedAt: new Date(Date.now() - 3 * MS_PER_DAY),
      fixture,
    });

    await getTodayView({ goalId: fixture.goal.id, timeZone: UTC });
    await expect(readPlan(fixture.plan.id)).resolves.toMatchObject({ version: before.version });

    await openToday(fixture.goal);

    const opened = await readPlan(fixture.plan.id);

    const reordered = (plan: typeof opened) =>
      plan.changes.filter((change) => change.kind === "mockReordered");

    expect(reordered(opened)).toHaveLength(1);
    expect(opened.firstDay(missed)).toBeLessThan(before.firstDay(missed));

    await catchUpMockReplan({
      goalId: fixture.goal.id,
      timeZone: UTC,
      userId: fixture.goal.userId,
    });

    expect(reordered(await readPlan(fixture.plan.id))).toHaveLength(1);
  });
});

describe(loadPlanMockMisses, () => {
  it("follows the latest mock the plan applied until a newer one finishes or four weeks pass", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });
    const mockReplan = { applied: true, mockId: mock.id };
    const read = (now: Date) => loadPlanMockMisses({ goalId: fixture.goal.id, mockReplan, now });

    await expect(read(new Date())).resolves.toStrictEqual(new Map([[missed.id, "missed"]]));
    await expect(read(new Date(Date.now() + 29 * MS_PER_DAY))).resolves.toStrictEqual(new Map());

    await finishedMock({
      answers: [{ outcome: "wrong", skill: fixture.library.skills[0]! }],
      finishedAt: new Date(Date.now() + MS_PER_DAY),
      fixture,
      purpose: "placement",
    });

    await expect(read(new Date(Date.now() + 2 * MS_PER_DAY))).resolves.toStrictEqual(
      new Map([[missed.id, "missed"]]),
    );

    await finishedMock({
      answers: [{ outcome: "right", skill: missed }],
      finishedAt: new Date(Date.now() + 2 * MS_PER_DAY),
      fixture,
    });

    await expect(read(new Date(Date.now() + 3 * MS_PER_DAY))).resolves.toStrictEqual(new Map());
  });
});

describe(loadMockMisses, () => {
  it("reads answered misses, a part under its minimum apart, and never a blank", async () => {
    const fixture = await setup();
    const [first, second] = fixture.library.skills;
    const short = lastTopic(fixture, "Português");

    const mock = await finishedMock({
      answers: [
        { outcome: "wrong", skill: first! },
        { outcome: "blank", skill: second! },
        { outcome: "wrong", skill: short },
      ],
      fixture,
      points: {
        asked: 20,
        earned: 10,
        max: null,
        met: null,
        minimum: null,
        parts: [tested("Direito", true), tested("Português", false)],
        projected: null,
        short: null,
        unjudged: [],
      },
    });

    await expect(loadMockMisses(mock.id)).resolves.toStrictEqual(
      new Map([
        [first!.id, "missed"],
        [short.id, "shortPart"],
      ]),
    );
  });
});
