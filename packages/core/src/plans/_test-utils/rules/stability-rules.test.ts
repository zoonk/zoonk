import { describe, expect, it } from "vitest";
import { type RuleEvent } from "./rule-context";
import {
  ruleChange,
  ruleContext,
  ruleLesson,
  rulePhase,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";
import {
  checkChangesSaid,
  checkPhaseEndsKept,
  checkRefreshChangesNothing,
  checkTodayKept,
  checkUndoRestores,
} from "./stability-rules";

const skills = [
  ruleSkill({ area: "Natureza", skillId: "ecologia", topics: ["Ecologia"] }),
  ruleSkill({ area: "Natureza", skillId: "ondas", topics: ["Ondas"] }),
];

const withEcologia = rulePlan({
  items: [ruleLesson({ day: 0, skillId: "ondas" }), ruleLesson({ day: 1, skillId: "ecologia" })],
  skills,
});

const withoutEcologia = rulePlan({ items: [ruleLesson({ day: 0, skillId: "ondas" })], skills });

describe("R5 every change is recorded and said", () => {
  it("flags a topic whose only lesson a missed day set aside for time, unless a change names it", () => {
    const setAside = rulePlan({
      items: [
        ruleLesson({ day: 1, skillId: "ondas" }),
        ruleLesson({ day: null, lessonId: "ecologia-1", skillId: "ecologia", status: "skipped" }),
      ],
      skills,
    });

    const change = ruleChange({
      effect: { topicsLeftOut: [{ area: "Natureza", topics: ["Ecologia"] }] },
      kind: "missedDays",
      source: "system",
    });

    const context = {
      after: setAside,
      before: withEcologia,
      event: { kind: "newDay", studied: false },
    } as const;

    expect(checkChangesSaid(ruleContext(context))).toMatchObject([{ rule: "R5" }]);

    expect(checkChangesSaid(ruleContext({ ...context, changes: [change] }))).toStrictEqual([]);
  });

  it("passes when a right answer settles a topic out for time: its tested-out stand-in didn't bring it in", () => {
    const settled = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "ondas" }),
        ruleLesson({ day: null, skillId: "ecologia", status: "testedOut" }),
      ],
      skills,
    });

    expect(
      checkChangesSaid(
        ruleContext({ after: settled, before: withoutEcologia, event: { kind: "session" } }),
      ),
    ).toStrictEqual([]);
  });

  it("leaves the editor's Undo of the latest edit to the undo's checks, as an undo", () => {
    const setBack: RuleEvent = {
      kind: "learnerChange",
      operations: [{ choices: [{ choice: "quick", skillId: "ecologia" }], kind: "setBaseChoices" }],
      setBack: true,
    };

    expect(
      checkChangesSaid(
        ruleContext({ after: withoutEcologia, before: withEcologia, event: setBack }),
      ),
    ).toStrictEqual([]);
  });

  it("flags a topic that leaves the plan silently (Lucas's ecology topic)", () => {
    expect(
      checkChangesSaid(ruleContext({ after: withoutEcologia, before: withEcologia })),
    ).toMatchObject([{ details: { topics: ["Natureza|ecologia"] }, rule: "R5" }]);
  });

  it("flags a missed day's change that says the plan covers less without naming the topic", () => {
    const change = ruleChange({
      behind: {
        canFocus: false,
        coveredAfter: 0.5,
        coveredBefore: 0.6,
        currentMinutes: 30,
        dailyMinutes: 45,
        fittingDate: null,
        fullDepth: true,
        maximumShare: null,
        measure: "exam",
      },
      effect: {},
      kind: "missedDays",
      source: "system",
    });

    expect(
      checkChangesSaid(
        ruleContext({
          after: withoutEcologia,
          before: withEcologia,
          changes: [change],
          event: { kind: "newDay", studied: false },
        }),
      ),
    ).toMatchObject([{ details: { topics: ["Natureza|ecologia"] }, rule: "R5" }]);
  });

  it("names a skill as its topic when the graph maps no topics (a career, a language)", () => {
    const careerSkills = [
      ruleSkill({ area: "Research", name: "Interviews", skillId: "interviews" }),
      ruleSkill({ area: "Research", name: "Surveys", skillId: "surveys" }),
    ];

    const before = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "interviews" }),
        ruleLesson({ day: 1, skillId: "surveys" }),
      ],
      skills: careerSkills,
    });

    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "interviews" })],
      skills: careerSkills,
    });

    const named = ruleChange({
      effect: { topicsLeftOut: [{ area: "Research", topics: ["Surveys"] }] },
      kind: "coverageChanged",
      source: "system",
    });

    const unnamed = ruleChange({ effect: {}, kind: "coverageChanged", source: "system" });

    expect(checkChangesSaid(ruleContext({ after, before, changes: [named] }))).toStrictEqual([]);

    expect(checkChangesSaid(ruleContext({ after, before, changes: [unnamed] }))).toMatchObject([
      { details: { topics: ["Research|surveys"] }, rule: "R5" },
    ]);
  });

  it("flags a topic that comes in silently after placement", () => {
    expect(
      checkChangesSaid(
        ruleContext({ after: withEcologia, before: withoutEcologia, event: { kind: "placement" } }),
      ),
    ).toHaveLength(1);
  });
});

