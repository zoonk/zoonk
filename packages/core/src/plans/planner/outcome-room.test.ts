import { describe, expect, it } from "vitest";
import { makeRoomForOutcomes } from "./outcome-room";
import { type QueueUnit } from "./plan-units";

function unit(attrs: Partial<QueueUnit> & Pick<QueueUnit, "key">): QueueUnit {
  return {
    area: "Natureza",
    chapterId: null,
    kind: "lesson",
    lessonId: null,
    minutes: 3,
    phase: 0,
    skillId: attrs.key,
    title: attrs.key,
    ...attrs,
  };
}

describe(makeRoomForOutcomes, () => {
  it("leaves out a skill's later parts without its earlier ones, which share its key", () => {
    // A skill the Library hasn't outlined yet is one stand-in split into parts under one key: its
    // core first, its depth after every other core.
    const core = unit({ key: "skill:optics" });
    const depth = unit({ depth: true, key: "skill:optics" });
    const essay = unit({ area: "Redação", key: "skill:essay", outcome: true });
    const thesis = unit({ area: "Redação", key: "skill:thesis", outcome: true });

    // Three units fit before the exam: the depth part makes room for the essay lessons.
    const room = makeRoomForOutcomes({
      dropsOutcome: (list) => list.length > 3,
      units: [core, essay, depth, thesis],
    });

    expect(room.kept).toStrictEqual([core, essay, thesis]);
    expect(room.leftOut).toStrictEqual([depth]);
  });
});
