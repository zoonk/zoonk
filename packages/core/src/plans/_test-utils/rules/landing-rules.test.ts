import { describe, expect, it } from "vitest";
import { checkLandingMovesOnlyLanded } from "./landing-rules";
import { type RuleItem } from "./rule-context";
import {
  ruleContext,
  ruleEventItem,
  ruleLesson,
  rulePhase,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

const skills = [ruleSkill({ skillId: "texto" }), ruleSkill({ skillId: "redes" })];
const phases = [rulePhase({ end: 4, start: 0 }), rulePhase({ end: 10, start: 5 })];
const landed = { kind: "outlinesLanded" } as const;

/** A lesson of `redes` on a day, filed under a phase. */
function redes(day: number, phase = 0) {
  return ruleLesson({ day, lessonId: `redes-${day}`, phase, skillId: "redes" });
}

/** The plan before `texto`'s two lessons land: its stand-in on day 2, `redes` around it. */
const before = rulePlan({
  items: [
    redes(1),
    ruleLesson({ day: 2, lessonId: null, lessons: 2, skillId: "texto" }),
    redes(3),
    ruleEventItem({ day: 4, kind: "boss" }),
    redes(6, 1),
  ],
  phases,
  skills,
});

/** The plan after they land, `texto`'s two lessons in its stand-in's place, with `rest` after. */
function landedPlan(rest: readonly RuleItem[]) {
  return rulePlan({
    items: [
      redes(1),
      ruleLesson({ day: 2, lessonId: "texto-a", skillId: "texto" }),
      ruleLesson({ day: 3, lessonId: "texto-b", skillId: "texto" }),
      ...rest,
    ],
    phases,
    skills,
  });
}

describe("R41 a landing moves only what it touches", () => {
  it("passes lessons in the stand-in's place, what comes after shifting later, into the next phase too (career seed 3)", () => {
    const after = landedPlan([
      ruleEventItem({ day: 4, kind: "boss" }),
      ruleLesson({ day: 5, lessonId: "redes-3", phase: 1, skillId: "redes" }),
      ruleLesson({ day: 7, lessonId: "redes-6", phase: 1, skillId: "redes" }),
    ]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before, event: landed })),
    ).toStrictEqual([]);
  });

  it("passes landed lessons that start the day after their stand-in's when nothing gets ahead of them (IELTS seed 1)", () => {
    const after = rulePlan({
      items: [
        redes(1),
        ruleLesson({ day: 3, lessonId: "texto-a", skillId: "texto" }),
        redes(3),
        ruleEventItem({ day: 4, kind: "boss" }),
        redes(6, 1),
      ],
      phases,
      skills,
    });

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before, event: landed })),
    ).toStrictEqual([]);
  });

  it("flags an item due before the landed lessons that moved", () => {
    const after = landedPlan([redes(3), ruleEventItem({ day: 4, kind: "boss" }), redes(6, 1)]);

    const movedFirst = {
      ...after,
      items: after.items.map((item) =>
        item.lessonId === "redes-1"
          ? ruleLesson({ day: 0, lessonId: "redes-1", skillId: "redes" })
          : item,
      ),
    };

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after: movedFirst, before, event: landed })),
    ).toMatchObject([{ details: { late: [], movedCount: 1 }, rule: "R41" }]);
  });

  it("flags landed lessons that another skill's later work gets ahead of (OAB seed 2003, Câmara seed 2001)", () => {
    const after = rulePlan({
      items: [
        redes(1),
        redes(3),
        ruleEventItem({ day: 4, kind: "boss" }),
        ruleLesson({ day: 5, lessonId: "texto-a", phase: 1, skillId: "texto" }),
        redes(6, 1),
      ],
      phases,
      skills,
    });

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before, event: landed })),
    ).toMatchObject([{ details: { late: ["texto"], movedCount: 0 }, rule: "R41" }]);
  });

  it("flags an item of another skill that left the plan or came in, or changed its status", () => {
    const swapped = landedPlan([ruleEventItem({ day: 4, kind: "boss" }), redes(6, 1), redes(8, 1)]);

    const skipped = landedPlan([
      ruleLesson({ day: 3, lessonId: "redes-3", skillId: "redes", status: "skipped" }),
      ruleEventItem({ day: 4, kind: "boss" }),
      redes(6, 1),
    ]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after: swapped, before, event: landed })),
    ).toMatchObject([{ details: { added: 1, lost: 1 }, rule: "R41" }]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after: skipped, before, event: landed })),
    ).toMatchObject([{ details: { movedCount: 1 }, rule: "R41" }]);
  });

  it("lets other skills' lessons leave for the time landed lessons take beyond their stand-in's, never more (career seed 1180)", () => {
    const grown = (rest: readonly RuleItem[]) =>
      rulePlan({
        items: [
          redes(1),
          ruleLesson({ day: 2, lessonId: "texto-a", skillId: "texto" }),
          ruleLesson({ day: 3, lessonId: "texto-b", skillId: "texto" }),
          ruleLesson({ day: 3, lessonId: "texto-c", skillId: "texto" }),
          ...rest,
        ],
        phases,
        skills,
      });

    const oneLeft = grown([redes(3), ruleEventItem({ day: 4, kind: "boss" })]);
    const twoLeft = grown([ruleEventItem({ day: 4, kind: "boss" })]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after: oneLeft, before, event: landed })),
    ).toStrictEqual([]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after: twoLeft, before, event: landed })),
    ).toMatchObject([{ details: { added: 0, lost: 2 }, rule: "R41" }]);
  });

  it("lets a practice day after the landed lessons move or give way, never one before them (IELTS seed 2)", () => {
    // A review day is known by its date: when the landed lessons take its day, it goes.
    const withReviews = {
      ...before,
      items: [
        ruleEventItem({ day: 0, kind: "review" }),
        ...before.items,
        ruleEventItem({ day: 8, kind: "review" }),
      ],
    };

    const after = landedPlan([redes(3), ruleEventItem({ day: 4, kind: "boss" }), redes(6, 1)]);

    const keptFirst = {
      ...after,
      items: [ruleEventItem({ day: 0, kind: "review" }), ...after.items],
    };

    expect(
      checkLandingMovesOnlyLanded(
        ruleContext({ after: keptFirst, before: withReviews, event: landed }),
      ),
    ).toStrictEqual([]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before: withReviews, event: landed })),
    ).toMatchObject([{ details: { added: 0, lost: 1 }, rule: "R41" }]);
  });

  it("lets another skill's lesson go when a landed lesson teaches its title (career seed 1163)", () => {
    const title = "Needs and requests";
    const repeated = ruleLesson({ day: 6, lessonId: "redes-6", phase: 1, skillId: "redes" });

    const withRepeated = rulePlan({
      items: [...before.items.slice(0, -1), { ...repeated, titleSnapshot: title }],
      phases,
      skills,
    });

    const after = rulePlan({
      items: [
        redes(1),
        ruleLesson({ day: 2, lessonId: "texto-a", skillId: "texto", titleSnapshot: title }),
        redes(3),
        ruleEventItem({ day: 4, kind: "boss" }),
      ],
      phases,
      skills,
    });

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before: withRepeated, event: landed })),
    ).toStrictEqual([]);

    expect(
      checkLandingMovesOnlyLanded(ruleContext({ after, before, event: landed })),
    ).toMatchObject([{ details: { added: 0, lost: 1 }, rule: "R41" }]);
  });

  it("judges only a landing", () => {
    const after = landedPlan([redes(8, 1)]);

    expect(checkLandingMovesOnlyLanded(ruleContext({ after, before }))).toStrictEqual([]);
  });
});
