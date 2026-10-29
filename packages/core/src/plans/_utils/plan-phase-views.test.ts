import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase } from "../planner/plan-state";
import { findCurrentPhase } from "./phase-states";
import { buildPhaseViews, getSkillAreas } from "./plan-phase-views";

function phase(attrs: Partial<PlanPhase> = {}): PlanPhase {
  return {
    endDate: null,
    kind: "learn",
    milestone: null,
    minutes: 0,
    name: "Phase",
    startDate: null,
    ...attrs,
  };
}

function lesson(position: number, phaseIndex: number): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id: `item-${position}`,
    kind: "lesson",
    lessonId: null,
    phase: phaseIndex,
    position,
    scheduledFor: null,
    skillId: `skill-${position}`,
    status: "todo",
    titleSnapshot: `Lesson ${position}`,
  };
}

function chapterLesson(position: number, chapterId: string, status: "done" | "todo") {
  return { ...lesson(position, 0), chapterId, status };
}

function standIn(position: number, day: string): ExistingPlanItem {
  return { ...lesson(position, 0), scheduledFor: new Date(`${day}T00:00:00.000Z`) };
}

function boss(position: number, phaseIndex: number, status: "done" | "todo", day = "2026-10-16") {
  return {
    ...lesson(position, phaseIndex),
    kind: "boss" as const,
    scheduledFor: new Date(`${day}T00:00:00.000Z`),
    skillId: null,
    status,
  };
}

