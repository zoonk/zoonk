import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { computeSimChange } from "../_test-utils/sim/sim-change";
import { loadSimInputs } from "../_test-utils/sim/sim-inputs";
import { commitSimPlan, computeSimPlan } from "../_test-utils/sim/sim-planner";
import { startRunner } from "../_test-utils/sim/sim-runner";
import { hasMissingWeeklyMove } from "../_utils/missing-weekly-move";
import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { getChangePlanning } from "../_utils/steered-areas";
import { changeGoalPlan } from "../change-goal-plan";
import { createGoalPlan } from "../create-goal-plan";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fundCommittedMocks } from "./committed-mock-funding";
import { withPlannedLessons } from "./core-first";
import { type MockFunding, fundMocks, getFundedMinutes } from "./mock-funding";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { WEEKLY_CHECKPOINT_MINUTES } from "./plan-days";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { applyPlanOperations } from "./plan-operations";
import { toExamWindows } from "./plan-phases";
import { createDays, getPlanStart, listFundedPlanDays } from "./plan-run-days";
import { parsePlanSettings } from "./plan-state";
import { withBuiltSettings } from "./run-outcome";
import { type PlanDay } from "./schedule-units";
import { listSelectedItemFacts } from "./selected-item-facts";

const TODAY = fromIsoDate("2020-09-28");

function save(built: ReturnType<typeof buildPlan>, input: BuildPlanInput): ExistingPlanItem[] {
  const facts = listSelectedItemFacts({ built, input });

  return built.items.map((item, position) => ({
    ...item,
    facts: { ...facts.get(item.key), schemaVersion: 1 },
    id: `saved-${item.key}`,
    position,
  }));
}

function setup(fullCourse = false, outlined = true) {
  const input: BuildPlanInput = {
    fullMockMinutes: 330,
    goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2020-11-07") },
    graph: {
      phases: [
        { milestone: null, name: "Basics" },
        { milestone: null, name: "Depth" },
      ],
      skills: Array.from({ length: 4 }, (_, index) => ({
        area: "Math",
        lessons: 60,
        name: `Topic ${index}`,
        phase: index < 2 ? 0 : 1,
        skillId: `skill-${index}`,
        weight: 1,
      })),
    },
    items: [],
    lessons: outlined
      ? Array.from({ length: 240 }, (_, index) => ({
          chapterId: `chapter-${Math.floor(index / 60)}`,
          lessonId: `lesson-${index}`,
          minutes: 4,
          skillIds: [`skill-${Math.floor(index / 60)}`],
          title: `Lesson ${index}`,
        }))
      : [],
    mockClocks: [{ day: 1, fullMinutes: 330, minutes: 165 }],
    mockMinutes: 165,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ fullCourse, startDate: "2020-09-28" }),
    today: TODAY,
  };

  const built = buildPlan(input);
  const settings = withBuiltSettings({ built, settings: input.settings });
  const graph = withPlannedLessons({ graph: input.graph, skillLessons: built.skillLessons });

  const saved = {
    ...input,
    examWindows: toExamWindows(built.phases),
    graph,
    items: save(built, input),
    settings,
  };

  const source = built.mockFunding.find((entry) => !entry.fullLength && entry.date >= "2020-10-07");

  if (!source) {
    throw new Error("Expected a real funded regular mock for the local edit");
  }

  return { built, input: saved, source };
}

function change({ input, operations }: { input: BuildPlanInput; operations: PlanOperation[] }) {
  const result = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: {
      goal: {
        dailyMinutes: input.goal.dailyMinutes,
        targetDate: input.goal.targetDate && toIsoDate(input.goal.targetDate),
      },
      graph: input.graph,
      settings: input.settings,
    },
    today: input.today,
  });

  if ("error" in result) {
    throw new Error(`Expected a valid operation: ${result.error}`);
  }

  const { state } = result;
  const planning = getChangePlanning(operations);

  return buildPlan({
    ...input,
    ...planning,
    goal: {
      ...input.goal,
      dailyMinutes: state.goal.dailyMinutes,
      targetDate: state.goal.targetDate ? fromIsoDate(state.goal.targetDate) : null,
    },
    graph: state.graph,
    requestedMoveDates: new Set(
      operations.flatMap((operation) =>
        operation.kind === "moveWeeklyEvent" ? [operation.to] : [],
      ),
    ),
    settings: state.settings,
  });
}

function teaching(items: readonly PlannedItem[]) {
  return items
    .filter((item) => item.kind === "lesson" || item.kind === "chapter" || item.kind === "boss")
    .toSorted((a, b) => a.key.localeCompare(b.key));
}

