import { describe, expect, it } from "vitest";
import { checkMostAskedKept } from "./most-asked-rules";
import { type RuleAnswer, type RuleItem } from "./rule-context";
import { ruleContext, ruleDay, ruleLesson, rulePlan, ruleSkill } from "./rule-fixtures";

const skills = [
  ruleSkill({ area: "Natureza", skillId: "ecologia", topics: ["Ecologia"] }),
  ruleSkill({ area: "Natureza", skillId: "cts", topics: ["Ciência, tecnologia e sociedade"] }),
  ruleSkill({ area: "Natureza", skillId: "tecidos", topics: ["Tecidos"] }),
  ruleSkill({ area: "Humanas", skillId: "brasil", topics: ["Brasil colônia"] }),
];

const topicLevels = [
  { level: "high", subject: "Natureza", topic: "Ecologia" },
  { level: "low", subject: "Natureza", topic: "Ciência, tecnologia e sociedade" },
  { level: "low", subject: "Natureza", topic: "Tecidos" },
  { level: "low", subject: "Humanas", topic: "Brasil colônia" },
] as const;

function plan(skillIds: string[], prerequisites = new Map<string, string[]>()) {
  return rulePlan({
    goal: { kind: "exam" },
    items: skillIds.map((skillId, day) => ruleLesson({ day, skillId })),
    prerequisites,
    skills,
    topicLevels,
  });
}

/** `count` lessons of a skill still to do, one a day from `day`. */
function lessons({ count, day, skillId }: { count: number; day: number; skillId: string }) {
  return Array.from({ length: count }, (_, at) =>
    ruleLesson({ day: day + at, lessonId: `${skillId}-${at}`, skillId }),
  );
}

/**
 * A plan of these items where `ecologia` (the most asked topic) has `size` lessons and builds on
 * `celulas`, a base no notice topic asks, of `baseSize` lessons.
 */
function planWithBase({
  baseSize = 3,
  items,
  prerequisites = new Map([["ecologia", ["celulas"]]]),
  size = 3,
}: {
  baseSize?: number;
  items: RuleItem[];
  prerequisites?: Map<string, string[]>;
  size?: number;
}) {
  return rulePlan({
    goal: { kind: "exam" },
    items,
    prerequisites,
    skills: [
      ...skills.map((skill) =>
        skill.skillId === "ecologia" ? { ...skill, lessons: size } : skill,
      ),
      ruleSkill({ area: "Natureza", lessons: baseSize, skillId: "celulas" }),
    ],
    topicLevels,
  });
}

/**
 * A plan where `cts` keeps `held` lessons while `ecologia` is out, and `celulas`, an asked topic
 * `ecologia` builds on (9 lessons, a core of 3), is held in part: a stand-in planning 1 lesson.
 */
function planWithPartBase(held: number) {
  return rulePlan({
    goal: { kind: "exam" },
    items: [
      ...lessons({ count: held, day: 0, skillId: "cts" }),
      ruleLesson({ day: held, lessonId: null, lessons: 1, skillId: "celulas" }),
    ],
    prerequisites: new Map([["ecologia", ["celulas"]]]),
    skills: [
      ...skills,
      ruleSkill({ area: "Natureza", lessons: 9, skillId: "celulas", topics: ["Células"] }),
    ],
    topicLevels: [...topicLevels, { level: "low", subject: "Natureza", topic: "Células" }],
  });
}

function placementAnswer({ correct, day }: { correct: boolean; day: number }): RuleAnswer {
  return { at: ruleDay(day), correct, format: "other", skillId: "tecidos", source: "placement" };
}

/**
 * A plan where `cts` keeps `held` lessons while `ecologia` is out, and the learner did 1 lesson of
 * `celulas` (6 lessons, a core of 2), the base `ecologia` builds on, in `area`.
 */