describe(buildPhaseViews, () => {
  const items = [lesson(0, 0), lesson(1, 0), lesson(2, 0), lesson(3, 1)];

  it("uses the planner's minutes for each phase", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      estimateMinutes: 600,
      goalKind: "learn",
      items,
      phases: [phase({ minutes: 90 }), phase({ minutes: 30 })],
      skillAreas: new Map(),
      upNextItemId: null,
    });

    expect(views.map((view) => view.hours)).toStrictEqual([1.5, 0.5]);
  });

  it("shares the plan's estimate by lessons when a phase was saved without minutes", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      estimateMinutes: 240,
      goalKind: "learn",
      items,
      phases: [phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: null,
    });

    expect(views.map((view) => view.hours)).toStrictEqual([3, 1]);
  });

  it("marks a chapter finished after the current one as done", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map([
        ["a", "Percentages"],
        ["b", "Reading"],
        ["c", "Ecology"],
      ]),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        chapterLesson(0, "a", "done"),
        chapterLesson(1, "b", "done"),
        chapterLesson(2, "a", "todo"),
        chapterLesson(3, "c", "todo"),
      ],
      phases: [phase()],
      skillAreas: new Map(),
      upNextItemId: "item-2",
    });

    expect(view?.chapters.map((chapter) => [chapter.title, chapter.state])).toStrictEqual([
      ["Percentages", "current"],
      ["Reading", "done"],
      ["Ecology", "upcoming"],
    ]);
  });

  it("shows skills still being written under their course, never their raw names", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map([["a", "What you own when you buy a share"]]),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        chapterLesson(0, "a", "todo"),
        { ...lesson(1, 0), titleSnapshot: "Distinguish share issuance from trading" },
        { ...lesson(2, 0), titleSnapshot: "Explain market liquidity" },
        { ...lesson(3, 0), skillId: "skill-unknown", titleSnapshot: "Read an order book" },
      ],
      phases: [phase()],
      skillAreas: new Map([
        ["skill-1", "Stock market"],
        ["skill-2", "Stock market"],
      ]),
      upNextItemId: null,
    });

    expect(view?.chapters.map(({ title, writing }) => ({ title, writing }))).toStrictEqual([
      { title: "What you own when you buy a share", writing: false },
      { title: "Stock market", writing: true },
      { title: "", writing: true },
    ]);

    expect(view?.chapterCount).toBe(3);
  });

  it("names no row after the goal's own course, which says nothing the goal doesn't", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [lesson(1, 0), { ...lesson(2, 0), status: "todo" }],
      phases: [phase()],
      skillAreas: getSkillAreas({
        courseTitle: "Quantum physics from scratch",
        skills: [
          { area: "Quantum physics from scratch", skillId: "skill-1" },
          { area: "Statistics", skillId: "skill-2" },
        ],
      }),
      upNextItemId: null,
    });

    expect(view?.chapters.map(({ title, writing }) => ({ title, writing }))).toStrictEqual([
      { title: "", writing: true },
      { title: "Statistics", writing: true },
    ]);
  });

  it("marks a later phase's rows that go deeper into an earlier phase's topics", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map([
        ["ch-powers", "Powers of ten"],
        ["ch-spin", "Spin"],
      ]),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        { ...chapterLesson(0, "ch-powers", "todo"), skillId: "skill-powers" },
        { ...chapterLesson(1, "ch-spin", "todo"), phase: 1, skillId: "skill-spin" },
        { ...chapterLesson(2, "ch-powers", "todo"), phase: 1, skillId: "skill-powers" },
      ],
      phases: [phase({ name: "The math physics uses" }), phase({ name: "Advanced" })],
      skillAreas: new Map(),
      skillPhases: new Map([
        ["skill-powers", 0],
        ["skill-spin", 1],
      ]),
      upNextItemId: null,
    });

    expect(
      views.map((view) => view.chapters.map(({ deeper, title }) => ({ deeper, title }))),
    ).toStrictEqual([
      [{ deeper: false, title: "Powers of ten" }],
      [
        { deeper: false, title: "Spin" },
        { deeper: true, title: "Powers of ten" },
      ],
    ]);
  });

  it("lists every phase's chapters, with a current one only in the current phase", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map([
        ["a", "Percentages"],
        ["b", "Circuits"],
        ["c", "Ecology"],
        ["d", "Functions"],
      ]),
      currentPhase: 1,
      goalKind: "learn",
      items: [
        chapterLesson(0, "a", "done"),
        { ...chapterLesson(1, "b", "todo"), phase: 1 },
        { ...chapterLesson(2, "c", "todo"), phase: 1 },
        { ...chapterLesson(3, "d", "todo"), phase: 2 },
      ],
      phases: [phase(), phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: "item-1",
    });

    expect(
      views.map((view) => view.chapters.map((chapter) => [chapter.title, chapter.state])),
    ).toStrictEqual([
      [["Percentages", "done"]],
      [
        ["Circuits", "current"],
        ["Ecology", "upcoming"],
      ],
      [["Functions", "upcoming"]],
    ]);
  });

  it("marks the chapter of the lesson Today opens next, even in the next phase", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map([
        ["a", "The shareholder's voice"],
        ["b", "Where prices come from"],
      ]),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        chapterLesson(0, "a", "done"),
        chapterLesson(1, "a", "todo"),
        { ...chapterLesson(2, "b", "todo"), phase: 1 },
      ],
      phases: [phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: "item-2",
    });

    expect(
      views.map((view) => [
        view.state,
        view.chapters.map((chapter) => [chapter.title, chapter.state]),
      ]),
    ).toStrictEqual([
      ["current", [["The shareholder's voice", "upcoming"]]],
      ["upcoming", [["Where prices come from", "current"]]],
    ]);
  });

  it("closes each phase with its checkpoint, done once passed", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 1,
      goalKind: "learn",
      items: [lesson(0, 0), boss(1, 0, "done"), lesson(2, 1), boss(3, 1, "todo"), lesson(4, 2)],
      phases: [phase(), phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: null,
    });

    expect(views.map((view) => view.checkpoint)).toStrictEqual([
      { date: "2026-10-16", locked: false, planItemId: "item-1", state: "done", when: "date" },
      { date: "2026-10-16", locked: false, planItemId: "item-3", state: "upcoming", when: "date" },
      null,
    ]);
  });
});

const done = (item: ExistingPlanItem): ExistingPlanItem => ({ ...item, status: "done" });

function challengeTimings({ days, today }: { days: string[]; today: Date }) {
  return buildPhaseViews({
    chapterTitles: new Map(),
    currentPhase: 0,
    goalKind: "learn",
    items: days.flatMap((day, index) => [
      done(lesson(index * 2, index)),
      boss(index * 2 + 1, index, "todo", day),
    ]),
    phases: days.map(() => phase()),
    skillAreas: new Map(),
    today,
    upNextItemId: null,
  }).map((phaseView) => phaseView.checkpoint?.when);
}