function withoutRow({
  id: _id,
  position: _position,
  ...item
}: PlannedItem & { position?: number }) {
  const { facts: _facts, ...planned } = item;
  return planned;
}

function afterExamAllocations(built: ReturnType<typeof buildPlan>) {
  return new Map(
    [...built.lessonDayMinutes]
      .filter(([, days]) => [...days.keys()].some((date) => date > "2020-11-07"))
      .map(([key, days]) => [key, [...days].filter(([date]) => date > "2020-11-07")]),
  );
}

describe("a mock-only move keeps the selected plan", () => {
  it.each([true, false])(
    "keeps the saved full-course continuation and teaching (outlined: %s)",
    (outlined) => {
      const { built, input: saved, source } = setup(true, outlined);
      const input = { ...saved, today: fromIsoDate("2020-10-07") };
      const phase = built.phases.findIndex((entry) => entry.kind === "afterExam");
      expect(phase).toBeGreaterThanOrEqual(0);
      expect([...afterExamAllocations(built).values()].flat().length).toBeGreaterThan(0);

      const next = change({
        input,
        operations: [{ from: source.date, kind: "moveWeeklyEvent", to: "2020-10-12" }],
      });

      expect(next.phases[phase]).toStrictEqual(built.phases[phase]);

      expect(
        next.items.filter((item) => item.phase === phase).map((item) => withoutRow(item)),
      ).toStrictEqual(
        built.items.filter((item) => item.phase === phase).map((item) => withoutRow(item)),
      );

      expect(next.mockFunding.filter((entry) => entry.date > "2020-11-07")).toStrictEqual(
        built.mockFunding.filter((entry) => entry.date > "2020-11-07"),
      );

      expect(afterExamAllocations(next)).toStrictEqual(afterExamAllocations(built));
    },
  );

  it("commits the simulator's actual bank and item facts before moving a saved mock", async () => {
    const inputs = await loadSimInputs("class-test");

    const runner = await startRunner({
      check: () => [],
      inputs,
      life: {
        dailyMinutes: 45,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1,
        speed: 1,
        start: "2020-09-28",
        steps: [],
        subscribed: true,
        targetInDays: 40,
      },
    });

    const computed = computeSimPlan({ mode: "forced", world: runner.world });
    const plan = commitSimPlan({ computed, world: runner.world });
    expect(computed.built.mockFunding).not.toHaveLength(0);
    expect.soft(plan.state.settings.mockFunding).toStrictEqual(computed.built.mockFunding);

    expect
      .soft(plan.items.map((item) => readSelectedItemFacts(item.facts)))
      .toStrictEqual(
        plan.items.map((item) => ({
          ...computed.itemFacts.get(getItemKey(item)),
          schemaVersion: 1,
        })),
      );

    const source = plan.items.find((item) => item.kind === "mock" && item.status === "todo");

    if (!source?.scheduledFor) {
      throw new Error("Expected a saved weekly mock from the actual simulator creation build");
    }

    const operations: PlanOperation[] = [
      {
        from: toIsoDate(source.scheduledFor),
        kind: "moveWeeklyEvent",
        to: toIsoDate(addDays(source.scheduledFor, 1)),
      },
    ];

    const moved = computeSimChange({ operations, world: { ...runner.world, plan } });
    expect(moved.status).toBe("computed");

    if (moved.status !== "computed") {
      throw new Error("Expected the simulator to compute the valid weekly move");
    }

    expect(hasMissingWeeklyMove({ items: moved.computed.built.items, operations })).toBe(false);
  });

  it.each([
    {
      absent: ["2020-10-09", "2020-10-12", "2020-10-23"],
      moves: [
        { from: "2020-10-09", to: "2020-10-12" },
        { from: "2020-10-23", to: "2020-10-26" },
        { from: "2020-10-12", to: "2020-10-19" },
      ],
      name: "a chain interleaved with another event",
      present: ["2020-10-19", "2020-10-26", "2020-10-16"],
    },
    {
      absent: ["2020-10-09", "2020-10-16"],
      moves: [
        { from: "2020-10-16", to: "2020-10-12" },
        { from: "2020-10-09", to: "2020-10-12" },
      ],
      name: "legacy same-destination moves",
      present: ["2020-10-12"],
    },
  ])("replays $name without changing stored history", ({ absent, moves, present }) => {
    const { input: saved } = setup();

    const input = {
      ...saved,
      fullMockMinutes: 1,
      items: [],
      mockClocks: [{ day: 1, fullMinutes: 1, minutes: 1 }],
      mockMinutes: 1,
      settings: {
        ...saved.settings,
        mockFunding: [],
        movedEvents: moves,
        weekdayMinutes: [0, 30, 30, 30, 30, 30, 0],
      },
    };

    const before = structuredClone(input);
    const days = createDays({ input, planStart: getPlanStart(input) });

    expect(days.describeDay(fromIsoDate("2020-10-09")).events).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "mock" })]),
    );

    const planned = listFundedPlanDays({ days, input });

    const dates = new Set(
      planned.days
        .filter((day) => day.shape.events.some((event) => event.kind === "mock"))
        .map((day) => toIsoDate(day.date)),
    );

    expect(present.every((date) => dates.has(date))).toBe(true);
    expect(absent.every((date) => !dates.has(date))).toBe(true);
    expect(input).toStrictEqual(before);
  });

  it("keeps its lesson selection and committed funding, moving only the event and displaced work", () => {
    const { built, input, source } = setup();
    const to = toIsoDate(addDays(fromIsoDate(source.date), 1));

    const moved = change({
      input,
      operations: [{ from: source.date, kind: "moveWeeklyEvent", to }],
    });

    expect(moved.mocks.unfundedMocks).toStrictEqual([]);

    expect(
      moved.items
        .filter((item) => item.kind === "mock")
        .map((item) => item.scheduledFor && toIsoDate(item.scheduledFor)),
    ).toContain(to);

    expect(teaching(moved.items).map((item) => item.key)).toStrictEqual(
      teaching(built.items).map((item) => item.key),
    );

    const displaced = new Set(
      teaching(built.items)
        .filter((item) => item.scheduledFor && toIsoDate(item.scheduledFor) === to)
        .map((item) => item.key),
    );

    expect(
      teaching(moved.items)
        .filter((item) => !displaced.has(item.key))
        .map((item) => withoutRow(item)),
    ).toStrictEqual(
      teaching(built.items)
        .filter((item) => !displaced.has(item.key))
        .map((item) => withoutRow(item)),
    );

    expect(moved.mockFunding.find((entry) => entry.date === to)).toStrictEqual({
      ...source,
      date: to,
    });

    expect(moved.mockFunding.filter((entry) => entry.date !== to)).toStrictEqual(
      built.mockFunding.filter((entry) => entry.date !== source.date),
    );

    expect(displaced.size).toBeGreaterThan(0);

    expect(
      moved.items.filter(
        (item) =>
          item.kind === "lesson" && item.scheduledFor && toIsoDate(item.scheduledFor) === to,
      ),
    ).toStrictEqual([]);
  });

  it("still selects more teaching when the learner increases their daily time", () => {
    const { built, input } = setup();
    const changed = change({ input, operations: [{ kind: "setDailyMinutes", minutes: 90 }] });
    const before = new Set(teaching(built.items).map((item) => item.key));

    expect(teaching(changed.items).filter((item) => !before.has(item.key)).length).toBeGreaterThan(
      0,
    );
  });
});

