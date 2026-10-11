import { describe, expect, it } from "vitest";
import { type PlanOperation } from "../../plan-contract";
import {
  checkKnownGetsPractice,
  checkKnownHasEvidence,
  checkListeningOnlyRecorded,
  checkMissBringsLessonsBack,
} from "./known-rules";
import { type RuleAnswer, type RuleEvent } from "./rule-context";
import {
  ruleChange,
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleLesson,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Administrativo", skillId: "atos" }),
  ruleSkill({ area: "Administrativo", skillId: "licitacoes" }),
];

const todo = rulePlan({
  items: [ruleLesson({ day: 0, skillId: "atos" }), ruleLesson({ day: 1, skillId: "licitacoes" })],
  skills,
});

const known = (skillIds: string[]) =>
  rulePlan({
    items: [
      ruleLesson({
        day: 0,
        skillId: "atos",
        status: skillIds.includes("atos") ? "testedOut" : "todo",
      }),
      ruleLesson({
        day: 1,
        skillId: "licitacoes",
        status: skillIds.includes("licitacoes") ? "testedOut" : "todo",
      }),
    ],
    skills,
  });

function answer(
  skillId: string,
  correct: boolean,
  format: RuleAnswer["format"] = "other",
): RuleAnswer {
  return { at: ruleDay(0), correct, format, skillId, source: "placement" };
}

const placement = { kind: "placement" } as const;

/** The learner said administrative law's lessons are too basic. */
const tooBasic: PlanOperation = {
  areas: ["Administrativo"],
  kind: "setAreaStart",
  start: "pastBasics",
};

describe("R17 a topic is known only from its own answers", () => {
  it("passes when each tested-out skill has a right answer of its own", () => {
    const answers = [answer("atos", true), answer("licitacoes", true)];

    expect(
      checkKnownHasEvidence(
        ruleContext({
          after: known(["atos", "licitacoes"]),
          answers,
          before: todo,
          event: placement,
        }),
      ),
    ).toStrictEqual([]);
  });

  it("flags basics skipped on the learner's word alone (D9), in a new plan too", () => {
    const context = ruleContext({
      after: known(["atos"]),
      answers: [],
      before: null,
      event: { kind: "planCreated" },
      learner: { knownAreas: ["Administrativo"] },
    });

    expect(checkKnownHasEvidence(context)).toMatchObject([
      { details: { skillId: "atos" }, rule: "R17" },
    ]);
  });

  it("reads no lesson check as evidence: a right one never makes a skill known, a miss never blocks it", () => {
    const lessonCheck = (skillId: string, correct: boolean): RuleAnswer => ({
      ...answer(skillId, correct),
      source: "lesson",
    });

    const context = ruleContext({
      after: known(["atos", "licitacoes"]),
      answers: [lessonCheck("atos", false), answer("atos", true), lessonCheck("licitacoes", true)],
      before: todo,
      event: placement,
    });

    expect(checkKnownHasEvidence(context)).toMatchObject([
      { details: { skillId: "licitacoes" }, rule: "R17" },
    ]);
  });

  it("flags a whole subject tested out from one answer (Sofia's Administrativo)", () => {
    const answers = [answer("atos", true)];

    expect(
      checkKnownHasEvidence(
        ruleContext({
          after: known(["atos", "licitacoes"]),
          answers,
          before: todo,
          event: placement,
        }),
      ),
    ).toMatchObject([{ details: { skillId: "licitacoes" }, rule: "R17" }]);
  });

  it("flags one true-or-false answer, and one answer on a focused topic", () => {
    const focused = {
      ...known(["atos"]),
      settings: { ...known(["atos"]).settings, focusAreas: ["Administrativo"] },
    };

    expect(
      checkKnownHasEvidence(
        ruleContext({
          after: known(["atos"]),
          answers: [answer("atos", true, "trueFalse")],
          before: todo,
          event: placement,
        }),
      ),
    ).toHaveLength(1);

    expect(
      checkKnownHasEvidence(
        ruleContext({
          after: focused,
          answers: [answer("atos", true)],
          before: todo,
          event: placement,
        }),
      ),
    ).toHaveLength(1);
  });

  it("passes units a measured level tested out, and flags them on a stated level", () => {
    const context = ruleContext({
      after: known(["atos"]),
      answers: [],
      before: todo,
      event: placement,
    });

    expect(
      checkKnownHasEvidence({ ...context, learner: { measuredSkillIds: ["atos"] } }),
    ).toStrictEqual([]);

    expect(checkKnownHasEvidence(context)).toMatchObject([
      { details: { skillId: "atos" }, rule: "R17" },
    ]);
  });

  it("flags basics a choice tested out: an area too basic leaves its lessons, never as known", () => {
    const context = ruleContext({
      after: known(["atos"]),
      answers: [],
      before: todo,
      event: ruleChangeEvent(tooBasic),
    });

    expect(checkKnownHasEvidence(context)).toMatchObject([
      { details: { skillId: "atos" }, rule: "R17" },
    ]);
  });
});