describe("phases of a finished plan", () => {
  const TODAY = new Date("2026-10-13T00:00:00.000Z");

  it("leaves out a lesson the Library couldn't write in a plan without a date", () => {
    const unwritten: ExistingPlanItem = { ...lesson(1, 0), status: "skipped" };
    const items = [done(lesson(0, 0)), unwritten, boss(2, 0, "done"), done(lesson(3, 1))];

    const view = (targetDate: Date | null) =>
      buildPhaseViews({
        chapterTitles: new Map(),
        currentPhase: 1,
        goalKind: "learn",
        items,
        phases: [phase(), phase()],
        skillAreas: new Map(),
        targetDate,
        today: TODAY,
        upNextItemId: null,
      }).map((phaseView) => [phaseView.state, phaseView.lessonsDone, phaseView.lessonsTotal]);

    expect(view(null)).toStrictEqual([
      ["done", 1, 1],
      ["done", 1, 1],
    ]);

    expect(view(new Date("2026-10-20T00:00:00.000Z"))).toStrictEqual([
      ["unfinished", 1, 2],
      ["done", 1, 1],
    ]);
  });

  it("isn't current over a review the plan's date left behind", () => {
    const review = { ...lesson(2, 1), kind: "review" as const, scheduledFor: TODAY, skillId: null };
    const pastReview = { ...review, scheduledFor: new Date("2026-10-11T00:00:00.000Z") };

    const states = (items: ExistingPlanItem[]) =>
      buildPhaseViews({
        chapterTitles: new Map(),
        currentPhase: 1,
        goalKind: "exam",
        items,
        phases: [phase(), phase()],
        skillAreas: new Map(),
        targetDate: new Date("2026-10-12T00:00:00.000Z"),
        today: TODAY,
        upNextItemId: null,
      }).map((phaseView) => phaseView.state);

    expect(states([done(lesson(0, 0)), done(lesson(1, 1)), pastReview])).toStrictEqual([
      "done",
      "done",
    ]);

    expect(states([done(lesson(0, 0)), done(lesson(1, 1)), review])).toStrictEqual([
      "done",
      "current",
    ]);
  });

  it("says the next challenge opens in the next session only where sessions offer it", () => {
    const items = [
      done(lesson(0, 0)),
      boss(1, 0, "todo", "2026-10-13"),
      lesson(2, 1),
      boss(3, 1, "todo"),
    ];

    const when = (challengesOpen: boolean) =>
      buildPhaseViews({
        challengesOpen,
        chapterTitles: new Map(),
        currentPhase: 0,
        goalKind: "learn",
        items,
        phases: [phase(), phase()],
        skillAreas: new Map(),
        today: TODAY,
        upNextItemId: null,
      }).map((phaseView) => phaseView.checkpoint?.when);

    expect(when(true)).toStrictEqual(["nextSession", "date"]);
    expect(when(false)).toStrictEqual(["date", "date"]);
  });

  it("says when each challenge comes, as sessions offer them", () => {
    const days = ["2026-10-16", "2026-10-18", "2026-10-21"];

    expect(challengeTimings({ days, today: TODAY })).toStrictEqual(["date", "date", "date"]);

    expect(challengeTimings({ days, today: new Date("2026-10-16T00:00:00.000Z") })).toStrictEqual([
      "nextSession",
      "date",
      "date",
    ]);

    expect(challengeTimings({ days, today: new Date("2026-10-18T00:00:00.000Z") })).toStrictEqual([
      "nextSession",
      "nextSession",
      "date",
    ]);

    expect(challengeTimings({ days, today: new Date("2026-10-25T00:00:00.000Z") })).toStrictEqual([
      "nextSession",
      "nextSession",
      "nextSession",
    ]);
  });

  it("names the challenge sessions reach, after lessons the Library couldn't write", () => {
    const unwritten: ExistingPlanItem = { ...lesson(0, 0), status: "skipped" };

    const items = [
      unwritten,
      boss(1, 0, "todo", "2026-10-13"),
      done(lesson(2, 1)),
      boss(3, 1, "todo"),
    ];

    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items,
      phases: [phase(), phase()],
      skillAreas: new Map(),
      today: TODAY,
      upNextItemId: null,
    });

    expect(views.map((phaseView) => phaseView.checkpoint?.when)).toStrictEqual([
      "nextSession",
      "date",
    ]);

    expect(views.map((view) => [view.checkpoint?.planItemId, view.checkpoint?.date])).toStrictEqual(
      [
        ["item-1", "2026-10-13"],
        ["item-3", "2026-10-16"],
      ],
    );
  });
});

function setAsideLesson(position: number, chapterId: string): ExistingPlanItem {
  return { ...chapterLesson(position, chapterId, "todo"), status: "skipped" };
}