function fundingDay({
  date,
  minutes,
  mock = false,
  fullLength = false,
  kept = 0,
}: {
  date: string;
  minutes: number;
  mock?: boolean;
  fullLength?: boolean;
  kept?: number;
}): PlanDay {
  return {
    date: fromIsoDate(date),
    shape: {
      events: mock
        ? [
            {
              key: `mock:${date}`,
              kind: "mock",
              minutes: 165,
              mock: { day: 1, fullLength },
              replacesDay: true,
              title: "",
            },
          ]
        : [],
      kept,
      minutes,
      open: true,
      phase: 0,
      share: 0.6,
    },
  };
}

describe("committed banks on a local move", () => {
  it("never replays historical moves against already-saved mock banks", () => {
    const saved = ["2020-10-09", "2020-10-16", "2020-10-23"].map((date, index) => ({
      contributions: [{ date: `2020-10-0${index + 6}`, minutes: 154 }],
      date,
      day: 1,
      fullLength: false,
      minutes: 165,
    }));

    const result = fundMocks({
      clocks: [{ day: 1, fullMinutes: 330, minutes: 165 }],
      days: ["2020-10-09", "2020-10-16", "2020-10-24"].map((date) =>
        fundingDay({ date, minutes: 11, mock: true }),
      ),
      funding: saved,
      keepSelection: true,
      moves: [
        { from: "2020-10-09", to: "2020-10-16" },
        { from: "2020-10-02", to: "2020-10-09" },
        { from: "2020-10-23", to: "2020-10-24" },
      ],
      requested: new Set(["2020-10-24"]),
    });

    expect(result.unfunded).toStrictEqual([]);
    expect(result.practiceFunding ?? []).toStrictEqual([]);

    expect(result.funding).toStrictEqual(
      saved.map((entry) =>
        entry.date === "2020-10-23" ? { ...entry, date: "2020-10-24" } : entry,
      ),
    );
  });

  const source: MockFunding = {
    contributions: [{ date: "2020-10-18", minutes: 154 }],
    date: "2020-10-19",
    day: 1,
    fullLength: false,
    minutes: 165,
  };

  const other: MockFunding = {
    contributions: [{ date: "2020-10-20", minutes: 11 }],
    date: "2020-11-02",
    day: 1,
    fullLength: true,
    minutes: 330,
  };

  const request = {
    clocks: [{ day: 1, fullMinutes: 330, minutes: 165 }],
    funding: [source, other],
    moves: [{ from: source.date, to: "2020-10-20" }],
  };

  it("cannot spend the destination's contribution to another mock", () => {
    const result = fundCommittedMocks({
      ...request,
      days: [fundingDay({ date: "2020-10-20", minutes: 11, mock: true })],
    });

    expect(result.unfunded).toStrictEqual([{ date: "2020-10-20", minutes: 165 }]);
    expect(result.funding).toStrictEqual([other]);
  });

  it("can top up from the freed source, keeping the other bank beyond the horizon unchanged", () => {
    const result = fundCommittedMocks({
      ...request,
      days: [
        fundingDay({ date: "2020-10-19", minutes: 11 }),
        fundingDay({ date: "2020-10-20", minutes: 11, mock: true }),
      ],
    });

    expect(result.unfunded).toStrictEqual([]);

    expect(result.funding).toStrictEqual([
      {
        ...source,
        contributions: [...source.contributions, { date: source.date, minutes: 11 }],
        date: "2020-10-20",
      },
      other,
    ]);

    expect(
      getFundedMinutes({ base: 11, date: fromIsoDate("2020-10-20"), funding: result.funding }),
    ).toBe(165);
  });

  it.each([
    { accepted: true, grows: true, practice: 25 },
    { accepted: false, grows: true, practice: 24 },
    { accepted: true, grows: false, practice: 25 },
  ])("donates only the minimum practice for clock growth: %j", ({ accepted, grows, practice }) => {
    const saved: MockFunding = {
      contributions: [{ date: "2020-09-30", minutes: 105 }],
      date: "2020-10-09",
      day: 1,
      fullLength: false,
      minutes: 165,
    };

    const result = fundCommittedMocks({
      clocks: [{ day: 1, fullMinutes: 330, minutes: 165 }],
      days: [
        fundingDay({ date: "2020-10-07", kept: 35, minutes: 35 }),
        fundingDay({ date: "2020-10-08", kept: 31, minutes: 100 }),
        fundingDay({ date: "2020-10-09", minutes: 60 }),
        fundingDay({ date: "2020-10-12", fullLength: grows, minutes: 60, mock: true }),
      ],
      funding: [saved],
      moves: [{ from: saved.date, to: "2020-10-12" }],
      practice: new Map([
        ["2020-10-07", practice],
        ["2020-10-08", 11],
      ]),
    });

    expect(result.unfunded).toStrictEqual(accepted ? [] : [{ date: "2020-10-12", minutes: 330 }]);

    expect(result.practiceFunding ?? []).toStrictEqual(
      accepted && grows
        ? [
            {
              contributions: [
                { date: "2020-10-08", minutes: 11 },
                { date: "2020-10-07", minutes: 25 },
              ],
              date: "2020-10-12",
            },
          ]
        : [],
    );

    expect(result.funding).toStrictEqual(
      accepted
        ? [
            {
              ...saved,
              contributions: grows
                ? [
                    ...saved.contributions,
                    { date: "2020-10-07", minutes: 25 },
                    { date: "2020-10-08", minutes: 80 },
                    { date: "2020-10-09", minutes: 60 },
                  ]
                : saved.contributions,
              date: "2020-10-12",
              fullLength: grows,
              minutes: grows ? 330 : 165,
            },
          ]
        : [],
    );
  });
});

