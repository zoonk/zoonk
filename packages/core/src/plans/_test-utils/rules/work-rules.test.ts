import { describe, expect, it } from "vitest";
import { type RuleItem } from "./rule-context";
import {
  ruleChangeEvent,
  ruleContext,
  ruleDay,
  ruleLesson,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";
import { checkChapterInProgressKept } from "./work-rules";

const skills = [
  ruleSkill({ area: "Natureza", skillId: "ecologia", topics: ["Ecologia"] }),
  ruleSkill({ area: "Natureza", skillId: "ondas", topics: ["Ondas"] }),
];

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
