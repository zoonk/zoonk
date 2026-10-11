import { describe, expect, it } from "vitest";
import {
  checkBaseChoicesKeepTopics,
  checkEverythingPlanned,
  checkOutcomesKept,
  checkPrerequisitesFirst,
  checkWrittenTestsKept,
} from "./keep-rules";
import { type RuleEvent } from "./rule-context";
import {
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleLesson,
  rulePhase,
  rulePhaseDatesProposal,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

describe("R12 an exam's written tests are always in", () => {
  const skills = [
    ruleSkill({ area: "Redação", outcome: true, skillId: "redacao" }),
    ruleSkill({ area: "Matemática", skillId: "funcoes" }),
  ];

  const exam = (items: ReturnType<typeof ruleLesson>[]) =>
    rulePlan({ goal: { kind: "exam", targetDate: ruleDay(60) }, items, skills });

  const event = { kind: "planCreated" } as const;

  it("passes when the essay starts in the first week", () => {
    const after = exam([
      ruleLesson({ day: 0, skillId: "funcoes" }),
      ruleLesson({ day: 3, skillId: "redacao" }),
    ]);

    expect(checkWrittenTestsKept(ruleContext({ after, event }))).toStrictEqual([]);
  });

  it("flags an essay that waits past the first week, and one cut", () => {
    const late = exam([
      ruleLesson({ day: 0, skillId: "funcoes" }),
      ruleLesson({ day: 9, skillId: "redacao" }),
    ]);

    const cut = exam([ruleLesson({ day: 0, skillId: "funcoes" })]);

    expect(checkWrittenTestsKept(ruleContext({ after: late, event }))).toHaveLength(1);

    expect(checkWrittenTestsKept(ruleContext({ after: cut }))).toMatchObject([
      { details: { area: "Redação" }, rule: "R12" },
    ]);
  });
});

/**
 * Today's proposal to move a phase's end earlier, which brings the portfolio back: its card names
 * the outcome skills it fits in (`outcomesAdded`, career seed 2014).
 */
function bringPortfolioBack(status: "declined" | "proposed") {
  return rulePhaseDatesProposal({
    effect: {
      lessonsAdded: 2,
      outcomesAdded: ["Portfólio"],
      phaseEnds: [{ after: "2026-10-16", before: "2026-10-18", name: "learn" }],
    },
    status,
  });
}

describe("R13 a career goal keeps its outcome work", () => {
  const skills = [
    ruleSkill({ skillId: "pesquisa" }),
    ruleSkill({ name: "Portfólio", outcome: true, skillId: "portfolio" }),
  ];

  it("passes when the portfolio is in the plan", () => {
    const after = rulePlan({ items: [ruleLesson({ day: 0, skillId: "portfolio" })], skills });
    expect(checkOutcomesKept(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a plan that cut the portfolio", () => {
    const after = rulePlan({ items: [ruleLesson({ day: 0, skillId: "pesquisa" })], skills });

    expect(checkOutcomesKept(ruleContext({ after }))).toMatchObject([
      { details: { skill: "Portfólio" }, rule: "R13" },
    ]);
  });

  it("passes while a proposal to move the phase dates that brings it back waits, or after the learner kept their dates", () => {
    // Keeping the ends the learner saw leaves no room for the portfolio by the goal's date.
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "pesquisa" })],
      phases: [rulePhase({ end: 6, start: 0 })],
      skills,
    });

    expect(
      checkOutcomesKept(ruleContext({ after, waiting: [bringPortfolioBack("proposed")] })),
    ).toStrictEqual([]);

    expect(
      checkOutcomesKept(ruleContext({ after, declined: [bringPortfolioBack("declined")] })),
    ).toStrictEqual([]);
  });

  it("flags it when no proposal brings it back from the ends shown", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "pesquisa" })],
      phases: [rulePhase({ end: 6, start: 0 })],
      skills,
    });

    const other = rulePhaseDatesProposal({
      effect: { phaseEnds: [{ after: "2026-10-16", before: "2026-10-18", name: "learn" }] },
    });

    const stale = rulePhaseDatesProposal({
      effect: {
        outcomesAdded: ["Portfólio"],
        phaseEnds: [{ after: "2026-10-16", before: "2026-10-20", name: "learn" }],
      },
      status: "declined",
    });

    expect(
      checkOutcomesKept(ruleContext({ after, declined: [stale], waiting: [other] })),
    ).toMatchObject([{ details: { skill: "Portfólio" }, rule: "R13" }]);
  });
});