/** A phase without dates, as one a date cuts short or whose lessons all left for time. */
function undatedPhase(end: number, start: number) {
  return { ...rulePhase({ end, start }), endDate: null, startDate: null };
}

/**
 * A plan whose phase 1 ends on `end` and whose phase 2, dated on day 4, has one lesson: tested out
 * (finished, dated on the day it was) or still to do.
 */
function finishedLater({ end, third }: { end: number; third: "testedOut" | "todo" }) {
  return rulePlan({
    items: [
      ruleLesson({ day: 0, phase: 0, skillId: "ondas", status: "done" }),
      ruleLesson({ day: 5, phase: 1, skillId: "ondas" }),
      ruleLesson({ day: 4, phase: 2, skillId: "ecologia", status: third }),
    ],
    phases: [
      rulePhase({ end: 2, start: 0 }),
      rulePhase({ end, start: 3 }),
      rulePhase({ end: 4, start: 4 }),
      undatedPhase(60, 41),
    ],
    skills,
  });
}

/**
 * A plan whose phase 2 has one lesson, done and dated `end`: planned for day 30, it was finished
 * ahead on day 5, and the phase shows the day it was finished on.
 */
function finishedAhead(end: number) {
  return rulePlan({
    items: [
      ruleLesson({ day: 1, phase: 0, skillId: "ondas" }),
      ruleLesson({ day: end, phase: 1, skillId: "ecologia", status: "done" }),
      ruleLesson({ day: 40, phase: 2, skillId: "ondas" }),
    ],
    phases: [
      rulePhase({ end: 10, start: 0 }),
      rulePhase({ end, start: end }),
      rulePhase({ end: 40, start: 31 }),
    ],
    skills,
  });
}

