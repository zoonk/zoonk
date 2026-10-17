import { describe, expect, it } from "vitest";
import {
  ruleChange,
  ruleChangeEvent,
  ruleContext,
  ruleLesson,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";
import {
  checkFocusKeepsArea,
  checkReduceTakesFromArea,
  checkSteeringKeepsToday,
} from "./steering-rules";

const skills = [
  ruleSkill({ area: "Civil", skillId: "civil" }),
  ruleSkill({ area: "Filosofia", skillId: "filosofia" }),
  ruleSkill({ area: "Penal", skillId: "penal" }),
];

/** A plan of these lessons; a skill's n-th lesson is the same lesson in every plan. */
function plan(items: { day: number; skillId: string }[]) {
  return rulePlan({
    items: items.map((item, index) => {
      const nth = items.slice(0, index + 1).filter((other) => other.skillId === item.skillId);
      return ruleLesson({ ...item, lessonId: `${item.skillId}-${nth.length}` });
    }),
    skills,
  });
}

const focusCivil = ruleChangeEvent({ areas: ["Civil"], kind: "focusAreas" });

const lessCivil = ruleChangeEvent({ areas: ["Civil"], kind: "reduceAreas" });

const lessCivMoreFil = ruleChangeEvent(
  { areas: ["Filosofia"], kind: "focusAreas" },
  { areas: ["Civil"], kind: "reduceAreas" },
);

describe("R1 focus never shrinks the focused area", () => {
  it("passes when the focused area keeps its lessons and ends sooner", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 5, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 5, skillId: "penal" },
    ]);

    expect(checkFocusKeepsArea(ruleContext({ after, before, event: focusCivil }))).toStrictEqual(
      [],
    );
  });

  it("flags a focus that leaves its area with fewer lessons", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "penal" },
    ]);

    expect(checkFocusKeepsArea(ruleContext({ after, before, event: focusCivil }))).toMatchObject([
      { details: { area: "Civil", lessonsAfter: 1, lessonsBefore: 2 }, rule: "R1" },
    ]);
  });

  it("flags a focus that keeps the lessons but ends the area later", () => {
    const before = plan([{ day: 1, skillId: "civil" }]);
    const after = plan([{ day: 4, skillId: "civil" }]);

    expect(checkFocusKeepsArea(ruleContext({ after, before, event: focusCivil }))).toHaveLength(1);
  });

  describe("an area added to the focus beside one focused before (Ana's math and natural sciences)", () => {
    const focusBoth = ruleChangeEvent({ areas: ["Civil", "Filosofia"], kind: "focusAreas" });

    // Civil was focused; the change adds Filosofia, which takes a Civil lesson.
    const before = {
      ...plan([
        { day: 0, skillId: "civil" },
        { day: 1, skillId: "civil" },
        { day: 2, skillId: "penal" },
      ]),
      settings: { ...plan([]).settings, focusAreas: ["Civil"] },
    };

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "filosofia" },
      { day: 2, skillId: "penal" },
    ]);

    const check = (effect: Parameters<typeof ruleChange>[0]["effect"], event = focusBoth) =>
      checkFocusKeepsArea(ruleContext({ after, before, changes: [ruleChange({ effect })], event }));

    it("passes when the area focused before shares and the card names what it gives", () => {
      expect(check({ lessonsLeftOut: ["civil lesson"] })).toStrictEqual([]);
      expect(check({ areaLessons: [{ after: 1, area: "Civil", before: 2 }] })).toStrictEqual([]);
    });

    it("flags the area focused before when the card doesn't say it has fewer lessons", () => {
      expect(check({})).toMatchObject([{ details: { area: "Civil" }, rule: "R1" }]);

      // An end date alone doesn't say the area has fewer lessons.
      expect(
        check({ areaEnds: [{ after: "2026-10-12", area: "Civil", before: "2026-10-13" }] }),
      ).toMatchObject([{ details: { area: "Civil" }, rule: "R1" }]);
    });

    it("holds every focused area when the change adds none", () => {
      const both = {
        ...before,
        settings: { ...before.settings, focusAreas: ["Civil", "Filosofia"] },
      };

      expect(
        checkFocusKeepsArea(
          ruleContext({
            after,
            before: both,
            changes: [ruleChange({ effect: { lessonsLeftOut: ["civil lesson"] } })],
            event: focusBoth,
          }),
        ),
      ).toMatchObject([{ details: { area: "Civil" }, rule: "R1" }]);
    });
  });
});

