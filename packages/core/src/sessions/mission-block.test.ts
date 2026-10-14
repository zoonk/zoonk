import { describe, expect, it } from "vitest";
import { findMissionBlock, getBlockMission } from "./mission-block";

type Block = Parameters<typeof findMissionBlock>[0]["blocks"][number];

function block(overrides: Partial<Block> & Pick<Block, "id" | "kind">): Block {
  return { extra: false, reinforcement: false, status: "pending", ...overrides };
}

describe(getBlockMission, () => {
  it("counts planned reviews and new lessons, never extra blocks or reinforcement lessons", () => {
    expect(getBlockMission(block({ id: "review", kind: "review" }))).toBe("review");
    expect(getBlockMission(block({ id: "lesson", kind: "learn" }))).toBe("somethingNew");
    expect(getBlockMission(block({ id: "practice", kind: "practice" }))).toBeNull();
    expect(getBlockMission(block({ extra: true, id: "extra", kind: "review" }))).toBeNull();

    expect(
      getBlockMission(block({ id: "reinforcement", kind: "learn", reinforcement: true })),
    ).toBeNull();
  });
});

describe(findMissionBlock, () => {
  const blocks = [
    block({ id: "done-review", kind: "review", status: "completed" }),
    block({ extra: true, id: "extra-lesson", kind: "learn" }),
    block({ id: "reinforcement", kind: "learn", reinforcement: true }),
    block({ id: "skipped-lesson", kind: "learn", status: "skipped" }),
    block({ id: "lesson", kind: "learn" }),
    block({ id: "review", kind: "review", status: "active" }),
    block({ id: "later-lesson", kind: "learn" }),
  ];

  it("opens the day's first block still to do that counts for the mission", () => {
    expect(findMissionBlock({ blocks, kind: "somethingNew" })?.id).toBe("lesson");
    expect(findMissionBlock({ blocks, kind: "review" })?.id).toBe("review");
  });

  it("has nothing to open once the mission's blocks are done, nor for a mistake to fix", () => {
    const done = blocks.map((item) => ({ ...item, status: "completed" as const }));

    expect(findMissionBlock({ blocks: done, kind: "review" })).toBeNull();
    expect(findMissionBlock({ blocks, kind: "fixMistake" })).toBeNull();
  });
});
