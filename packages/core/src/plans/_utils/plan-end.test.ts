import { type PlanItem } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import {
  countChallengesLeft,
  countLessonsLeft,
  isDateReached,
  isPlanFinished,
  isPlanOver,
} from "./plan-end";

type Item = Pick<
  PlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "scheduledFor" | "skillId" | "status"
>;

function lesson(status: PlanItem["status"]): Item {
  return {
    chapterId: "chapter",
    kind: "lesson",
    lessonId: "lesson",
    lessons: null,
    scheduledFor: null,
    skillId: "skill",
    status,
  };
}

function standIn(status: PlanItem["status"], lessons: number): Item {
  return {
    chapterId: null,
    kind: "lesson",
    lessonId: null,
    lessons,
    scheduledFor: null,
    skillId: "skill",
    status,
  };
}

function challenge(status: PlanItem["status"], day = "2026-10-12") {
  return { kind: "boss" as const, scheduledFor: new Date(`${day}T00:00:00Z`), status };
}

function review(day: string) {
  return {
    kind: "review" as const,
    scheduledFor: new Date(`${day}T00:00:00Z`),
    status: "todo" as const,
  };
}

const DATE = new Date("2026-10-12T00:00:00Z");
const TODAY = new Date("2026-10-13T00:00:00Z");