const savedReviewRow = (
  date: string,
  kind: "checkpoint" | "mock" | "review",
  minutes: number,
): ExistingPlanItem => ({
  chapterId: null,
  completedAt: null,
  facts: {
    minutes,
    parts: {
      checkpoint: kind === "review" ? 0 : minutes,
      practice: kind === "review" ? minutes : 0,
      unwritten: 0,
      written: 0,
    },
    schemaVersion: 1,
    skillIds: [],
  },
  id: `${kind}:${date}`,
  kind,
  lessonId: null,
  phase: 0,
  position: 0,
  scheduledFor: fromIsoDate(date),
  skillId: null,
  status: "todo",
  titleSnapshot: kind,
});

function reviewInput(grows = true) {
  return {
    fullMockMinutes: 330,
    goal: {
      dailyMinutes: 60,
      kind: "exam",
      targetDate: fromIsoDate(grows ? "2020-10-14" : "2020-11-07"),
    },
    graph: { phases: [{ milestone: null, name: "Basics" }], skills: [] },
    items: [
      savedReviewRow("2020-10-07", "review", 60),
      savedReviewRow("2020-10-08", "review", 60),
      savedReviewRow("2020-10-09", "mock", 165),
      savedReviewRow("2020-10-12", "review", 60),
    ],
    keepSelection: true,
    lessons: [],
    mockClocks: [{ day: 1, fullMinutes: 330, minutes: 165 }],
    mockMinutes: 165,
    mode: "automatic",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    requestedMoveDates: new Set(["2020-10-12"]),
    settings: parsePlanSettings({
      mockFunding: [
        {
          contributions: [{ date: "2020-10-06", minutes: 105 }],
          date: "2020-10-09",
          day: 1,
          fullLength: false,
          minutes: 165,
        },
      ],
      movedEvents: [{ from: "2020-10-09", to: "2020-10-12" }],
      startDate: "2020-09-28",
      weekdayMinutes: [0, 60, 0, 60, 60, 60, 0],
    }),
    today: fromIsoDate("2020-10-07"),
  } satisfies BuildPlanInput;
}

