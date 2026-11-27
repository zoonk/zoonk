import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { mockConditionsSchema, mockResultSchema } from "../exams/mocks/mock-contract";
import { PLAN_SHOWN } from "../learner/_test-utils/exam-test-goal";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
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

async function setup() {
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
    dailyMinutes: 6,
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
    const fixture = await setup();
    const known = fixture.library.skills[0]!;
    const missed = lastTopic(fixture, "Português");
    const taught = await prisma.lessonSkill.findMany({ where: { skillId: known.id } });

    await prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "testedOut" },
      where: { lessonId: { in: taught.map((row) => row.lessonId) }, planId: fixture.plan.id },
    });

    const before = await readPlan(fixture.plan.id);

    const mock = await finishedMock({
      answers: [
        { outcome: "wrong", skill: known },
        { outcome: "wrong", skill: missed },
      ],
      fixture,
    });

    const moved = await replanAfterMock({
      goalId: fixture.goal.id,
      mockId: mock.id,
      now: new Date(),
      relearnSkillIds: [known.id],
      timeZone: UTC,
    });

    const after = await readPlan(fixture.plan.id);

    expect(moved).toContain(missed.name);
    expect(after.version).toBe(before.version + 1);

    expect(after.changes.slice(before.changes.length).map((change) => change.kind)).toStrictEqual([
      "relearn",
    ]);

    expect(
      after.items
        .filter((item) => taught.some((row) => row.lessonId === item.lessonId))
        .map((item) => item.status),
    ).toStrictEqual(["todo", "todo"]);

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

  it("keeps the schedule when the move would cost coverage or phase dates, and tries once more when the learner opens a new day", async () => {
    const fixture = await setup();
    const missed = lastTopic(fixture, "Direito");
    const mock = await finishedMock({ answers: [{ outcome: "wrong", skill: missed }], fixture });
    const before = await readPlan(fixture.plan.id);

    const holds = vi.spyOn(guard, "holdsSchedule").mockReturnValue(false);
    onTestFinished(() => holds.mockRestore());

    await expect(
      replanAfterMock({ goalId: fixture.goal.id, mockId: mock.id, now: new Date(), timeZone: UTC }),
    ).resolves.toStrictEqual([]);

    const refused = await readPlan(fixture.plan.id);

    expect(refused.items).toStrictEqual(before.items);
    expect(refused.version).toBe(before.version);
    expect(refused.settings.mockReplan).toBeUndefined();

    await catchUpMockReplan({ goal: fixture.goal, now: new Date(), timeZone: UTC });

    const caughtUp = await readPlan(fixture.plan.id);

    expect(caughtUp.items).toStrictEqual(before.items);
    expect(caughtUp.changes).toHaveLength(before.changes.length);
    expect(caughtUp.settings.mockReplan).toStrictEqual({ applied: false, mockId: mock.id });

    await expect(
      loadPlanMockMisses({
        goalId: fixture.goal.id,
        mockReplan: caughtUp.settings.mockReplan,
        now: new Date(),
      }),
    ).resolves.toStrictEqual(new Map());

    expect(holds).toHaveBeenCalledTimes(2);

    await catchUpMockReplan({ goal: fixture.goal, now: new Date(), timeZone: UTC });
    expect(holds).toHaveBeenCalledTimes(2);
  });
});

describe(catchUpMockReplan, () => {
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

    await getTodayStudySession({ goalId: fixture.goal.id, timeZone: UTC });

    const opened = await readPlan(fixture.plan.id);

    const reordered = (plan: typeof opened) =>
      plan.changes.filter((change) => change.kind === "mockReordered");

    expect(reordered(opened)).toHaveLength(1);
    expect(opened.firstDay(missed)).toBeLessThan(before.firstDay(missed));

    await catchUpMockReplan({ goal: fixture.goal, now: new Date(), timeZone: UTC });
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
