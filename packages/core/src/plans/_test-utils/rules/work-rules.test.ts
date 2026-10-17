import { describe, expect, it } from "vitest";
import { type RuleItem } from "./rule-context";
import {
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleEventItem,
  ruleLesson,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";
import { checkChapterInProgressKept, checkFinishedKept, checkUnfinishedKept } from "./work-rules";

const skills = [
  ruleSkill({ area: "Natureza", skillId: "ecologia", topics: ["Ecologia"] }),
  ruleSkill({ area: "Natureza", skillId: "ondas", topics: ["Ondas"] }),
];

describe("R8 unfinished work carries over", () => {
  const before = rulePlan({ items: [ruleLesson({ day: 0, skillId: "ondas" })], skills });
  const event = { kind: "newDay", studied: true } as const;

  it("passes when yesterday's lesson carries over to today", () => {
    const after = rulePlan({
      items: [ruleLesson({ day: 1, lessonId: "ondas-0", skillId: "ondas" })],
      skills,
    });

    expect(
      checkUnfinishedKept(ruleContext({ after, before, event, today: ruleDay(1) })),
    ).toStrictEqual([]);
  });

  it("passes when a missed day sets aside a stand-in for time: it's still in the plan", () => {
    const standIn = rulePlan({
      items: [ruleLesson({ day: 0, lessonId: null, skillId: "ecologia" })],
      skills,
    });

    const after = rulePlan({
      items: [ruleLesson({ day: null, lessonId: null, skillId: "ecologia", status: "skipped" })],
      skills,
    });

    expect(
      checkUnfinishedKept(
        ruleContext({
          after,
          before: standIn,
          event: { kind: "newDay", studied: false },
          today: ruleDay(1),
        }),
      ),
    ).toStrictEqual([]);
  });

  it("flags yesterday's lesson dropped by the new day", () => {
    const after = rulePlan({ items: [], skills });

    expect(
      checkUnfinishedKept(ruleContext({ after, before, event, today: ruleDay(1) })),
    ).toHaveLength(1);
  });

  it("lets leftovers go on the exam's day, unless the plan studies everything past it", () => {
    const examDay = { goal: { kind: "exam", targetDate: ruleDay(1) }, skills } as const;
    const context = { before, event, today: ruleDay(1) };

    expect(
      checkUnfinishedKept(ruleContext({ ...context, after: rulePlan({ ...examDay, items: [] }) })),
    ).toStrictEqual([]);

    const fullCourse = rulePlan({ ...examDay, items: [], settings: { fullCourse: true } });

    expect(checkUnfinishedKept(ruleContext({ ...context, after: fullCourse }))).toHaveLength(1);
  });
});

describe("R8 finished work stays finished", () => {
  const finished = ruleLesson({
    completedAt: ruleDay(0),
    day: 0,
    skillId: "ondas",
    status: "done",
  });

  const before = rulePlan({
    items: [finished, ruleLesson({ day: 1, skillId: "ecologia" })],
    skills,
  });

  const event = ruleChangeEvent({ areas: ["Natureza"], kind: "focusAreas" });

  it("passes when a change keeps a finished lesson finished", () => {
    expect(checkFinishedKept(ruleContext({ after: before, before, event }))).toStrictEqual([]);
  });

  it("passes a finished boss dated to another day: a boss is its phase's", () => {
    const boss = {
      ...ruleEventItem({ day: 2, kind: "boss" }),
      completedAt: ruleDay(1),
      status: "done" as const,
    };

    const withBoss = rulePlan({ items: [boss], skills });
    const redated = rulePlan({ items: [{ ...boss, scheduledFor: ruleDay(1) }], skills });

    expect(
      checkFinishedKept(ruleContext({ after: redated, before: withBoss, event })),
    ).toStrictEqual([]);
  });

  it("flags a finished lesson a change made to do again", () => {
    const after = rulePlan({
      items: [
        { ...finished, completedAt: null, status: "todo" },
        ruleLesson({ day: 1, skillId: "ecologia" }),
      ],
      skills,
    });

    expect(checkFinishedKept(ruleContext({ after, before, event }))).toMatchObject([
      { details: { title: "ondas lesson" }, rule: "R8" },
    ]);
  });
});

describe("R10 a learner's change keeps the chapter in progress first", () => {
  const done = ruleLesson({
    chapterId: "ch1",
    completedAt: ruleDay(0),
    day: 0,
    lessonId: "c1",
    skillId: "ondas",
    status: "done",
  });

  const before = rulePlan({
    items: [
      done,
      ruleLesson({ chapterId: "ch1", day: 1, lessonId: "c2", skillId: "ondas" }),
      ruleLesson({ day: 2, lessonId: "added", skillId: "ecologia" }),
    ],
    skills,
  });

  const event = ruleChangeEvent({ areas: ["Natureza"], kind: "focusAreas" });

  it("passes when the rest of the chapter still comes first", () => {
    expect(checkChapterInProgressKept(ruleContext({ after: before, before, event }))).toStrictEqual(
      [],
    );
  });

  it("flags a change that puts another lesson before it (Carla)", () => {
    const after = rulePlan({
      items: [
        done,
        ruleLesson({ day: 1, lessonId: "added", skillId: "ecologia" }),
        ruleLesson({ chapterId: "ch1", day: 30, lessonId: "c2", skillId: "ondas" }),
      ],
      skills,
    });

    expect(checkChapterInProgressKept(ruleContext({ after, before, event }))).toMatchObject([
      { details: { lesson: "ecologia lesson" }, rule: "R10" },
    ]);
  });

  it("leaves out a chapter whose skill the change passes over (class test seed 1180: too basic)", () => {
    const skipped = ruleChangeEvent({
      choices: [{ choice: "skip", skillId: "ondas" }],
      kind: "setBaseChoices",
    });

    const items = [done, ruleLesson({ day: 1, lessonId: "added", skillId: "ecologia" })];
    const dropped = rulePlan({ items, skills });

    const after = rulePlan({
      items,
      settings: { baseChoices: [{ choice: "skip", skillId: "ondas" }] },
      skills,
    });

    expect(
      checkChapterInProgressKept(ruleContext({ after, before, event: skipped })),
    ).toStrictEqual([]);

    expect(
      checkChapterInProgressKept(ruleContext({ after: dropped, before, event })),
    ).toMatchObject([{ details: { lesson: "ondas lesson" }, rule: "R10" }]);
  });

  describe("on an exam plan whose study cycle interleaves subjects (Câmara seed 1005)", () => {
    const subjects = [...skills, ruleSkill({ area: "Humanas", skillId: "brasil" })];

    const cycle = (items: RuleItem[]) =>
      rulePlan({ goal: { kind: "exam" }, items: [done, ...items], skills: subjects });

    const was = cycle([
      ruleLesson({ chapterId: "ch1", day: 2, lessonId: "c2", skillId: "ondas" }),
      ruleLesson({ day: 5, lessonId: "brasil-1", skillId: "brasil" }),
      ruleLesson({ day: 6, lessonId: "ecologia-1", skillId: "ecologia" }),
    ]);

    const chapterOn = ({ day, ecologia }: { day: number; ecologia: number }) =>
      cycle([
        ruleLesson({ day: 1, lessonId: "brasil-1", skillId: "brasil" }),
        ruleLesson({ chapterId: "ch1", day, lessonId: "c2", skillId: "ondas" }),
        ruleLesson({ day: ecologia, lessonId: "ecologia-1", skillId: "ecologia" }),
      ]);

    it("passes when another subject's turn comes before the chapter's next lesson without delaying it", () => {
      expect(
        checkChapterInProgressKept(
          ruleContext({ after: chapterOn({ day: 2, ecologia: 6 }), before: was, event }),
        ),
      ).toStrictEqual([]);
    });

    it("flags another subject's lesson ahead of a chapter it delays, and its own subject's ahead of it", () => {
      expect(
        checkChapterInProgressKept(
          ruleContext({ after: chapterOn({ day: 3, ecologia: 6 }), before: was, event }),
        ),
      ).toMatchObject([{ details: { lesson: "brasil lesson" }, rule: "R10" }]);

      expect(
        checkChapterInProgressKept(
          ruleContext({ after: chapterOn({ day: 2, ecologia: 1 }), before: was, event }),
        ),
      ).toMatchObject([{ details: { lesson: "ecologia lesson" }, rule: "R10" }]);
    });
  });
});