type CheckpointCapacity = "review" | "interval" | "intervalReview" | "forward" | "noRoom";

/**
 * A checkpoint moved from a Sunday onto a Monday whose lesson it doesn't leave room for. Where the
 * Sunday rests (`forward`, `noRoom`), the lesson goes on to the earliest later day with room, as
 * the learner asked the move (LEAD ruling A, rule 1); it's refused only when no day before the
 * goal's date has room (`noRoom`, rule 2).
 */
function checkpointMoveFixture(capacity: CheckpointCapacity) {
  const saved = reviewInput(false);
  const usesReview = capacity === "review";
  const restsSunday = capacity === "forward" || capacity === "noRoom";
  const fits = capacity !== "noRoom";

  const sourceReview =
    capacity === "intervalReview" ? [savedReviewRow("2020-10-11", "review", 45)] : [];

  const lesson = {
    ...savedReviewRow(usesReview ? "2020-10-14" : "2020-10-12", "review", 60),
    facts: {
      minutes: 60,
      parts: { checkpoint: 0, practice: 0, unwritten: 0, written: 60 },
      schemaVersion: 1,
      skillIds: ["saved-skill"],
    },
    id: "saved-written-lesson",
    kind: "lesson" as const,
    lessonId: "saved-written-lesson",
    skillId: "saved-skill",
  };

  const review = savedReviewRow("2020-10-12", "review", usesReview ? 60 : 0);

  const input: BuildPlanInput = {
    ...saved,
    goal: {
      ...saved.goal,
      kind: "learn",
      targetDate: fits ? saved.goal.targetDate : fromIsoDate("2020-10-13"),
    },
    items: [
      savedReviewRow("2020-10-11", "checkpoint", WEEKLY_CHECKPOINT_MINUTES),
      ...sourceReview,
      review,
      lesson,
    ],
    settings: {
      ...saved.settings,
      mockFunding: [],
      movedEvents: [
        ...(restsSunday ? [{ from: "2020-10-09", to: "2020-10-11" }] : []),
        { from: "2020-10-11", to: "2020-10-12" },
      ],
      weekdayMinutes: restsSunday ? [0, 60, 60, 60, 60, 60, 0] : null,
    },
  };

  return { fits, input, lesson, restsSunday, review, sourceReview, usesReview };
}

/** A lesson's time by day, as its saved facts and the plan's day minutes say it. */
type LessonDays = readonly (readonly [string, number])[];

