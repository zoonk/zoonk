import { describe, expect, it } from "vitest";
import {
  checkDayBeforeTest,
  checkDayOneHasSession,
  checkDayOneOpensWithGaps,
  checkMocksInEveryPhase,
  checkPhasesInOrder,
  checkRestDaysRest,
} from "./day-rules";
import {
  ruleContext,
  ruleDay,
  ruleEventItem,
  ruleLesson,
  rulePhase,
  rulePhaseDatesProposal,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Linguística", skillId: "texto" }),
  ruleSkill({ area: "TI", skillId: "redes" }),
];

const created = { kind: "planCreated" } as const;

describe("R20 day one always has a session", () => {
  it("passes when the first day has a lesson", () => {
    const after = rulePlan({ items: [ruleLesson({ day: 0, skillId: "texto" })], skills });
    expect(checkDayOneHasSession(ruleContext({ after, event: created }))).toStrictEqual([]);
  });

  it("flags a first day with nothing to do", () => {
    const after = rulePlan({ items: [ruleLesson({ day: 1, skillId: "texto" })], skills });
    expect(checkDayOneHasSession(ruleContext({ after, event: created }))).toHaveLength(1);
  });
});

/**
 * Today's proposal to move the end of a phase from Sunday (day 6) to Monday, saying the challenge
 * rests there when `restDay`.
 */
function moveEnd(status: "declined" | "proposed", restDay = true) {
  return rulePhaseDatesProposal({
    effect: {
      phaseEnds: [
        {
          after: "2026-10-19",
          before: "2026-10-18",
          name: "learn",
          ...(restDay && { restDay: true as const }),
        },
      ],
    },
    status,
  });
}

describe("R21 rest days rest", () => {
  // Day 6 is a Sunday: the learner rests on Sundays.
  const settings = { weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] };

  it("passes when nothing is due on Sunday, or a moved event is", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 5, skillId: "texto" }), ruleEventItem({ day: 6, kind: "mock" })],
      settings: { ...settings, movedEvents: [{ from: "2026-10-17", to: "2026-10-18" }] },
      skills,
    });

    expect(checkRestDaysRest(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a mock on a rest day", () => {
    const after = rulePlan({ items: [ruleEventItem({ day: 6, kind: "mock" })], settings, skills });

    expect(checkRestDaysRest(ruleContext({ after }))).toMatchObject([
      { details: { kind: "mock" }, rule: "R21" },
    ]);
  });

  describe("a phase's challenge held on its shown end", () => {
    // The phase the learner saw ends on Sunday, now a rest day: its challenge stays there, and
    // Today asks to move the dates (a system run never moves a shown end).
    const after = rulePlan({
      items: [ruleEventItem({ day: 6, kind: "boss" }), ruleLesson({ day: 6, skillId: "texto" })],
      phases: [rulePhase({ end: 6, start: 0 })],
      settings,
      skills,
    });

    it("passes it while the proposal to move that end waits, or after the learner kept their dates, but not the lesson that day", () => {
      const lesson = [{ details: { kind: "lesson" }, rule: "R21" }];

      expect(
        checkRestDaysRest(ruleContext({ after, waiting: [moveEnd("proposed")] })),
      ).toMatchObject(lesson);

      expect(
        checkRestDaysRest(ruleContext({ after, declined: [moveEnd("declined")] })),
      ).toMatchObject(lesson);
    });

    it("flags it after Keep mine on a card that didn't say it rests there", () => {
      expect(
        checkRestDaysRest(ruleContext({ after, declined: [moveEnd("declined", false)] })),
      ).toMatchObject([
        { details: { kind: "boss" }, rule: "R21" },
        { details: { kind: "lesson" }, rule: "R21" },
      ]);
    });

    it("flags it when nothing offers to move that end", () => {
      expect(checkRestDaysRest(ruleContext({ after }))).toMatchObject([
        { details: { kind: "boss" }, rule: "R21" },
        { details: { kind: "lesson" }, rule: "R21" },
      ]);
    });
  });
});

