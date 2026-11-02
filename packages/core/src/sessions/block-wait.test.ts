import { describe, expect, it } from "vitest";
import { getBlockWait } from "./block-wait";

type Block = Parameters<typeof getBlockWait>[0]["block"];

const BOSS = { kind: "boss", mock: false } as const;

function block(overrides: Partial<Block> & Pick<Block, "kind" | "position">): Block {
  return { checkpoint: null, status: "pending", ...overrides };
}

describe(getBlockWait, () => {
  const review = block({ kind: "review", position: 0 });
  const lesson = block({ kind: "learn", position: 1 });
  const boss = block({ checkpoint: BOSS, kind: "checkpoint", position: 2 });
  const practice = block({ kind: "practice", position: 3 });

  it("lets every block but a phase's challenge open in any order", () => {
    const blocks = [review, lesson, boss, practice];

    expect(getBlockWait({ block: practice, blocks })).toBeNull();
    expect(getBlockWait({ block: lesson, blocks })).toBeNull();
  });

  it("holds a phase's challenge while a lesson before it is unfinished", () => {
    expect(getBlockWait({ block: boss, blocks: [review, lesson, boss] })).toBe("lessons");

    const started = { ...lesson, status: "active" as const };
    expect(getBlockWait({ block: boss, blocks: [review, started, boss] })).toBe("lessons");
  });

  it("opens it once the lessons before it are done or skipped, whatever else is left", () => {
    const done = { ...lesson, status: "completed" as const };
    const skipped = { ...lesson, status: "skipped" as const };

    expect(getBlockWait({ block: boss, blocks: [review, done, boss] })).toBeNull();
    expect(getBlockWait({ block: boss, blocks: [review, skipped, boss] })).toBeNull();
  });

  it("holds a later phase's challenge until the one before it is finished", () => {
    const final = block({
      checkpoint: { kind: "finalBoss", mock: false },
      kind: "checkpoint",
      position: 3,
    });

    expect(getBlockWait({ block: final, blocks: [boss, final] })).toBe("challenge");

    const won = { ...boss, status: "completed" as const };
    expect(getBlockWait({ block: final, blocks: [won, final] })).toBeNull();
  });

  it("never holds the week's challenge or a mock, which ask about what came before today", () => {
    const weekly = block({
      checkpoint: { kind: "weekly", mock: false },
      kind: "checkpoint",
      position: 2,
    });

    const mock = block({
      checkpoint: { kind: "weekly", mock: true },
      kind: "checkpoint",
      position: 2,
    });

    expect(getBlockWait({ block: weekly, blocks: [lesson, weekly] })).toBeNull();
    expect(getBlockWait({ block: mock, blocks: [lesson, mock] })).toBeNull();
  });
});
