import { describe, expect, it } from "vitest";
import {
  type CheckpointItemCandidate,
  getMissedSkills,
  getPassMark,
  hasPassedCheckpoint,
  selectCheckpointItems,
} from "./checkpoint-rules";

describe(getPassMark, () => {
  it("needs seven of ten, scaled to the questions asked", () => {
    expect(getPassMark(10)).toBe(7);
    expect(getPassMark(8)).toBe(6);
    expect(hasPassedCheckpoint({ correct: 7, passMark: 7 })).toBe(true);
    expect(hasPassedCheckpoint({ correct: 6, passMark: 7 })).toBe(false);
  });
});

function candidate(
  id: string,
  skillId: string,
  { seen = false, trap = false }: { seen?: boolean; trap?: boolean } = {},
): CheckpointItemCandidate {
  return { hasMisconceptions: trap, id, seen, skillId };
}

describe(selectCheckpointItems, () => {
  it("mixes the phase's skills in turn and favors unseen traps within each", () => {
    const candidates = [
      candidate("a-plain", "a"),
      candidate("a-trap-seen", "a", { seen: true, trap: true }),
      candidate("a-trap", "a", { trap: true }),
      candidate("b-plain", "b"),
      candidate("b-seen", "b", { seen: true }),
    ];

    expect(selectCheckpointItems({ candidates, skillIds: ["a", "b"] })).toStrictEqual([
      "a-trap",
      "b-plain",
      "a-trap-seen",
      "b-seen",
      "a-plain",
    ]);
  });

  it("asks ten questions at most", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => candidate(`c${index}`, "c"));

    expect(selectCheckpointItems({ candidates, skillIds: ["c"] })).toHaveLength(10);
  });
});

describe(getMissedSkills, () => {
  it("lists the skills a lost duel missed, the most missed first", () => {
    expect(
      getMissedSkills([
        { isCorrect: false, skillId: "a" },
        { isCorrect: false, skillId: "b" },
        { isCorrect: true, skillId: "c" },
        { isCorrect: false, skillId: "b" },
        { isCorrect: false, skillId: null },
      ]),
    ).toStrictEqual(["b", "a"]);
  });
});