describe("R22 day one opens with what the learner doesn't know", () => {
  const learner = { gapAreas: ["TI"], knownAreas: ["Linguística"] };

  it("passes when the gap opens day one", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "redes" }), ruleLesson({ day: 0, skillId: "texto" })],
      skills,
    });

    expect(checkDayOneOpensWithGaps(ruleContext({ after, event: created, learner }))).toStrictEqual(
      [],
    );
  });

  it("passes when an area beyond the notice comes after a known one", () => {
    const notice = [
      ruleSkill({ area: "Linguística", skillId: "texto", topics: ["Interpretação"] }),
      ruleSkill({ area: "TI", skillId: "redes", topics: ["Redes"] }),
      ruleSkill({ area: "Estratégia", skillId: "prova" }),
    ];

    const after = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "redes" }),
        ruleLesson({ day: 0, skillId: "texto" }),
        ruleLesson({ day: 0, skillId: "prova" }),
      ],
      skills: notice,
    });

    expect(checkDayOneOpensWithGaps(ruleContext({ after, event: created, learner }))).toStrictEqual(
      [],
    );
  });

  it("flags a day one without the weak area (Rafaela's TI)", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "texto" }), ruleLesson({ day: 3, skillId: "redes" })],
      skills,
    });

    expect(checkDayOneOpensWithGaps(ruleContext({ after, event: created, learner }))).toMatchObject(
      [{ details: { first: "Linguística" }, rule: "R22" }],
    );
  });
});

function classTest(items: ReturnType<typeof ruleLesson>[]) {
  return rulePlan({
    goal: { kind: "exam", targetDate: ruleDay(4) },
    items,
    settings: { shortMockMinutes: 20 },
    skills,
  });
}

describe("R23 the day before a test is a review", () => {
  it("passes when a class test's day before is its mock and review", () => {
    const after = classTest([
      ruleLesson({ day: 0, skillId: "texto" }),
      ruleEventItem({ day: 3, kind: "mock" }),
      ruleEventItem({ day: 3, kind: "review" }),
    ]);

    expect(checkDayBeforeTest(ruleContext({ after }))).toStrictEqual([]);
  });

  it("passes the lessons earlier days left on it once the day comes, offered after the review", () => {
    const after = classTest([
      ruleLesson({ day: 3, lessonId: "texto-1", skillId: "texto" }),
      ruleEventItem({ day: 3, kind: "review" }),
    ]);

    expect(checkDayBeforeTest(ruleContext({ after, today: ruleDay(3) }))).toStrictEqual([]);
  });

  it("flags lessons on the day before and no review (Pedro)", () => {
    const after = classTest([ruleLesson({ day: 3, skillId: "texto" })]);

    expect(checkDayBeforeTest(ruleContext({ after }))).toMatchObject([
      { details: { lessons: ["texto lesson"] }, rule: "R23" },
      { details: { review: false }, rule: "R23" },
    ]);
  });
});

const soon = (items: ReturnType<typeof ruleLesson>[]) =>
  rulePlan({ goal: { kind: "exam", targetDate: ruleDay(4) }, items, skills });