function testedOutLesson(position: number): ExistingPlanItem {
  return { ...chapterLesson(position, "ch-known", "todo"), status: "testedOut" };
}

function nextPhaseLesson(position: number): ExistingPlanItem {
  return { ...chapterLesson(position, "ch-next", "todo"), phase: 1 };
}

describe("a phase the plan moved past before the learner finished it", () => {
  const examDate = new Date("2026-12-01T00:00:00.000Z");

  it("stays unfinished, saying the lessons studied of the ones the plan gave it", () => {
    const items = [
      chapterLesson(0, "ch-a", "done"),
      setAsideLesson(1, "ch-a"),
      setAsideLesson(2, "ch-b"),
      testedOutLesson(3),
      nextPhaseLesson(4),
    ];

    const views = buildPhaseViews({
      chapterTitles: new Map([
        ["ch-a", "Spelling"],
        ["ch-b", "Agreement"],
        ["ch-known", "Punctuation"],
        ["ch-next", "Laws"],
      ]),
      currentPhase: findCurrentPhase({ items, phaseCount: 2 }),
      goalKind: "learn",
      items,
      phases: [phase(), phase()],
      skillAreas: new Map(),
      targetDate: examDate,
      upNextItemId: "item-4",
    });

    expect(
      views.map(({ lessonsDone, lessonsTotal, state }) => ({ lessonsDone, lessonsTotal, state })),
    ).toStrictEqual([
      { lessonsDone: 1, lessonsTotal: 3, state: "unfinished" },
      { lessonsDone: 0, lessonsTotal: 1, state: "current" },
    ]);

    expect(views[0]?.chapters.map(({ state, title }) => [title, state])).toStrictEqual([
      ["Spelling", "upcoming"],
      ["Agreement", "upcoming"],
      ["Punctuation", "done"],
    ]);
  });

  it("is done once every lesson was studied or tested out", () => {
    const items = [chapterLesson(0, "ch-a", "done"), testedOutLesson(1), nextPhaseLesson(2)];

    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: findCurrentPhase({ items, phaseCount: 2 }),
      goalKind: "learn",
      items,
      phases: [phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: "item-2",
    });

    expect(views.map((view) => view.state)).toStrictEqual(["done", "current"]);
  });

  it("names only the topics tested out as known, not the ones set aside", () => {
    const items = [
      { ...lesson(0, 0), status: "testedOut" as const, titleSnapshot: "Read a chart" },
      { ...lesson(1, 0), status: "skipped" as const, titleSnapshot: "Compare two means" },
      nextPhaseLesson(2),
    ];

    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: findCurrentPhase({ items, phaseCount: 2 }),
      goalKind: "learn",
      items,
      phases: [phase(), phase()],
      skillAreas: new Map([
        ["skill-0", "Statistics"],
        ["skill-1", "Statistics"],
      ]),
      targetDate: examDate,
      upNextItemId: "item-2",
    });

    expect(
      view?.chapters.map(({ skills, state, writing }) => ({ skills, state, writing })),
    ).toStrictEqual([
      { skills: ["Read a chart"], state: "done", writing: false },
      { skills: [], state: "upcoming", writing: false },
    ]);
  });
});