describe("R6 shown phase ends don't move through system changes", () => {
  const phases = [rulePhase({ end: 10, start: 0 }), rulePhase({ end: 20, start: 11 })];
  const before = rulePlan({ phases, skills });

  it("passes when a refresh keeps them, and when a missed day moves them", () => {
    const moved = rulePlan({
      phases: [rulePhase({ end: 12, start: 0 }), rulePhase({ end: 22, start: 13 })],
      skills,
    });

    expect(checkPhaseEndsKept(ruleContext({ after: before, before }))).toStrictEqual([]);

    expect(
      checkPhaseEndsKept(
        ruleContext({ after: moved, before, event: { kind: "newDay", studied: false } }),
      ),
    ).toStrictEqual([]);
  });

  it("leaves out the last phase with dates, whose end is the finish when a date cuts the plan short", () => {
    const undated = undatedPhase(30, 21);
    const later = [rulePhase({ end: 10, start: 0 }), rulePhase({ end: 21, start: 11 }), undated];

    const context = ruleContext({
      after: rulePlan({ phases: later, skills }),
      before: rulePlan({ phases: [...phases, undated], skills }),
      event: { kind: "outlinesLanded" },
    });

    expect(checkPhaseEndsKept(context)).toStrictEqual([]);
  });

  describe("when the phases after one leave for time (language seed 1011)", () => {
    const fourPhases = rulePlan({
      items: [0, 1, 2, 3].map((phase) => ruleLesson({ day: phase * 10, phase, skillId: "ondas" })),
      phases: [
        rulePhase({ end: 10, start: 0 }),
        rulePhase({ end: 20, start: 11 }),
        rulePhase({ end: 30, start: 21 }),
        rulePhase({ end: 40, start: 31 }),
      ],
      skills,
    });

    const items = [0, 1].map((phase) => ruleLesson({ day: phase * 10, phase, skillId: "ondas" }));
    const lastTwoLeft = [rulePhase({ end: 10, start: 0 }), rulePhase({ end: 22, start: 11 })];

    it("leaves out the phase that becomes the last, whose end becomes the finish", () => {
      const after = rulePlan({
        items,
        phases: [...lastTwoLeft, undatedPhase(30, 21), undatedPhase(40, 31)],
        skills,
      });

      expect(
        checkPhaseEndsKept(ruleContext({ after, before: fourPhases, event: { kind: "session" } })),
      ).toStrictEqual([]);
    });

    it("flags a phase that lost its dates while it still has a lesson to do", () => {
      const after = rulePlan({
        items: [...items, ruleLesson({ day: null, phase: 2, skillId: "ondas" })],
        phases: [...lastTwoLeft, undatedPhase(30, 21), undatedPhase(40, 31)],
        skills,
      });

      expect(
        checkPhaseEndsKept(ruleContext({ after, before: fourPhases, event: { kind: "session" } })),
      ).toMatchObject([{ details: { after: null, phase: 2 }, rule: "R6" }]);
    });
  });

  describe("when a later phase is finished, dated on the day it was (language seed 2011)", () => {
    it("leaves out the last phase with work, whose end is the finish", () => {
      const context = ruleContext({
        after: finishedLater({ end: 31, third: "testedOut" }),
        before: finishedLater({ end: 30, third: "testedOut" }),
        event: { kind: "session" },
      });

      expect(checkPhaseEndsKept(context)).toStrictEqual([]);
    });

    it("flags its end when the later phase still has work", () => {
      const context = ruleContext({
        after: finishedLater({ end: 31, third: "todo" }),
        before: finishedLater({ end: 30, third: "todo" }),
        event: { kind: "session" },
      });

      expect(checkPhaseEndsKept(context)).toMatchObject([{ details: { phase: 1 }, rule: "R6" }]);
    });
  });

  it("leaves out a phase the learner finished ahead, which shows the days it was finished on (language seed 1083)", () => {
    expect(
      checkPhaseEndsKept(
        ruleContext({
          after: finishedAhead(5),
          before: finishedAhead(30),
          event: { kind: "newDay", studied: true },
        }),
      ),
    ).toStrictEqual([]);
  });

  it("flags a phase end a studied day moved (Carla's 29 to 30 Oct)", () => {
    const moved = rulePlan({
      phases: [rulePhase({ end: 11, start: 0 }), rulePhase({ end: 20, start: 12 })],
      skills,
    });

    expect(
      checkPhaseEndsKept(
        ruleContext({ after: moved, before, event: { kind: "newDay", studied: true } }),
      ),
    ).toMatchObject([{ details: { phase: 0 }, rule: "R6" }]);
  });
});

describe("R7 today's session doesn't change under the learner", () => {
  const before = rulePlan({
    items: [
      ruleLesson({ day: 0, lessonId: "a", skillId: "ondas" }),
      ruleLesson({ day: 0, lessonId: null, skillId: "ecologia" }),
    ],
    skills,
  });

  it("passes when landed lessons take their stand-in's place", () => {
    const after = rulePlan({
      items: [
        ruleLesson({ day: 0, lessonId: "a", skillId: "ondas" }),
        ruleLesson({ day: 0, lessonId: "e1", skillId: "ecologia" }),
        ruleLesson({ day: 0, lessonId: "e2", skillId: "ecologia" }),
      ],
      skills,
    });

    expect(
      checkTodayKept(
        ruleContext({ after, before, event: { kind: "outlinesLanded" }, todayShown: true }),
      ),
    ).toStrictEqual([]);
  });

  it("flags a lesson a refresh took out of today", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, lessonId: null, skillId: "ecologia" })],
      skills,
    });

    expect(checkTodayKept(ruleContext({ after, before, todayShown: true }))).toMatchObject([
      { details: { lost: ["lesson:a"] }, rule: "R7" },
    ]);
  });
});