describe(isPlanFinished, () => {
  it("isn't finished while a lesson is left to do, or a plan has none", () => {
    expect(
      isPlanFinished({
        goalKind: "learn",
        items: [lesson("done"), lesson("todo")],
        targetDate: null,
        today: TODAY,
      }),
    ).toBe(false);

    expect(isPlanFinished({ goalKind: "learn", items: [], targetDate: null, today: TODAY })).toBe(
      false,
    );
  });

  it("is finished once every lesson was studied or tested out", () => {
    expect(
      isPlanFinished({
        goalKind: "learn",
        items: [lesson("done"), lesson("testedOut")],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it("isn't finished with lessons set aside by its date", () => {
    expect(
      isPlanFinished({
        goalKind: "learn",
        items: [lesson("done"), lesson("skipped")],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("isn't finished while a mock or review is ahead, but is once the date left it behind", () => {
    const before = new Date("2026-10-10T00:00:00Z");

    expect(
      isPlanFinished({
        goalKind: "exam",
        items: [lesson("done"), review("2026-10-11")],
        targetDate: DATE,
        today: before,
      }),
    ).toBe(false);

    expect(
      isPlanFinished({
        goalKind: "exam",
        items: [lesson("done"), review("2026-10-11")],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(true);

    expect(
      isPlanFinished({
        goalKind: "exam",
        items: [lesson("done"), review("2026-10-20")],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("is finished going on past an exam: no deadline sets lessons aside then", () => {
    expect(
      isPlanFinished({
        goalKind: "learn",
        items: [lesson("done"), lesson("skipped")],
        studiesPastTarget: true,
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it("is finished without a date: it only sets aside lessons the Library couldn't write", () => {
    expect(
      isPlanFinished({
        goalKind: "learn",
        items: [lesson("done"), lesson("skipped")],
        targetDate: null,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it("isn't finished while a phase's challenge is left to win", () => {
    const won = [lesson("done"), challenge("done")];
    const left = [lesson("done"), challenge("done"), challenge("todo", "2026-10-11")];

    expect(isPlanFinished({ goalKind: "learn", items: won, targetDate: null, today: TODAY })).toBe(
      true,
    );

    expect(isPlanFinished({ goalKind: "learn", items: left, targetDate: null, today: TODAY })).toBe(
      false,
    );

    expect(isPlanFinished({ goalKind: "learn", items: left, targetDate: DATE, today: TODAY })).toBe(
      false,
    );
  });

  it("isn't finished, nor over, while a phase's challenge is left out for time", () => {
    const end = {
      goalKind: "learn" as const,
      items: [lesson("done"), challenge("done")],
      phases: [{}, { challengeLeftOut: true }],
      targetDate: DATE,
      today: TODAY,
    };

    expect(isPlanFinished(end)).toBe(false);
    expect(isPlanOver(end)).toBe(false);
    expect(isPlanFinished({ ...end, phaseChallengesRequired: false })).toBe(true);
  });
});

describe(countChallengesLeft, () => {
  it("counts the challenges left once every lesson is done, and only then", () => {
    const challenges = [challenge("done"), challenge("todo"), challenge("todo")];

    expect(
      countChallengesLeft({
        goalKind: "learn",
        items: [lesson("done"), lesson("testedOut"), ...challenges],
        targetDate: null,
        today: TODAY,
      }),
    ).toBe(2);

    expect(
      countChallengesLeft({
        goalKind: "learn",
        items: [lesson("done"), lesson("todo"), ...challenges],
        targetDate: null,
        today: TODAY,
      }),
    ).toBe(0);

    expect(
      countChallengesLeft({
        goalKind: "learn",
        items: [lesson("done"), lesson("skipped"), ...challenges],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(0);

    expect(
      countChallengesLeft({
        goalKind: "exam",
        items: [lesson("done"), review("2026-10-20"), ...challenges],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(0);

    expect(
      countChallengesLeft({
        goalKind: "learn",
        items: [lesson("done"), challenge("done")],
        targetDate: null,
        today: TODAY,
      }),
    ).toBe(0);
  });

  it("counts only the challenges on the calendar, beside one left out for time", () => {
    expect(
      countChallengesLeft({
        goalKind: "learn",
        items: [lesson("done"), challenge("todo")],
        phases: [{}, { challengeLeftOut: true }],
        targetDate: DATE,
        today: TODAY,
      }),
    ).toBe(1);
  });
});

describe(countLessonsLeft, () => {
  it("counts lessons to do and set aside, a stand-in as the lessons it plans", () => {
    expect(
      countLessonsLeft([
        lesson("done"),
        lesson("testedOut"),
        lesson("todo"),
        lesson("skipped"),
        standIn("skipped", 3),
      ]),
    ).toBe(5);
  });
});

describe(isDateReached, () => {
  it("is reached on the date and after it, unless an exam goes on past it", () => {
    const after = new Date("2026-10-13T00:00:00Z");
    const before = new Date("2026-10-11T00:00:00Z");

    expect(isDateReached({ studiesPastTarget: false, targetDate: DATE, today: DATE })).toBe(true);
    expect(isDateReached({ studiesPastTarget: false, targetDate: DATE, today: after })).toBe(true);

    expect(isDateReached({ studiesPastTarget: false, targetDate: DATE, today: before })).toBe(
      false,
    );

    expect(isDateReached({ studiesPastTarget: true, targetDate: DATE, today: after })).toBe(false);
    expect(isDateReached({ studiesPastTarget: false, targetDate: null, today: after })).toBe(false);
  });
});

function item(kind: PlanItem["kind"], status: PlanItem["status"]) {
  return { kind, scheduledFor: null, status };
}

describe(isPlanOver, () => {
  it("is over once every lesson is behind the learner and every challenge won", () => {
    const lessons = [
      item("lesson", "done"),
      item("chapter", "testedOut"),
      item("lesson", "skipped"),
    ];

    expect(isPlanOver({ goalKind: "learn", items: [...lessons, item("boss", "done")] })).toBe(true);

    expect(isPlanOver({ goalKind: "learn", items: [...lessons, item("boss", "todo")] })).toBe(
      false,
    );
  });

  it("isn't over while a mock or a review before the exam is still ahead", () => {
    expect(
      isPlanOver({ goalKind: "exam", items: [item("lesson", "testedOut"), item("mock", "todo")] }),
    ).toBe(false);

    expect(
      isPlanOver({
        goalKind: "exam",
        items: [item("lesson", "done"), item("mock", "done"), item("review", "todo")],
      }),
    ).toBe(false);

    expect(
      isPlanOver({
        goalKind: "exam",
        items: [item("lesson", "done"), item("mock", "done"), item("review", "done")],
      }),
    ).toBe(true);
  });

  it("is over by the same rule as finished: a review the date left behind doesn't count", () => {
    const items = [lesson("done"), review("2026-10-11")];

    expect(isPlanOver({ goalKind: "learn", items, targetDate: DATE, today: TODAY })).toBe(true);
    expect(isPlanFinished({ goalKind: "learn", items, targetDate: DATE, today: TODAY })).toBe(true);
  });

  it("isn't over with a lesson left or without lessons", () => {
    expect(isPlanOver({ goalKind: "learn", items: [item("lesson", "todo")] })).toBe(false);
    expect(isPlanOver({ goalKind: "learn", items: [item("mock", "done")] })).toBe(false);
  });
});