/**
 * Administrative law's basics (`atos`, its acts, which `licitacoes`, procurement, builds on) passed over by choice: skipped as
 * a base, or the area said to be too basic. The plan holds no lesson of them; they're to confirm.
 */
function passedOver(choice: "pastBasics" | "skip") {
  return rulePlan({
    items: [ruleLesson({ day: 1, skillId: "licitacoes" })],
    prerequisites: new Map([["licitacoes", ["atos"]]]),
    settings:
      choice === "skip"
        ? { baseChoices: [{ choice: "skip", skillId: "atos" }] }
        : { pastBasicsAreas: ["Administrativo"] },
    skills: [
      ruleSkill({ area: "Administrativo", skillId: "atos" }),
      ruleSkill({ area: "Administrativo", phase: 1, skillId: "licitacoes" }),
    ],
  });
}

const backInPlan = rulePlan({
  ...passedOver("skip"),
  items: [ruleLesson({ day: 1, skillId: "atos" }), ruleLesson({ day: 2, skillId: "licitacoes" })],
  skills: passedOver("skip").graph.skills,
});

const relearn = ruleChange({
  effect: { topicsAdded: [{ area: "Administrativo", topics: ["atos"] }] },
  kind: "relearn",
  source: "system",
});

describe("R19 a miss on a known topic brings its lessons back", () => {
  const event: RuleEvent = {
    answers: [{ ...answer("atos", false), source: "practice" }],
    kind: "session",
  };

  it("passes when the lessons come back", () => {
    expect(
      checkMissBringsLessonsBack(ruleContext({ after: todo, before: known(["atos"]), event })),
    ).toStrictEqual([]);
  });

  it("flags a miss that leaves the topic known", () => {
    expect(
      checkMissBringsLessonsBack(
        ruleContext({ after: known(["atos"]), before: known(["atos"]), event }),
      ),
    ).toMatchObject([{ details: { skillId: "atos" }, rule: "R19" }]);
  });

  it("passes when a miss on a skipped base brings its lessons back with a change naming it", () => {
    const context = ruleContext({
      after: backInPlan,
      before: passedOver("skip"),
      changes: [relearn],
      event,
    });

    expect(checkMissBringsLessonsBack(context)).toStrictEqual([]);
  });

  it("flags a miss on basics an area too basic passed over that leaves them out", () => {
    const context = ruleContext({
      after: passedOver("pastBasics"),
      before: passedOver("pastBasics"),
      changes: [],
      event,
    });

    expect(checkMissBringsLessonsBack(context)).toMatchObject([
      {
        details: { skillId: "atos" },
        message: expect.stringContaining("didn't bring"),
        rule: "R19",
      },
    ]);
  });

  it("passes a miss on a skill of an area the learner took out: it stays out (IELTS seed 1012)", () => {
    const takenOut = {
      ...known(["atos"]),
      settings: { ...todo.settings, skippedAreas: ["Administrativo"] },
    };

    expect(
      checkMissBringsLessonsBack(
        ruleContext({ after: takenOut, before: takenOut, changes: [], event }),
      ),
    ).toStrictEqual([]);
  });

  it("flags lessons that come back without a change naming them", () => {
    const context = ruleContext({
      after: backInPlan,
      before: passedOver("skip"),
      changes: [],
      event,
    });

    expect(checkMissBringsLessonsBack(context)).toMatchObject([
      { details: { skillId: "atos" }, message: expect.stringContaining("naming"), rule: "R19" },
    ]);
  });
});

const studied = (skillIdsOnDay10: string[]) => [
  { day: ruleDay(3), practiceSkillIds: ["licitacoes"] },
  { day: ruleDay(10), practiceSkillIds: skillIdsOnDay10 },
];

