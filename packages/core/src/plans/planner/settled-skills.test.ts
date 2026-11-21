import { describe, expect, it } from "vitest";
import { getSettledSkillIds, getStartedSkillIds } from "./settled-skills";

describe(getSettledSkillIds, () => {
  it("settles a stand-in's skill a test-out found known, not one set aside for time", () => {
    const settled = getSettledSkillIds({
      items: [
        { kind: "lesson", lessonId: null, skillId: "known", status: "testedOut" },
        { kind: "lesson", lessonId: null, skillId: "set-aside", status: "skipped" },
        { kind: "lesson", lessonId: null, skillId: "planned", status: "todo" },
      ],
      lessons: [],
    });

    expect([...settled]).toStrictEqual(["known"]);
  });

  it("never settles a skill the learner missed since its test-out", () => {
    const settled = getSettledSkillIds({
      items: [
        { kind: "lesson", lessonId: "l1", skillId: "missed", status: "testedOut" },
        { kind: "lesson", lessonId: "l2", skillId: "missed", status: "todo" },
        { kind: "lesson", lessonId: "l3", skillId: "known", status: "testedOut" },
      ],
      lessons: [],
      missedSkillIds: new Set(["missed"]),
    });

    expect([...settled]).toStrictEqual(["known"]);
  });
});

describe(getStartedSkillIds, () => {
  it("lists the skills with a finished lesson, not ones only planned, skipped or tested out", () => {
    const started = getStartedSkillIds([
      { kind: "lesson", skillId: "studied", status: "done" },
      { kind: "lesson", skillId: "planned", status: "todo" },
      { kind: "lesson", skillId: "set-aside", status: "skipped" },
      { kind: "lesson", skillId: "known", status: "testedOut" },
      { kind: "boss", skillId: "challenged", status: "done" },
    ]);

    expect([...started]).toStrictEqual(["studied"]);
  });
});