describe("R2 less of an area takes from that area", () => {
  // Everything fits: "less Civil" has nothing to take, so Civil keeps its lessons and its end.
  const fits = plan([
    { day: 0, skillId: "civil" },
    { day: 1, skillId: "penal" },
  ]);

  it("passes an inert reduce when the card says the area keeps its lessons and its end because everything fits", () => {
    const change = ruleChange({
      effect: { areaEnds: [{ after: "2026-10-12", area: "Civil", before: "2026-10-12" }] },
    });

    expect(
      checkReduceTakesFromArea(
        ruleContext({ after: fits, before: fits, changes: [change], event: lessCivil }),
      ),
    ).toStrictEqual([]);
  });

  it("passes less of an area with no lesson left to do: it has nothing to give", () => {
    const finished = rulePlan({
      items: [
        ruleLesson({ day: 0, lessonId: "civil-1", skillId: "civil", status: "testedOut" }),
        ruleLesson({ day: 1, lessonId: "penal-1", skillId: "penal" }),
      ],
      skills,
    });

    expect(
      checkReduceTakesFromArea(
        ruleContext({
          after: finished,
          before: finished,
          changes: [ruleChange({ effect: {} })],
          event: lessCivil,
        }),
      ),
    ).toStrictEqual([]);
  });

  it("flags an inert reduce the card doesn't mention", () => {
    expect(
      checkReduceTakesFromArea(
        ruleContext({
          after: fits,
          before: fits,
          changes: [ruleChange({ effect: {} })],
          event: lessCivil,
        }),
      ),
    ).toMatchObject([{ details: { area: "Civil" }, rule: "R2" }]);
  });

  it("passes when the reduced area gives up the lessons the focus gets", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "civil" },
      { day: 2, skillId: "penal" },
    ]);

    const after = plan([
      { day: 0, skillId: "filosofia" },
      { day: 1, skillId: "civil" },
      { day: 2, skillId: "penal" },
    ]);

    expect(
      checkReduceTakesFromArea(ruleContext({ after, before, event: lessCivMoreFil })),
    ).toStrictEqual([]);
  });

  it("flags lessons taken from an area the change doesn't name while the reduced one keeps its own (Rafaela)", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "penal" },
      { day: 2, skillId: "penal" },
    ]);

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "filosofia" },
      { day: 2, skillId: "penal" },
    ]);

    const violations = checkReduceTakesFromArea(
      ruleContext({ after, before, event: lessCivMoreFil }),
    );

    expect(violations.map((violation) => violation.details?.area)).toStrictEqual(["Civil"]);
  });

  const penalHeavy = plan([
    { day: 0, skillId: "civil" },
    { day: 1, skillId: "civil" },
    { day: 2, skillId: "penal" },
    { day: 3, skillId: "penal" },
    { day: 4, skillId: "penal" },
    { day: 5, skillId: "penal" },
  ]);

  const penalCut = plan([
    { day: 0, skillId: "filosofia" },
    { day: 1, skillId: "filosofia" },
    { day: 2, skillId: "filosofia" },
    { day: 3, skillId: "filosofia" },
    { day: 4, skillId: "civil" },
    { day: 5, skillId: "penal" },
  ]);

  it("passes when an unnamed area moves by more than rounding and the card names it", () => {
    const change = ruleChange({
      effect: { areaEnds: [{ after: "2026-10-17", area: "Penal", before: "2026-10-17" }] },
    });

    expect(
      checkReduceTakesFromArea(
        ruleContext({
          after: penalCut,
          before: penalHeavy,
          changes: [change],
          event: lessCivMoreFil,
        }),
      ),
    ).toStrictEqual([]);
  });

  it("flags an unnamed area that loses more than two lessons the card doesn't name", () => {
    expect(
      checkReduceTakesFromArea(
        ruleContext({ after: penalCut, before: penalHeavy, event: lessCivMoreFil }),
      ),
    ).toMatchObject([
      { details: { area: "Penal", lessonsAfter: 1, lessonsBefore: 4 }, rule: "R2" },
    ]);
  });

  it("flags less of an area that takes nothing from anyone when it focuses nothing", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "penal" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 1, skillId: "civil" },
    ]);

    const event = ruleChangeEvent({ areas: ["Penal"], kind: "reduceAreas" });

    expect(checkReduceTakesFromArea(ruleContext({ after, before, event }))).toMatchObject([
      { details: { area: "Penal" }, rule: "R2" },
    ]);
  });
});

describe("R4 a change of focus keeps today as the learner saw it", () => {
  it("passes when only the reduced area's lesson leaves and the focused one comes in", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "filosofia" },
    ]);

    expect(
      checkSteeringKeepsToday(
        ruleContext({ after, before, event: lessCivMoreFil, todayShown: true }),
      ),
    ).toStrictEqual([]);
  });

  it("flags an unasked subject that comes into today (Sofia's Processo Penal)", () => {
    const before = plan([
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "penal" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: focusCivil, todayShown: true })),
    ).toMatchObject([{ details: { problem: "came in from Penal" }, rule: "R4" }]);
  });

  it("flags a focused lesson put before today's lessons", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 1, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "civil" },
      { day: 0, skillId: "penal" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: focusCivil, todayShown: true })),
    ).toMatchObject([{ details: { problem: "came in before today's lessons" }, rule: "R4" }]);
  });

  it("passes when, with less alone, the next lesson takes the freed time after today's (OAB seed 1006)", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
      { day: 1, skillId: "filosofia" },
    ]);

    const after = plan([
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "filosofia" },
      { day: 1, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: lessCivil, todayShown: true })),
    ).toStrictEqual([]);
  });

  it("flags, with less alone, a lesson put before today's and one of the reduced area coming in", () => {
    const before = plan([
      { day: 0, skillId: "penal" },
      { day: 1, skillId: "filosofia" },
      { day: 1, skillId: "civil" },
    ]);

    const after = plan([
      { day: 0, skillId: "filosofia" },
      { day: 0, skillId: "penal" },
      { day: 0, skillId: "civil" },
    ]);

    expect(
      checkSteeringKeepsToday(ruleContext({ after, before, event: lessCivil, todayShown: true })),
    ).toMatchObject([
      { details: { problem: "came in from Civil" }, rule: "R4" },
      { details: { problem: "came in before today's lessons" }, rule: "R4" },
    ]);
  });
});