describe("R24 every exam phase has mocks", () => {
  const phases = [
    rulePhase({ end: 13, kind: "foundations", start: 0 }),
    rulePhase({ end: 27, kind: "practice", start: 14 }),
    rulePhase({ end: 29, kind: "finalStretch", start: 28 }),
  ];

  const exam = (items: ReturnType<typeof ruleLesson>[]) =>
    rulePlan({ goal: { kind: "exam", targetDate: ruleDay(30) }, items, phases, skills });

  it("passes when each two-week phase has a mock and a short phase relies on anytime mocks", () => {
    const after = exam([
      ruleEventItem({ day: 13, kind: "mock" }),
      ruleEventItem({ day: 20, kind: "mock" }),
    ]);

    expect(checkMocksInEveryPhase(ruleContext({ after }))).toStrictEqual([]);
  });

  it("leaves the phase after the exam out", () => {
    const after = rulePlan({
      goal: { kind: "exam", targetDate: ruleDay(30) },
      items: [ruleEventItem({ day: 13, kind: "mock" }), ruleEventItem({ day: 20, kind: "mock" })],
      phases: [...phases, rulePhase({ end: 60, kind: "afterExam", start: 31 })],
      skills,
    });

    expect(checkMocksInEveryPhase(ruleContext({ after }))).toStrictEqual([]);
  });

  it("leaves the plan alone from the exam's day on, when a mock not taken may leave", () => {
    const after = exam([ruleEventItem({ day: 13, kind: "mock" })]);

    expect(checkMocksInEveryPhase(ruleContext({ after, today: ruleDay(30) }))).toStrictEqual([]);
  });

  it("flags a two-week phase without a mock", () => {
    const after = exam([ruleEventItem({ day: 13, kind: "mock" })]);

    expect(checkMocksInEveryPhase(ruleContext({ after }))).toMatchObject([
      { details: { kind: "practice" }, rule: "R24" },
    ]);
  });

  it("leaves a phase that ended before today alone, once the learner missed its mock", () => {
    const after = exam([ruleEventItem({ day: 20, kind: "mock" })]);

    expect(checkMocksInEveryPhase(ruleContext({ after, today: ruleDay(16) }))).toStrictEqual([]);
  });

  it("flags a phase with days left and no mock, its own mock missed", () => {
    const after = exam([
      ruleEventItem({ day: 13, kind: "mock" }),
      ruleEventItem({ day: 28, kind: "mock" }),
    ]);

    expect(checkMocksInEveryPhase(ruleContext({ after, today: ruleDay(21) }))).toMatchObject([
      { details: { kind: "practice" }, rule: "R24" },
    ]);
  });

  it("passes when an exam four days away has its own mock", () => {
    const after = soon([
      ruleLesson({ day: 0, skillId: "texto" }),
      ruleEventItem({ day: 1, kind: "mock" }),
    ]);

    expect(checkMocksInEveryPhase(ruleContext({ after }))).toStrictEqual([]);
  });

  it("rests once fewer than three study days are left, the mock the learner missed gone (ENEM seed 2060)", () => {
    // The plan started on day 0 and held a mock on day 1, which the learner missed; on day 2 two
    // study days are left, too few to place another, and anytime mocks remain.
    const after = rulePlan({
      goal: { kind: "exam", targetDate: ruleDay(4) },
      items: [ruleLesson({ day: 2, skillId: "texto" })],
      settings: { startDate: ruleDay(0).toISOString().slice(0, 10) },
      skills,
    });

    expect(checkMocksInEveryPhase(ruleContext({ after, today: ruleDay(2) }))).toStrictEqual([]);

    expect(checkMocksInEveryPhase(ruleContext({ after, today: ruleDay(1) }))).toMatchObject([
      { details: { studyDays: 3 }, rule: "R24" },
    ]);
  });

  it("flags an exam with three study days or more and no mock before it", () => {
    const after = soon([ruleLesson({ day: 0, skillId: "texto" })]);

    expect(checkMocksInEveryPhase(ruleContext({ after }))).toMatchObject([
      { details: { studyDays: 4 }, rule: "R24" },
    ]);
  });
});

/** Three phases of one lesson each; the third finished or still to do. */
function threePhases({
  third,
}: {
  third: { end: number; start: number; status: "testedOut" | "todo" };
}) {
  return rulePlan({
    items: [
      ruleLesson({ day: 0, phase: 0, skillId: "texto" }),
      ruleLesson({ day: 6, phase: 1, skillId: "redes" }),
      ruleLesson({ day: third.start, phase: 2, skillId: "texto", status: third.status }),
    ],
    phases: [
      rulePhase({ end: 5, start: 0 }),
      rulePhase({ end: 10, start: 6 }),
      rulePhase({ end: third.end, start: third.start }),
    ],
    skills,
  });
}

describe("R39 phases keep their order", () => {
  it("passes phases in order, and a finished phase on the days it was finished", () => {
    const inOrder = threePhases({ third: { end: 15, start: 11, status: "todo" } });
    const finishedEarly = threePhases({ third: { end: 2, start: 2, status: "testedOut" } });

    expect(checkPhasesInOrder(ruleContext({ after: inOrder }))).toStrictEqual([]);
    expect(checkPhasesInOrder(ruleContext({ after: finishedEarly }))).toStrictEqual([]);
  });

  it("flags a phase still to do that ends before the one before it", () => {
    const outOfOrder = threePhases({ third: { end: 4, start: 3, status: "todo" } });

    expect(checkPhasesInOrder(ruleContext({ after: outOfOrder }))).toMatchObject([
      { details: { phase: { index: 2 }, previous: { index: 1 } }, rule: "R39" },
    ]);
  });
});