describe("R14 studying everything leaves nothing out", () => {
  const skills = [ruleSkill({ area: "A", skillId: "a" }), ruleSkill({ area: "B", skillId: "b" })];

  it("passes when every skill is in a plan without a date, or the learner took the area out", () => {
    const all = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "a" }), ruleLesson({ day: 1, skillId: "b" })],
      skills,
    });

    const skipped = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "a" })],
      settings: { skippedAreas: ["B"] },
      skills,
    });

    expect(checkEverythingPlanned(ruleContext({ after: all }))).toStrictEqual([]);
    expect(checkEverythingPlanned(ruleContext({ after: skipped }))).toStrictEqual([]);
  });

  it("passes when the basics of an area the learner said is too basic leave, like a skipped base", () => {
    const basics = [
      ruleSkill({ area: "A", skillId: "a" }),
      ruleSkill({ area: "A", phase: 1, skillId: "a2" }),
    ];

    const tooBasic = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "a2" })],
      prerequisites: new Map([["a2", ["a"]]]),
      settings: { pastBasicsAreas: ["A"] },
      skills: basics,
    });

    const skippedBase = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "a2" })],
      settings: { baseChoices: [{ choice: "skip", skillId: "a" }] },
      skills: basics,
    });

    expect(checkEverythingPlanned(ruleContext({ after: tooBasic }))).toStrictEqual([]);
    expect(checkEverythingPlanned(ruleContext({ after: skippedBase }))).toStrictEqual([]);
  });

  it("flags an exam plan studying everything that left a skill out", () => {
    const after = rulePlan({
      goal: { kind: "exam", targetDate: ruleDay(30) },
      items: [ruleLesson({ day: 0, skillId: "a" })],
      settings: { fullCourse: true },
      skills,
    });

    expect(checkEverythingPlanned(ruleContext({ after }))).toHaveLength(1);
  });
});