function startedBase({ area, held }: { area: string; held: number }) {
  return rulePlan({
    goal: { kind: "exam" },
    items: [
      ruleLesson({ day: 0, lessonId: "celulas-0", skillId: "celulas", status: "done" }),
      ...lessons({ count: held, day: 1, skillId: "cts" }),
    ],
    prerequisites: new Map([["ecologia", ["celulas"]]]),
    skills: [...skills, ruleSkill({ area, lessons: 6, skillId: "celulas" })],
    topicLevels,
  });
}

/**
 * A plan where `cts` keeps one lesson and the graph guesses 5 lessons for `ecologia`, out of the
 * plan, which the build counted as `plannedLessons`.
 */
function ecologiaPlan(plannedLessons?: number) {
  return rulePlan({
    goal: { kind: "exam" },
    items: lessons({ count: 1, day: 0, skillId: "cts" }),
    skills: skills.map((skill) =>
      skill.skillId === "ecologia" ? { ...skill, lessons: 5, plannedLessons } : skill,
    ),
    topicLevels,
  });
}

describe("R11 the most asked topics keep their core first", () => {
  it("passes when the least asked topics are the ones left out", () => {
    expect(checkMostAskedKept(ruleContext({ after: plan(["ecologia", "brasil"]) }))).toStrictEqual(
      [],
    );
  });

  it("passes when a less asked topic is kept as the base of a most asked one", () => {
    const after = plan(["tecidos", "ecologia"], new Map([["ecologia", ["tecidos"]]]));
    expect(checkMostAskedKept(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a most asked topic out while a less asked one of its subject keeps lessons (Lucas's ecology topic)", () => {
    expect(checkMostAskedKept(ruleContext({ after: plan(["cts", "brasil"]) }))).toMatchObject([
      { details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("flags a most asked topic set aside for time while a less asked one of its subject keeps lessons", () => {
    const after = rulePlan({
      goal: { kind: "exam" },
      items: [
        ruleLesson({ day: null, skillId: "ecologia", status: "skipped" }),
        ruleLesson({ day: 0, skillId: "cts" }),
        ruleLesson({ day: 1, skillId: "brasil" }),
      ],
      skills,
      topicLevels,
    });

    expect(checkMostAskedKept(ruleContext({ after }))).toMatchObject([
      { details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("passes when the most asked topic is a basic the learner passed over by choice", () => {
    // `ecologia` is the basic of area `Natureza` (`tecidos` builds on it), which the learner said is too basic.
    const after = rulePlan({
      goal: { kind: "exam" },
      items: [ruleLesson({ day: 0, skillId: "cts" }), ruleLesson({ day: 1, skillId: "brasil" })],
      prerequisites: new Map([["tecidos", ["ecologia"]]]),
      settings: { pastBasicsAreas: ["Natureza"] },
      skills: skills.map((skill) => (skill.skillId === "tecidos" ? { ...skill, phase: 1 } : skill)),
      topicLevels,
    });

    expect(checkMostAskedKept(ruleContext({ after }))).toStrictEqual([]);
  });

  it("ranks a topic the teacher announced above any unannounced one, a high one included", () => {
    // `tecidos` ("low") is announced and keeps lessons; `ecologia` ("high") is out for time.
    const after = plan(["tecidos", "brasil"]);

    expect(
      checkMostAskedKept(ruleContext({ after, learner: { announcedSkillIds: ["tecidos"] } })),
    ).toStrictEqual([]);

    expect(checkMostAskedKept(ruleContext({ after }))).toMatchObject([
      { details: { kept: ["tecidos"], topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("flags an unannounced high topic kept while an announced low one is out", () => {
    const after = plan(["ecologia", "brasil"]);

    expect(
      checkMostAskedKept(ruleContext({ after, learner: { announcedSkillIds: ["tecidos"] } })),
    ).toMatchObject([{ details: { kept: ["ecologia"], topic: "natureza|tecidos" }, rule: "R11" }]);
  });

  it("ranks announced topics among themselves by how often they're asked", () => {
    const after = plan(["tecidos", "brasil"]);
    const learner = { announcedSkillIds: ["ecologia", "tecidos"] };

    expect(checkMostAskedKept(ruleContext({ after, learner }))).toMatchObject([
      { details: { kept: ["tecidos"], topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("passes when the cut topic wouldn't fit whole in the time less asked topics keep", () => {
    // `ecologia` needs 3 lessons of core (a third of 9); `cts` keeps 2, all it has.
    const items = [
      ...lessons({ count: 2, day: 0, skillId: "cts" }),
      ruleLesson({ day: 2, skillId: "brasil" }),
    ];

    const after = planWithBase({ items, prerequisites: new Map(), size: 9 });

    expect(checkMostAskedKept(ruleContext({ after }))).toStrictEqual([]);
  });

  it("counts the cores of the bases a cut topic needs that the plan doesn't hold", () => {
    // `ecologia` needs its own core (1) and `celulas`' (2 of 6): 3 lessons.
    const fits = planWithBase({
      baseSize: 6,
      items: lessons({ count: 3, day: 0, skillId: "cts" }),
    });

    const tooBig = planWithBase({
      baseSize: 6,
      items: lessons({ count: 2, day: 0, skillId: "cts" }),
    });

    expect(checkMostAskedKept(ruleContext({ after: fits }))).toMatchObject([
      { details: { held: 3, kept: ["cts"], needs: 3, topic: "natureza|ecologia" }, rule: "R11" },
    ]);

    expect(checkMostAskedKept(ruleContext({ after: tooBig }))).toStrictEqual([]);
  });

  it("counts the core lessons a base the plan holds in part still misses (ENEM seed 1)", () => {
    // `ecologia` needs its own core (1) and the 2 lessons `celulas` (core 3 of 9) misses beyond
    // the 1 its stand-in plans: 3 lessons.
    expect(checkMostAskedKept(ruleContext({ after: planWithPartBase(2) }))).toStrictEqual([]);

    expect(checkMostAskedKept(ruleContext({ after: planWithPartBase(3) }))).toMatchObject([
      { details: { held: 3, kept: ["cts"], needs: 3, topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("counts the core a started base of the cut topic's subject still misses (Câmara seed 2141)", () => {
    // `celulas` (core 2 of 6) has 1 lesson done. In the subject of `ecologia`, its core comes
    // first, so `ecologia` needs its own core (1) and `celulas`' missing lesson: 2. A base in
    // another subject only has to be started: 1.
    const flagged = [{ details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" }];

    expect(
      checkMostAskedKept(ruleContext({ after: startedBase({ area: "Natureza", held: 1 }) })),
    ).toStrictEqual([]);

    expect(
      checkMostAskedKept(ruleContext({ after: startedBase({ area: "Natureza", held: 2 }) })),
    ).toMatchObject(flagged);

    expect(
      checkMostAskedKept(ruleContext({ after: startedBase({ area: "Humanas", held: 1 }) })),
    ).toMatchObject(flagged);
  });

  it("counts the smallest skill that teaches a cut topic as its need, since one skill brings it in", () => {
    // Two skills teach `Ecologia`: `ecologia` needs 3 lessons of core (a third of 9), `ecossistemas`
    // needs 1. `cts` keeps 2, room for `ecossistemas`.
    const after = rulePlan({
      goal: { kind: "exam" },
      items: lessons({ count: 2, day: 0, skillId: "cts" }),
      skills: [
        ...skills.map((skill) => (skill.skillId === "ecologia" ? { ...skill, lessons: 9 } : skill)),
        ruleSkill({ area: "Natureza", skillId: "ecossistemas", topics: ["Ecologia"] }),
      ],
      topicLevels,
    });

    expect(checkMostAskedKept(ruleContext({ after }))).toMatchObject([
      { details: { held: 2, kept: ["cts"], needs: 1, topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("counts a cut topic's need by the lessons the plan's build counted, not the graph's estimate", () => {
    // The graph guessed 5 lessons for `ecologia` (a core of 2), but the build counted 3 (a core of
    // 1): the lesson `cts` keeps is room for it.
    expect(checkMostAskedKept(ruleContext({ after: ecologiaPlan() }))).toStrictEqual([]);

    expect(checkMostAskedKept(ruleContext({ after: ecologiaPlan(3) }))).toMatchObject([
      { details: { held: 1, needs: 1, topic: "natureza|ecologia" }, rule: "R11" },
    ]);
  });

  it("ranks a kept skill as the topic it brings in, announced when any skill of it is (class test seed 6)", () => {
    // `Membrana` is announced through `osmose`, which has no lessons: `membrana` brings it in.
    // `virus` was missed, so it outranks an unannounced topic asked as often, not an announced one.
    const after = rulePlan({
      goal: { kind: "exam" },
      items: lessons({ count: 2, day: 0, skillId: "membrana" }),
      skills: [
        ruleSkill({ area: "Natureza", skillId: "membrana", topics: ["Membrana"] }),
        ruleSkill({ area: "Natureza", skillId: "osmose", topics: ["Membrana"] }),
        ruleSkill({ area: "Natureza", skillId: "virus", topics: ["Vírus"] }),
      ],
      topicLevels: [
        { level: "low", subject: "Natureza", topic: "Membrana" },
        { level: "low", subject: "Natureza", topic: "Vírus" },
      ],
    });

    const answers: RuleAnswer[] = [
      { at: ruleDay(0), correct: false, format: "other", skillId: "virus", source: "placement" },
    ];

    expect(
      checkMostAskedKept(
        ruleContext({ after, answers, learner: { announcedSkillIds: ["osmose"] } }),
      ),
    ).toStrictEqual([]);

    expect(checkMostAskedKept(ruleContext({ after, answers }))).toMatchObject([
      { details: { kept: ["membrana"], topic: "natureza|virus" }, rule: "R11" },
    ]);
  });

  it("doesn't count a less asked topic the cut topic builds on as room for it", () => {
    // `tecidos` is asked itself and `ecologia` builds on it: it keeps its lessons on its own rank.
    const prerequisites = new Map([["ecologia", ["tecidos"]]]);
    const items = lessons({ count: 3, day: 0, skillId: "tecidos" });

    expect(
      checkMostAskedKept(ruleContext({ after: planWithBase({ items, prerequisites }) })),
    ).toStrictEqual([]);

    expect(
      checkMostAskedKept(
        ruleContext({
          after: planWithBase({
            items: [...items, ruleLesson({ day: 3, skillId: "cts" })],
            prerequisites,
          }),
        }),
      ),
    ).toMatchObject([{ details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" }]);
  });

  it("flags lessons on a base no topic asks when only a cut topic builds on it", () => {
    const items = [
      ...lessons({ count: 2, day: 0, skillId: "celulas" }),
      ruleLesson({ day: 2, skillId: "brasil" }),
    ];

    expect(
      checkMostAskedKept(ruleContext({ after: planWithBase({ items, size: 9 }) })),
    ).toMatchObject([{ details: { bases: ["celulas"], topic: "natureza|ecologia" }, rule: "R11" }]);
  });

  it("passes when a topic in the plan also builds on that base", () => {
    const items = [
      ...lessons({ count: 2, day: 0, skillId: "celulas" }),
      ruleLesson({ day: 2, skillId: "tecidos" }),
    ];

    const prerequisites = new Map([
      ["ecologia", ["celulas"]],
      ["tecidos", ["celulas"]],
    ]);

    expect(
      checkMostAskedKept(ruleContext({ after: planWithBase({ items, prerequisites, size: 9 }) })),
    ).toStrictEqual([]);
  });

  it("ranks a topic the learner showed they know below any they don't (Câmara seed 2006)", () => {
    // The plan cuts what they showed they know first; practice keeps it (the syllabus says known).
    const known = { knownSkillIds: ["ecologia"] };

    expect(
      checkMostAskedKept(ruleContext({ after: plan(["cts", "brasil"]), learner: known })),
    ).toStrictEqual([]);

    expect(
      checkMostAskedKept(ruleContext({ after: plan(["ecologia", "brasil"]), learner: known })),
    ).toMatchObject([
      { details: { kept: ["ecologia"], topic: "natureza|ciencia, tecnologia e sociedade" } },
      { details: { kept: ["ecologia"], topic: "natureza|tecidos" } },
    ]);
  });

  it("passes a known skill kept as the way into a kept topic ranked at least as high as the cut", () => {
    // `cts` is known, so it ranks below the cut `tecidos`; `ecologia`, asked most, builds on it.
    const known = { knownSkillIds: ["cts"] };
    const wayIn = new Map([["ecologia", ["cts"]]]);

    expect(
      checkMostAskedKept(ruleContext({ after: plan(["ecologia", "cts"], wayIn), learner: known })),
    ).toStrictEqual([]);

    expect(
      checkMostAskedKept(ruleContext({ after: plan(["ecologia", "cts"]), learner: known })),
    ).toMatchObject([{ details: { kept: ["cts"], topic: "natureza|tecidos" }, rule: "R11" }]);
  });

  it("doesn't take a skill missed anywhere as known", () => {
    const answers: RuleAnswer[] = [
      { at: ruleDay(0), correct: false, format: "other", skillId: "ecologia", source: "placement" },
    ];

    expect(
      checkMostAskedKept(
        ruleContext({
          after: plan(["cts", "brasil"]),
          answers,
          learner: { knownSkillIds: ["ecologia"] },
        }),
      ),
    ).toMatchObject([{ details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" }]);
  });

  it("leaves an undo to R38: it gives back the plan as it was built (ENEM seed 2061)", () => {
    // The learner undid placement's test-outs: the plan they get back was built before its misses.
    const after = plan(["cts", "brasil"]);

    const answers: RuleAnswer[] = [
      { at: ruleDay(0), correct: false, format: "other", skillId: "ecologia", source: "placement" },
    ];

    const undo = { kind: "undo" } as const;

    expect(checkMostAskedKept(ruleContext({ after, answers }))).toHaveLength(1);
    expect(checkMostAskedKept(ruleContext({ after, answers, event: undo }))).toStrictEqual([]);
  });

  it("accepts this week's kept lessons after a session, which leaves the week as the learner saw it", () => {
    // Class test seed 1212: a missed topic left out waits for the week after, not a lesson shown.
    const session = { kind: "session" } as const;
    const thisWeek = plan(["cts", "brasil"]);

    const nextWeek = rulePlan({
      goal: { kind: "exam" },
      items: lessons({ count: 1, day: 7, skillId: "cts" }),
      skills,
      topicLevels,
    });

    expect(
      checkMostAskedKept(ruleContext({ after: thisWeek, before: thisWeek, event: session })),
    ).toStrictEqual([]);

    expect(
      checkMostAskedKept(ruleContext({ after: nextWeek, before: nextWeek, event: session })),
    ).toMatchObject([{ details: { kept: ["cts"], topic: "natureza|ecologia" }, rule: "R11" }]);

    expect(checkMostAskedKept(ruleContext({ after: thisWeek, before: nextWeek }))).toHaveLength(1);
  });

  it("reads a later step that leaves the plan as it was as the session's run left it", () => {
    // Class test seed 2148: the next morning had nothing to settle, so no run planned the week.
    const thisWeek = plan(["cts", "brasil"]);
    const newDay = { kind: "newDay" } as const;

    expect(
      checkMostAskedKept(ruleContext({ after: thisWeek, before: thisWeek, event: newDay })),
    ).toStrictEqual([]);
  });

  it("counts a topic missed once in placement as missed, even when a later answer was right", () => {
    // `tecidos` and `cts` are asked as often; a miss anywhere makes `tecidos` a gap, ranked first.
    const after = plan(["cts", "ecologia"]);

    const answers = [
      placementAnswer({ correct: true, day: 0 }),
      placementAnswer({ correct: false, day: 0 }),
      placementAnswer({ correct: true, day: 0 }),
    ];

    expect(checkMostAskedKept(ruleContext({ after }))).toStrictEqual([]);

    expect(checkMostAskedKept(ruleContext({ after, answers }))).toMatchObject([
      { details: { kept: ["cts"], topic: "natureza|tecidos" }, rule: "R11" },
    ]);
  });
});
