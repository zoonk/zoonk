import { describe, expect, it } from "vitest";
import {
  checkDayOneHasSession,
  checkDayOneOpensWithGaps,
  checkMocksInEveryPhase,
} from "./day-rules";
import {
  ruleContext,
  ruleDay,
  ruleEventItem,
  ruleLesson,
  rulePhase,
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