function expectCheckpointAllocations({
  built,
  capacity,
  fixture,
}: {
  built: ReturnType<typeof buildPlan>;
  capacity: CheckpointCapacity;
  fixture: ReturnType<typeof checkpointMoveFixture>;
}) {
  const { input, lesson, review, sourceReview, usesReview } = fixture;
  const lessonDate = usesReview ? "2020-10-14" : "2020-10-12";

  const movedTo: Partial<Record<CheckpointCapacity, string>> = {
    forward: "2020-10-13",
    interval: "2020-10-11",
  };

  const fittedDate = movedTo[capacity] ?? lessonDate;

  expect(built.items.find((item) => item.id === review.id)?.minutes).toBe(
    usesReview ? 60 - WEEKLY_CHECKPOINT_MINUTES : 0,
  );

  expect(
    built.items
      .filter((item) => item.kind !== "checkpoint")
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        lessonId: item.lessonId,
        minutes: item.minutes,
        scheduledFor: item.scheduledFor,
      })),
  ).toStrictEqual(
    [
      ...sourceReview.map((item) => ({
        id: item.id,
        kind: item.kind,
        lessonId: item.lessonId,
        minutes: 45,
        scheduledFor: item.scheduledFor,
      })),
      {
        id: review.id,
        kind: "review",
        lessonId: null,
        minutes: usesReview ? 60 - WEEKLY_CHECKPOINT_MINUTES : 0,
        scheduledFor: review.scheduledFor,
      },
      {
        id: lesson.id,
        kind: "lesson",
        lessonId: lesson.lessonId,
        minutes: 60,
        scheduledFor: fromIsoDate(fittedDate),
      },
    ].toSorted((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0)),
  );

  expect(
    built.planDays
      .find((day) => day.date.getTime() === review.scheduledFor?.getTime())
      ?.shape.events.reduce((sum, event) => sum + event.minutes, 0),
  ).toBeLessThanOrEqual(60);

  expect(built.mocks.practiceFunding ?? []).toStrictEqual([]);

  const shift = (from: string, to: string) => [
    { from, itemKeys: [getItemKey(lesson)], lessons: 1, to },
  ];

  const shifts: Record<CheckpointCapacity, ReturnType<typeof shift>> = {
    // Sunday rests, so what Monday can't hold beside the checkpoint goes on to Tuesday.
    forward: shift("2020-10-12", "2020-10-13"),
    interval: shift("2020-10-11", "2020-10-12"),
    intervalReview: shift("2020-10-11", "2020-10-12"),
    noRoom: [],
    review: [],
  };

  expect(built.mocks.selectionShifts ?? []).toStrictEqual(shifts[capacity]);

  const splits: Partial<Record<CheckpointCapacity, LessonDays>> = {
    forward: [
      ["2020-10-12", 60 - WEEKLY_CHECKPOINT_MINUTES],
      ["2020-10-13", WEEKLY_CHECKPOINT_MINUTES],
    ],
    intervalReview: [
      ["2020-10-11", WEEKLY_CHECKPOINT_MINUTES],
      ["2020-10-12", 60 - WEEKLY_CHECKPOINT_MINUTES],
    ],
  };

  const days = splits[capacity];

  expect(listSelectedItemFacts({ built, input }).get(getItemKey(lesson))?.days).toStrictEqual(
    days ? days.map(([date, minutes]) => [date, minutes, minutes]) : undefined,
  );

  expect([...(built.lessonDayMinutes.get(getItemKey(lesson)) ?? [])]).toStrictEqual(
    days ? days.map(([date, minutes]) => [date, minutes]) : [[fittedDate, 60]],
  );

  expect([...(built.lessonRawMinutes.get(getItemKey(lesson)) ?? [])]).toStrictEqual([
    ...(built.lessonDayMinutes.get(getItemKey(lesson)) ?? []),
  ]);
}