describe("a phase's topics not written yet", () => {
  it("say the lessons the plan teaches them, when they start and the topic to ask for them by", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        { ...standIn(0, "2027-03-08"), lessons: 3 },
        { ...standIn(1, "2027-03-02"), lessons: 1 },
      ],
      outlinedUntil: "2027-03-01",
      phases: [phase()],
      skillAreas: new Map([
        ["skill-0", "Statistics"],
        ["skill-1", "Statistics"],
      ]),
      upNextItemId: "item-0",
    });

    expect(view?.chapters).toStrictEqual([
      {
        chapterId: null,
        deeper: false,
        far: true,
        lessonsDone: 0,
        lessonsTotal: 4,
        nextDate: "2027-03-02",
        plannedLessons: 4,
        skillId: "skill-0",
        skills: [],
        state: "current",
        testedOut: false,
        title: "Statistics",
        writing: true,
      },
    ]);
  });

  it("say no count for topics of a plan saved before it stored how many lessons it teaches them", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [{ ...standIn(0, "2027-03-08"), lessons: 3 }, standIn(1, "2027-03-02")],
      outlinedUntil: "2027-03-01",
      phases: [phase()],
      skillAreas: new Map([
        ["skill-0", "Statistics"],
        ["skill-1", "Statistics"],
      ]),
      upNextItemId: null,
    });

    expect(
      view?.chapters.map((chapter) => [chapter.writing, chapter.plannedLessons]),
    ).toStrictEqual([[true, null]]);
  });

  it("leave one within the two weeks the plan writes ahead to the plan: its lessons are on the way", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [standIn(0, "2027-03-01")],
      outlinedUntil: "2027-03-01",
      phases: [phase()],
      skillAreas: new Map([["skill-0", "Statistics"]]),
      upNextItemId: null,
    });

    expect(
      view?.chapters.map((chapter) => [chapter.writing, chapter.far, chapter.skillId]),
    ).toStrictEqual([[true, false, null]]);
  });

  it("opens a far topic chapters already teach, so its outline lists them, and still say what the plan knows about it", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [{ ...standIn(0, "2027-03-08"), lessons: 3 }],
      outlinedUntil: "2027-03-01",
      phases: [phase()],
      skillAreas: new Map([["skill-0", "Statistics"]]),
      taughtSkillIds: new Set(["skill-0"]),
      upNextItemId: null,
    });

    expect(
      view?.chapters.map(({ far, plannedLessons, skillId }) => ({ far, plannedLessons, skillId })),
    ).toStrictEqual([{ far: true, plannedLessons: 3, skillId: "skill-0" }]);
  });

  it("offer the row's first topic no chapter teaches yet", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      goalKind: "learn",
      items: [
        { ...standIn(0, "2027-03-08"), lessons: 3 },
        { ...standIn(1, "2027-03-12"), lessons: 2 },
      ],
      outlinedUntil: "2027-03-01",
      phases: [phase()],
      skillAreas: new Map([
        ["skill-0", "Statistics"],
        ["skill-1", "Statistics"],
      ]),
      taughtSkillIds: new Set(["skill-0"]),
      upNextItemId: null,
    });

    expect(view?.chapters.map((chapter) => chapter.skillId)).toStrictEqual(["skill-1"]);
  });
});

describe("a phase's mock exams", () => {
  it("counts them and says when the next one still to take is", () => {
    const mock = (position: number, day: string, status: "done" | "todo") => ({
      ...lesson(position, 1),
      kind: "mock" as const,
      scheduledFor: new Date(`${day}T00:00:00.000Z`),
      skillId: null,
      status,
    });

    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 1,
      goalKind: "learn",
      items: [
        lesson(0, 0),
        mock(1, "2026-11-02", "done"),
        mock(2, "2026-11-16", "todo"),
        mock(3, "2026-11-09", "todo"),
      ],
      phases: [phase(), phase()],
      skillAreas: new Map(),
      upNextItemId: null,
    });

    expect(views.map((view) => view.mocks)).toStrictEqual([
      { count: 0, nextDate: null },
      { count: 3, nextDate: "2026-11-09" },
    ]);
  });
});

describe(findCurrentPhase, () => {
  it("stays at a phase whose stand-in still waits for its lessons, though written ones come after", () => {
    const items = [
      { ...lesson(0, 0), lessonId: "done", status: "done" as const },
      lesson(1, 0),
      { ...lesson(2, 1), lessonId: "written" },
    ];

    expect(findCurrentPhase({ items, phaseCount: 2 })).toBe(0);
  });

  it("is the earliest phase with work left, though a later phase's lesson comes first", () => {
    const checkpoint = { ...lesson(3, 0), kind: "boss" as const, skillId: null };

    const items = [
      { ...lesson(0, 0), lessonId: "done", status: "done" as const },
      { ...lesson(1, 1), lessonId: "ahead" },
      { ...lesson(2, 0), lessonId: "left" },
      checkpoint,
      { ...lesson(4, 1), lessonId: "next" },
    ];

    expect(findCurrentPhase({ items, phaseCount: 2 })).toBe(0);
  });

  it("is at a phase's checkpoint once its lessons are done, before the next phase's lessons", () => {
    const checkpoint = { ...lesson(1, 0), kind: "boss" as const, skillId: null };
    const items = [{ ...lesson(0, 0), lessonId: "done", status: "done" as const }, checkpoint];

    expect(
      findCurrentPhase({ items: [...items, { ...lesson(2, 1), lessonId: "w" }], phaseCount: 2 }),
    ).toBe(0);
  });
});