describe("R32 a run with nothing new changes nothing", () => {
  it("passes when opening the app again leaves the plan as it was", () => {
    expect(
      checkRefreshChangesNothing(ruleContext({ after: withEcologia, before: withEcologia })),
    ).toStrictEqual([]);
  });

  it("flags a refresh that moved a lesson to another day", () => {
    const moved = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "ondas" }),
        ruleLesson({ day: 2, lessonId: "ecologia-1", skillId: "ecologia" }),
      ],
      skills,
    });

    expect(
      checkRefreshChangesNothing(ruleContext({ after: moved, before: withEcologia })),
    ).toMatchObject([{ details: { added: 0, lost: 0, movedCount: 1 }, rule: "R32" }]);
  });

  it("counts an item the refresh dropped as lost, not a moved one", () => {
    expect(
      checkRefreshChangesNothing(ruleContext({ after: withoutEcologia, before: withEcologia })),
    ).toMatchObject([{ details: { added: 0, lost: 1, movedCount: 0 }, rule: "R32" }]);
  });

  it("leaves out the first run to see what the learner finished since the plan was planned (class test seed 1113)", () => {
    // A partial session plans nothing, so the next open's run is the first to adapt to it.
    const event = { kind: "refresh", progressed: true } as const;

    expect(
      checkRefreshChangesNothing(
        ruleContext({ after: withoutEcologia, before: withEcologia, event }),
      ),
    ).toStrictEqual([]);
  });
});

/** The plan the learner had before skipping ecology: both lessons ahead, one phase ending day 5. */
const hadBeforeSkip = rulePlan({
  items: [
    ruleLesson({ day: 0, lessonId: "ondas-1", skillId: "ondas" }),
    ruleLesson({ day: 1, lessonId: "ecologia-1", skillId: "ecologia" }),
  ],
  phases: [rulePhase({ end: 5, start: 0 })],
  skills,
});

/** Right after the skip, the learner finished today's lesson on waves. */
const afterSkip = rulePlan({
  items: [ruleLesson({ day: 0, lessonId: "ondas-1", skillId: "ondas", status: "done" })],
  phases: [rulePhase({ end: 4, start: 0 })],
  skills,
});

function undoTo(after: Parameters<typeof rulePlan>[0]) {
  return ruleContext({
    after: rulePlan(after),
    before: afterSkip,
    event: { change: "edited", kind: "undo", restores: hadBeforeSkip },
  });
}

describe("R38 undo gives back the plan the learner had", () => {
  it("passes when the plan is back as it was, what the learner finished since still done", () => {
    const context = undoTo({
      items: [
        ruleLesson({ day: 0, lessonId: "ondas-1", skillId: "ondas", status: "done" }),
        ruleLesson({ day: 1, lessonId: "ecologia-1", skillId: "ecologia" }),
      ],
      phases: [rulePhase({ end: 5, start: 0 })],
      skills,
    });

    expect(checkUndoRestores(context)).toStrictEqual([]);
    expect(checkChangesSaid(context)).toStrictEqual([]);
  });

  it("flags a lesson on another day, a lesson missing and a phase end moved", () => {
    const moved = undoTo({
      items: [
        ruleLesson({ day: 0, lessonId: "ondas-1", skillId: "ondas", status: "done" }),
        ruleLesson({ day: 3, lessonId: "ecologia-1", skillId: "ecologia" }),
      ],
      phases: [rulePhase({ end: 6, start: 0 })],
      skills,
    });

    expect(checkUndoRestores(moved)).toMatchObject([
      { details: { lost: 0, movedCount: 1, phaseEnds: [{ phase: 0 }] }, rule: "R38" },
    ]);

    const dropped = undoTo({
      items: [ruleLesson({ day: 0, lessonId: "ondas-1", skillId: "ondas", status: "done" })],
      phases: [rulePhase({ end: 5, start: 0 })],
      skills,
    });

    expect(checkUndoRestores(dropped)).toMatchObject([{ details: { lost: 1 }, rule: "R38" }]);
  });
});