describe("R18 known topics keep practice", () => {
  const confirmed = rulePlan({
    items: [
      ruleLesson({ completedAt: ruleDay(0), day: 0, skillId: "atos", status: "testedOut" }),
      ruleLesson({ day: 1, skillId: "licitacoes" }),
    ],
    skills,
  });

  it("passes when the known topic comes up in practice in its second week", () => {
    const context = ruleContext({
      after: confirmed,
      sessions: studied(["atos", "licitacoes"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toStrictEqual([]);
  });

  it("passes when the known topic is in an area the learner took out: practice leaves it out", () => {
    const context = ruleContext({
      after: {
        ...confirmed,
        settings: { ...confirmed.settings, skippedAreas: ["Administrativo"] },
      },
      sessions: studied(["licitacoes"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toStrictEqual([]);
  });

  it("flags a known topic practice never asked in its first two weeks", () => {
    const context = ruleContext({
      after: confirmed,
      sessions: studied(["licitacoes"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toMatchObject([
      { details: { skillId: "atos" }, rule: "R18" },
    ]);
  });
});

describe("R18 basics passed over by choice come up in practice", () => {
  const learnerChanges = [{ day: ruleDay(0), operations: [tooBasic] }];

  it("passes when practice asks them within two weeks of the choice", () => {
    const context = ruleContext({
      after: passedOver("pastBasics"),
      learnerChanges,
      sessions: studied(["atos"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toStrictEqual([]);
  });

  it("flags a skipped base practice never asked, from the plan's first day when chosen in setup", () => {
    const after = rulePlan({
      ...passedOver("skip"),
      settings: { ...passedOver("skip").settings, startDate: "2026-10-12" },
      skills: passedOver("skip").graph.skills,
    });

    const context = ruleContext({
      after,
      learnerChanges: [],
      sessions: studied(["licitacoes"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toMatchObject([
      { details: { since: "2026-10-12", skillId: "atos" }, rule: "R18" },
    ]);
  });

  it("flags an area's basics passed over that practice never asked", () => {
    const context = ruleContext({
      after: passedOver("pastBasics"),
      learnerChanges,
      sessions: studied(["licitacoes"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toMatchObject([
      { details: { skillId: "atos" }, rule: "R18" },
    ]);
  });

  it("flags listening basics onboarding passed over on a stated level, from the plan's first day", () => {
    // An IELTS learner who said intermediate: onboarding sets Listening past the basics.
    const after = rulePlan({
      items: [ruleLesson({ day: 1, skillId: "detail" })],
      prerequisites: new Map([["detail", ["gist"]]]),
      settings: { pastBasicsAreas: ["Listening"], startDate: "2026-10-12" },
      skills: [
        ruleSkill({ area: "Listening", skillId: "gist" }),
        ruleSkill({ area: "Listening", phase: 1, skillId: "detail" }),
      ],
    });

    const context = ruleContext({
      after,
      learnerChanges: [],
      sessions: studied(["detail"]),
      today: ruleDay(15),
    });

    expect(checkKnownGetsPractice(context)).toMatchObject([
      { details: { since: "2026-10-12", skillId: "gist" }, rule: "R18" },
    ]);
  });
});

const listeningSkills = [
  ruleSkill({ area: "Listening", skillId: "gist" }),
  ruleSkill({ area: "Reading", skillId: "scan" }),
];

function listeningPlan(gist: "testedOut" | "todo") {
  return rulePlan({
    items: [
      ruleLesson({ day: 0, skillId: "gist", status: gist }),
      ruleLesson({ day: 1, skillId: "scan" }),
    ],
    skills: listeningSkills,
  });
}

/** A right answer on the listening skill, from a recording's question or not. */
function heard(source: RuleAnswer["source"], recording?: boolean): RuleAnswer {
  return { at: ruleDay(0), correct: true, format: "other", recording, skillId: "gist", source };
}

/** The exam practices "gist" only with recordings. */
function checkListening(context: Parameters<typeof ruleContext>[0]) {
  return checkListeningOnlyRecorded(
    ruleContext({ ...context, learner: { listeningSkillIds: ["gist"] } }),
  );
}

/** A session that asked these questions. */
function sessionAsking(answers: RuleAnswer[]) {
  return checkListening({
    after: listeningPlan("todo"),
    before: listeningPlan("todo"),
    event: { answers, kind: "session" },
  });
}

/** A test-out of the listening skill, after these answers. */
function testOutAfter(answers: RuleAnswer[]) {
  return checkListening({
    after: listeningPlan("testedOut"),
    answers,
    before: listeningPlan("todo"),
    event: { kind: "testOut" },
  });
}

describe("R37 a listening skill is asked only with recordings", () => {
  it("flags a text question on it, never a recording's question or its lesson's step", () => {
    expect(sessionAsking([heard("placement")])).toMatchObject([
      { details: { asked: true, skillId: "gist" }, rule: "R37" },
    ]);

    expect(sessionAsking([heard("practice", true), heard("lesson")])).toStrictEqual([]);
  });

  it("flags it known from a text answer, not once a recording's question confirmed it", () => {
    expect(testOutAfter([heard("placement")])).toMatchObject([
      { details: { skillId: "gist", testedOut: true }, rule: "R37" },
    ]);

    expect(testOutAfter([heard("practice", true)])).toStrictEqual([]);
  });
});