describe("saved review practice on local moves", () => {
  it.each(["review", "interval", "intervalReview", "forward", "noRoom"] as const)(
    "fits a moved checkpoint using the available %s capacity",
    (capacity) => {
      const fixture = checkpointMoveFixture(capacity);
      const { fits, input, lesson, restsSunday, review } = fixture;

      const before = structuredClone(input);
      const built = buildPlan(input);

      const destination = built.items.filter(
        (item) => item.scheduledFor?.getTime() === review.scheduledFor?.getTime(),
      );

      const fixedMinutes = destination
        .filter((item) => item.kind !== "lesson")
        .reduce((sum, item) => sum + item.minutes, 0);

      expect(
        fixedMinutes + (built.lessonDayMinutes.get(getItemKey(lesson))?.get("2020-10-12") ?? 0),
      ).toBeLessThanOrEqual(60);

      expect(
        built.planDays.find((day) => toIsoDate(day.date) === "2020-10-11")?.shape.minutes,
      ).toBe(restsSunday ? 0 : 60);

      expect(destination.filter((item) => item.kind === "checkpoint")).toHaveLength(fits ? 1 : 0);

      expect(
        destination.filter((item) => item.kind === "checkpoint").map((item) => item.minutes),
      ).toStrictEqual(fits ? [WEEKLY_CHECKPOINT_MINUTES] : []);

      expect(
        hasMissingWeeklyMove({
          items: built.items,
          operations: [{ from: "2020-10-11", kind: "moveWeeklyEvent", to: "2020-10-12" }],
        }),
      ).toBe(!fits);

      expectCheckpointAllocations({ built, capacity, fixture });

      expect(input).toStrictEqual(before);
    },
  );

  it("reserves saved review practice and donates only the residual clock growth", () => {
    const input = reviewInput();

    const funded = listFundedPlanDays({
      days: createDays({ input, planStart: getPlanStart(input) }),
      input,
    });

    expect(funded.unfunded).toStrictEqual([]);

    expect(funded.practiceFunding).toStrictEqual([
      {
        contributions: [
          { date: "2020-10-08", minutes: 60 },
          { date: "2020-10-07", minutes: 45 },
        ],
        date: "2020-10-12",
      },
    ]);

    expect(funded.funding[0]?.minutes).toBe(330);
  });

  it("does not invent donated practice for legacy review rows already funding the bank", () => {
    const saved = reviewInput();

    const input = {
      ...saved,
      items: saved.items.map((item) => (item.kind === "review" ? { ...item, facts: null } : item)),
      settings: {
        ...saved.settings,
        mockFunding: saved.settings.mockFunding.map((entry) => ({
          ...entry,
          contributions: [
            { date: "2020-10-07", minutes: 45 },
            { date: "2020-10-08", minutes: 60 },
          ],
        })),
      },
    };

    const before = structuredClone(input);

    const funded = listFundedPlanDays({
      days: createDays({ input, planStart: getPlanStart(input) }),
      input,
    });

    expect(funded.unfunded).toStrictEqual([{ date: "2020-10-12", minutes: 330 }]);
    expect(funded.practiceFunding ?? []).toStrictEqual([]);
    expect(funded.days.every((day) => day.shape.minutes >= 0)).toBe(true);
    expect(input).toStrictEqual(before);
  });

  it("keeps an unchanged zero-minute review outside the local edit", () => {
    const saved = reviewInput();
    const zero = savedReviewRow("2020-10-13", "review", 0);
    const built = buildPlan({ ...saved, items: [...saved.items, zero] });

    expect(built.items.find((item) => item.id === zero.id)).toMatchObject({
      id: zero.id,
      minutes: 0,
      scheduledFor: zero.scheduledFor,
    });
  });

  it("keeps every donor review unchanged for a same-clock move", () => {
    const input = reviewInput(false);
    const built = buildPlan(input);
    expect(built.mocks.unfundedMocks).toStrictEqual([]);
    expect(built.mocks.practiceFunding ?? []).toStrictEqual([]);

    expect(
      built.items
        .filter((item) => item.kind === "review")
        .map((item) => ({
          date: item.scheduledFor && toIsoDate(item.scheduledFor),
          minutes: item.minutes,
        })),
    ).toStrictEqual([
      { date: "2020-10-07", minutes: 60 },
      { date: "2020-10-08", minutes: 60 },
    ]);
  });

  it("replaces the destination review and debits actual saved donor rows", () => {
    const input = reviewInput();
    const built = buildPlan(input);

    expect(built.mocks.unfundedMocks).toStrictEqual([]);

    expect(
      built.items
        .filter((item) => item.kind === "review")
        .map((item) => ({
          date: item.scheduledFor && toIsoDate(item.scheduledFor),
          minutes: item.minutes,
        })),
    ).toStrictEqual([{ date: "2020-10-07", minutes: 15 }]);

    expect(
      built.items
        .filter((item) => item.kind === "mock")
        .map((item) => ({
          date: item.scheduledFor && toIsoDate(item.scheduledFor),
          minutes: item.minutes,
        })),
    ).toStrictEqual([{ date: "2020-10-12", minutes: 330 }]);
  });
});

