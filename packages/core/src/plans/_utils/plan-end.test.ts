import { type PlanItem } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getPlanEnd, isPlanOver } from "./plan-end";

type Item = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status">;

function lesson(status: PlanItem["status"]): Item {
  return {
    chapterId: "chapter",
    kind: "lesson",
    lessonId: "lesson",
    lessons: null,
    skillId: "skill",
    status,
  };
}

/** A stand-in for `lessons` of a skill's lessons not written yet. */
function standIn(status: PlanItem["status"], lessons: number): Item {
  return { chapterId: null, kind: "lesson", lessonId: null, lessons, skillId: "skill", status };
}

describe(getPlanEnd, () => {
  it("is null while a lesson is left to do, or a plan has none", () => {
    expect(getPlanEnd([lesson("done"), lesson("todo")])).toBeNull();
    expect(getPlanEnd([])).toBeNull();
  });

  it("is finished once every lesson was studied or tested out", () => {
    expect(getPlanEnd([lesson("done"), lesson("testedOut")])).toStrictEqual({
      kind: "finished",
      setAsideLessons: 0,
    });
  });

  // Rafaela's plan reached its date with the lessons missed days set aside: it ended, and it never
  // celebrates them as finished.
  it("ends with the lessons set aside left out, never finished", () => {
    expect(getPlanEnd([lesson("done"), lesson("skipped"), standIn("skipped", 3)])).toStrictEqual({
      kind: "ended",
      setAsideLessons: 4,
    });
  });
});

describe(isPlanOver, () => {
  it("is over once every lesson is behind the learner, even with a final checkpoint ahead", () => {
    expect(
      isPlanOver([
        { kind: "lesson", status: "done" },
        { kind: "chapter", status: "testedOut" },
        { kind: "lesson", status: "skipped" },
        { kind: "boss", status: "todo" },
      ]),
    ).toBe(true);
  });

  it("isn't over while a mock or a review before the exam is still ahead", () => {
    expect(
      isPlanOver([
        { kind: "lesson", status: "testedOut" },
        { kind: "mock", status: "todo" },
      ]),
    ).toBe(false);

    expect(
      isPlanOver([
        { kind: "lesson", status: "done" },
        { kind: "mock", status: "done" },
        { kind: "review", status: "todo" },
      ]),
    ).toBe(false);

    expect(
      isPlanOver([
        { kind: "lesson", status: "done" },
        { kind: "mock", status: "done" },
        { kind: "review", status: "done" },
      ]),
    ).toBe(true);
  });

  it("isn't over with a lesson left or without lessons", () => {
    expect(isPlanOver([{ kind: "lesson", status: "todo" }])).toBe(false);
    expect(isPlanOver([{ kind: "mock", status: "done" }])).toBe(false);
  });
});
