import { describe, expect, it } from "vitest";
import {
  checkBaseChoicesKeepTopics,
  checkPrerequisitesFirst,
  checkWrittenTestsKept,
} from "./keep-rules";
import { type RuleEvent } from "./rule-context";
import {
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleLesson,
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