describe("R15 a base choice never pushes out a topic", () => {
  const skills = [
    ruleSkill({ area: "Natureza", skillId: "atomos", topics: ["Modelos atômicos"] }),
    ruleSkill({ area: "Natureza", skillId: "ecologia", topics: ["Ecologia"] }),
  ];

  const before = rulePlan({
    items: [ruleLesson({ day: 0, skillId: "atomos" }), ruleLesson({ day: 1, skillId: "ecologia" })],
    skills,
  });

  const onlyEcologia = rulePlan({ items: [ruleLesson({ day: 0, skillId: "ecologia" })], skills });

  it("passes when only the skipped base's topic leaves", () => {
    const event = ruleChangeEvent({
      choices: [{ choice: "skip", skillId: "atomos" }],
      kind: "setBaseChoices",
    });

    expect(
      checkBaseChoicesKeepTopics(ruleContext({ after: onlyEcologia, before, event })),
    ).toStrictEqual([]);
  });

  it("flags a quick-lesson choice that pushed a topic out", () => {
    const event = ruleChangeEvent({
      choices: [{ choice: "quick", skillId: "ecologia" }],
      kind: "setBaseChoices",
    });

    expect(
      checkBaseChoicesKeepTopics(ruleContext({ after: onlyEcologia, before, event })),
    ).toMatchObject([{ details: { topic: "Natureza|modelos atomicos" }, rule: "R15" }]);
  });

  describe("a base that costs more than the choice it replaces", () => {
    const onlyAtomos = rulePlan({ items: [ruleLesson({ day: 0, skillId: "atomos" })], skills });

    it("lets a topic go that only a cheaper choice's spare time held (class test seed 1117)", () => {
      // Back from its quick lesson to its core, `atomos` takes the time that kept `ecologia`.
      const wasQuick = rulePlan({
        items: before.items,
        settings: { baseChoices: [{ choice: "quick", skillId: "atomos" }] },
        skills,
      });

      const event = ruleChangeEvent({
        choices: [{ choice: "essential", skillId: "atomos" }],
        kind: "setBaseChoices",
      });

      expect(
        checkBaseChoicesKeepTopics(ruleContext({ after: onlyAtomos, before: wasQuick, event })),
      ).toStrictEqual([]);
    });

    it("flags deep study that pushed out a topic its core kept", () => {
      const event = ruleChangeEvent({
        choices: [{ choice: "deep", skillId: "atomos" }],
        kind: "setBaseChoices",
      });

      expect(
        checkBaseChoicesKeepTopics(ruleContext({ after: onlyAtomos, before, event })),
      ).toMatchObject([{ details: { topic: "Natureza|ecologia" }, rule: "R15" }]);
    });
  });

  describe("set-aside work and finished bases (class test seed 1255)", () => {
    const cellSkills = [
      ...skills,
      ruleSkill({ area: "Natureza", skillId: "celulas", topics: ["Células"] }),
      ruleSkill({ area: "Natureza", skillId: "osmose", topics: ["Osmose"] }),
    ];

    const setAside = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "celulas", status: "done" }),
        ruleLesson({ day: 1, skillId: "atomos" }),
        ruleLesson({ day: 2, skillId: "ecologia" }),
        ruleLesson({ day: 3, skillId: "osmose", status: "skipped" }),
      ],
      skills: cellSkills,
    });

    const osmoseBack = (kept: string[]) =>
      rulePlan({
        items: [
          ruleLesson({ day: 0, skillId: "celulas", status: "done" }),
          ...kept.map((skillId, index) => ruleLesson({ day: index + 1, skillId })),
          ruleLesson({ day: 3, skillId: "osmose" }),
        ],
        skills: cellSkills,
      });

    it("changes nothing on a choice for a base the learner finished", () => {
      const event = ruleChangeEvent({
        choices: [{ choice: "quick", skillId: "celulas" }],
        kind: "setBaseChoices",
      });

      expect(
        checkBaseChoicesKeepTopics(ruleContext({ after: setAside, before: setAside, event })),
      ).toStrictEqual([]);

      expect(
        checkBaseChoicesKeepTopics(
          ruleContext({ after: osmoseBack(["atomos", "ecologia"]), before: setAside, event }),
        ),
      ).toMatchObject([{ details: { bases: ["celulas"] }, rule: "R15" }]);
    });

    it("reads a base as finished only once its core is studied, as the planner does", () => {
      const bigCells = cellSkills.map((skill) =>
        skill.skillId === "celulas" ? { ...skill, lessons: 6 } : skill,
      );

      const quickDone = rulePlan({ items: setAside.items, skills: bigCells });

      const coreBack = rulePlan({
        items: [...quickDone.items, ruleLesson({ day: 4, skillId: "celulas" })],
        skills: bigCells,
      });

      const event = ruleChangeEvent({
        choices: [{ choice: "essential", skillId: "celulas" }],
        kind: "setBaseChoices",
      });

      expect(
        checkBaseChoicesKeepTopics(ruleContext({ after: coreBack, before: quickDone, event })),
      ).toStrictEqual([]);
    });

    it("leaves the editor's Undo of a base choice to the undo's checks", () => {
      const event: RuleEvent = {
        kind: "learnerChange",
        operations: [
          { choices: [{ choice: "quick", skillId: "celulas" }], kind: "setBaseChoices" },
        ],
        setBack: true,
      };

      expect(
        checkBaseChoicesKeepTopics(
          ruleContext({ after: osmoseBack(["atomos"]), before: setAside, event }),
        ),
      ).toStrictEqual([]);
    });

    it("lets set-aside work come back only when it costs no topic the plan holds", () => {
      const event = ruleChangeEvent({
        choices: [{ choice: "quick", skillId: "atomos" }],
        kind: "setBaseChoices",
      });

      expect(
        checkBaseChoicesKeepTopics(
          ruleContext({ after: osmoseBack(["atomos", "ecologia"]), before: setAside, event }),
        ),
      ).toStrictEqual([]);

      expect(
        checkBaseChoicesKeepTopics(
          ruleContext({ after: osmoseBack(["atomos"]), before: setAside, event }),
        ),
      ).toMatchObject([{ details: { topic: "Natureza|ecologia" }, rule: "R15" }]);
    });
  });

  it("reads skills as topics when the graph maps no topics", () => {
    const careerSkills = [
      ruleSkill({ area: "Research", name: "Statistics", skillId: "statistics" }),
      ruleSkill({ area: "Research", name: "Surveys", skillId: "surveys" }),
    ];

    const both = rulePlan({
      items: [
        ruleLesson({ day: 0, skillId: "statistics" }),
        ruleLesson({ day: 1, skillId: "surveys" }),
      ],
      skills: careerSkills,
    });

    const onlySurveys = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "surveys" })],
      skills: careerSkills,
    });

    const skip = ruleChangeEvent({
      choices: [{ choice: "skip", skillId: "statistics" }],
      kind: "setBaseChoices",
    });

    const quick = ruleChangeEvent({
      choices: [{ choice: "quick", skillId: "surveys" }],
      kind: "setBaseChoices",
    });

    expect(
      checkBaseChoicesKeepTopics(ruleContext({ after: onlySurveys, before: both, event: skip })),
    ).toStrictEqual([]);

    expect(
      checkBaseChoicesKeepTopics(ruleContext({ after: onlySurveys, before: both, event: quick })),
    ).toMatchObject([{ details: { topic: "Research|statistics" }, rule: "R15" }]);
  });
});

describe("R16 what a skill builds on comes first", () => {
  const skills = [ruleSkill({ skillId: "base" }), ruleSkill({ skillId: "top" })];
  const prerequisites = new Map([["top", ["base"]]]);

  it("passes when the base comes first", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "base" }), ruleLesson({ day: 1, skillId: "top" })],
      prerequisites,
      skills,
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a skill due before its base", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 0, skillId: "top" }), ruleLesson({ day: 2, skillId: "base" })],
      prerequisites,
      skills,
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toMatchObject([
      { details: { base: "base", skill: "top" }, rule: "R16" },
    ]);
  });

  it("reads a base the learner studied in a finished lesson of another skill as begun", () => {
    const finished = ruleLesson({ day: 0, lessonId: "rent", skillId: "other", status: "done" });

    const after = rulePlan({
      items: [
        finished,
        ruleLesson({ day: 1, skillId: "top" }),
        ruleLesson({ day: 2, skillId: "base" }),
      ],
      prerequisites,
      skills: [...skills, ruleSkill({ skillId: "other" })],
      taughtBy: new Map([["rent", ["other", "base"]]]),
    });

    expect(checkPrerequisitesFirst(ruleContext({ after }))).toStrictEqual([]);
  });
});