describe("real saved local-move commitments", () => {
  it.each(["2020-10-16", "2020-10-19"])(
    "preserves the actual saved teaching and bosses when moving a real funded mock to %s",
    async (to) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

      try {
        const [user, blueprint, library] = await Promise.all([
          userFixture(),
          examBlueprintFixture({
            structure: {
              formats: [],
              mock: {
                citations: [],
                order: null,
                scoring: { description: "One point per correct answer", method: "raw" },
                sections: [{ day: 1, minutes: 330, name: "Math", questions: 60 }],
                timeLimitMinutes: 330,
                totalQuestions: 60,
              },
              rules: [],
              subjects: [],
            },
          }),
          planLibraryFixture({ skills: [{ area: "Math", lessons: 200 }] }),
        ]);

        await prisma.lesson.updateMany({
          data: { estimatedMinutes: 4 },
          where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
        });

        const { goal, plan } = await unplannedGoalFixture({
          createdAt: new Date("2020-09-28"),
          dailyMinutes: 30,
          details: { placementDeclined: true },
          examBlueprintId: blueprint.id,
          kind: "exam",
          settings: { startDate: "2020-09-28", weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] },
          targetDate: new Date("2020-11-04"),
          timezone: "UTC",
          userId: user.id,
        });

        await prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        });

        await createGoalPlan({ goalId: goal.id, graph: library.graph });

        await Promise.all(
          Array.from({ length: 30 }, () =>
            itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
          ),
        );

        mockSession(user.id);

        const read = () =>
          prisma.plan.findUniqueOrThrow({
            include: { items: { orderBy: { position: "asc" } } },
            where: { id: plan.id },
          });

        const before = await read();

        const preliminary = to === "2020-10-19" ? [{ from: "2020-10-09", to: "2020-10-12" }] : [];

        await preliminary.reduce(async (previous, move) => {
          await previous;

          await expect(
            changeGoalPlan({
              goalId: goal.id,
              input: { operations: [{ ...move, kind: "moveWeeklyEvent" }], timeZone: "UTC" },
            }),
          ).resolves.toMatchObject({ status: "applied" });
        }, Promise.resolve());

        const changed = await changeGoalPlan({
          goalId: goal.id,
          input: {
            operations: [
              {
                from: to === "2020-10-19" ? "2020-10-12" : "2020-10-09",
                kind: "moveWeeklyEvent",
                to,
              },
            ],
            timeZone: "UTC",
          },
        });

        const after = await read();

        const facts = (saved: typeof before) => ({
          bosses: saved.items
            .filter((item) => item.kind === "boss")
            .map((item) => ({
              date: item.scheduledFor?.toISOString().slice(0, 10),
              id: item.id,
              phase: item.phase,
            })),
          funding: parsePlanSettings(saved.settings).mockFunding,
          lessons: saved.items
            .filter((item) => item.kind === "lesson")
            .map((item) => ({
              date: item.scheduledFor?.toISOString().slice(0, 10),
              id: item.id,
              lessonId: item.lessonId,
              phase: item.phase,
            })),
        });

        expect(changed).toMatchObject({
          change: { effect: { lessonsAdded: 0, lessonsRemoved: 0 } },
          status: "applied",
        });

        expect(facts(before).lessons.filter((item) => item.phase === 0)).toHaveLength(14);
        expect(facts(before).bosses.find((item) => item.phase === 1)?.date).toBe("2020-10-19");
        expect(facts(before).funding).toHaveLength(1);
        expect(facts(after).funding).toHaveLength(1);

        const original = facts(before).funding[0];
        const moved = facts(after).funding[0];

        if (!original || !moved) {
          throw new Error("Expected the real committed mock bank");
        }

        expect({ ...moved, contributions: [] }).toStrictEqual({
          ...original,
          contributions: [],
          date: to,
        });

        // The phase's challenge on the mock's new day runs on top of it, as the day asks.
        expect(
          parsePlanSettings(after.settings).checkpointOverflow.find((entry) => entry.date === to),
        ).toStrictEqual(to === "2020-10-19" ? { date: to, minutes: 15 } : undefined);

        const oldDates = new Set(original.contributions.map((part) => part.date));

        expect(moved.contributions.filter((part) => oldDates.has(part.date))).toStrictEqual(
          original.contributions,
        );

        const additions = moved.contributions.filter((part) => !oldDates.has(part.date));
        const intervalStart = to === "2020-10-19" ? "2020-10-12" : "2020-10-09";
        expect(additions.every((part) => part.date >= intervalStart && part.date < to)).toBe(true);

        // The challenge's time is on top of its day, so its day funds the mock as fully as before.
        expect(additions.reduce((total, part) => total + part.minutes, 0)).toBeCloseTo(0);

        expect(
          after.items
            .filter((item) => item.kind === "lesson")
            .map((item) => ({ id: item.id, lessonId: item.lessonId })),
        ).toStrictEqual(
          before.items
            .filter((item) => item.kind === "lesson")
            .map((item) => ({ id: item.id, lessonId: item.lessonId })),
        );

        expect(facts(after).bosses).toStrictEqual(facts(before).bosses);
      } finally {
        mockSession(null);
        vi.useRealTimers();
      }
    },
  );
});
