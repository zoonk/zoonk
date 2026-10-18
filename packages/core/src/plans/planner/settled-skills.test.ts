import { describe, expect, it } from "vitest";
import { getSettledSkillIds } from "./settled-skills";

describe(getSettledSkillIds, () => {
  // Work missed days left no time for is set aside, not known: read as tested out, its topic would
  // never come back to the plan.
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

  // Practice missed it after the test-out: its lessons came back, and read as settled by the ones
  // still tested out, they left the plan again (career seed 2049).
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
