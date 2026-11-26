import { describe, expect, it } from "vitest";
import {
  type MatchBoardState,
  type MatchSide,
  type MatchTry,
  cardState,
  createMatchBoard,
  dropPick,
  firstMisses,
  tapCard,
} from "./match-board-state";

const KEY = [1, 0, 2];
const isPair = ({ left, right }: MatchTry) => KEY[left] === right;

function tapAll(
  taps: [MatchSide, number][],
  { checked = true }: { checked?: boolean } = {},
): ReturnType<typeof tapCard> {
  let result: ReturnType<typeof tapCard> = {
    board: createMatchBoard({ leftCount: 3 }),
    move: { kind: "none" },
  };

  for (const [side, index] of taps) {
    result = tapCard(result.board, { index, isPair: checked ? isPair : undefined, side, total: 3 });
  }

  return result;
}

const stateOf = (
  board: MatchBoardState,
  side: MatchSide,
  index: number,
  { rows = false }: { rows?: boolean } = {},
) => cardState(board, { checks: true, index, rows, side });

describe(tapCard, () => {
  it("locks a right pair, picked from either side first", () => {
    const { board, move } = tapAll([
      ["right", 1],
      ["left", 0],
    ]);

    expect(move).toStrictEqual({ attempt: { left: 0, right: 1 }, done: false, kind: "pair" });
    expect(board.pairs).toStrictEqual([1, -1, -1]);
    expect(board.selected).toBeNull();
    expect(stateOf(board, "right", 1)).toBe("right");
  });

  it("shows a locked pair right for its moment, then quiet, while another try's moment shows", () => {
    const locked = tapAll([
      ["left", 0],
      ["right", 1],
    ]).board;

    const settled = { ...locked, locked: null };

    expect(stateOf(settled, "left", 0)).toBe("done");
    expect(stateOf(settled, "right", 1)).toBe("done");

    const { board } = tapAll([
      ["left", 0],
      ["right", 1],
      ["left", 1],
      ["right", 2],
    ]);

    expect(board.locked).toStrictEqual({ left: 0, right: 1 });
    expect(stateOf(board, "left", 0)).toBe("right");
    expect(stateOf(board, "left", 1)).toBe("wrong");
  });

  it("keeps the first card picked after a wrong pair, so another partner is one tap away", () => {
    const { board, move } = tapAll([
      ["left", 0],
      ["right", 2],
    ]);

    expect(move).toStrictEqual({ attempt: { left: 0, right: 2 }, kind: "miss" });
    expect(board.selected).toStrictEqual({ index: 0, side: "left" });
    expect(stateOf(board, "left", 0)).toBe("wrong");
    expect(stateOf(board, "right", 2)).toBe("wrong");
    expect(stateOf({ ...board, cue: null }, "left", 0)).toBe("selected");

    const next = tapCard(board, { index: 1, isPair, side: "right", total: 3 });

    expect(next.move.kind).toBe("pair");
    expect(next.board.missed).toBeNull();
  });

  it("changes the pick on the same side and clears it on the picked card", () => {
    expect(
      tapAll([
        ["left", 0],
        ["left", 1],
      ]).board.selected,
    ).toStrictEqual({ index: 1, side: "left" });

    expect(
      tapAll([
        ["left", 0],
        ["left", 0],
      ]).board.selected,
    ).toBeNull();
  });

  it("finishes on the last pair with every wrong try in order, and a locked card does nothing", () => {
    const { board, move } = tapAll([
      ["left", 0],
      ["right", 0],
      ["right", 1],
      ["right", 2],
      ["left", 1],
      ["left", 2],
      ["left", 1],
      ["right", 0],
    ]);

    expect(move).toStrictEqual({ attempt: { left: 1, right: 0 }, done: true, kind: "pair" });
    expect(board.pairs).toStrictEqual(KEY);

    expect(board.misses).toStrictEqual([
      { left: 0, right: 0 },
      { left: 1, right: 2 },
    ]);

    expect(tapCard(board, { index: 0, isPair, side: "left", total: 3 }).move.kind).toBe("none");
  });

  it("lays out the finished rows with every pair right and a pair missed where its left card had a wrong try", () => {
    const { board } = tapAll([
      ["left", 0],
      ["right", 0],
      ["right", 1],
      ["left", 1],
      ["right", 0],
      ["left", 2],
      ["right", 2],
    ]);

    expect([0, 1, 2].map((left) => stateOf(board, "left", left, { rows: true }))).toStrictEqual([
      "missed",
      "right",
      "right",
    ]);

    expect(stateOf(board, "right", KEY[0] ?? -1, { rows: true })).toBe("missed");
    expect(stateOf(board, "right", 0, { rows: true })).toBe("right");
  });

  it("marks the missed pairs of a board the learner already finished", () => {
    const board = createMatchBoard({
      finished: { misses: [{ left: 2, right: 0 }], pairs: KEY },
      leftCount: 3,
    });

    expect(stateOf(board, "left", 2, { rows: true })).toBe("missed");
    expect(stateOf(board, "left", 0, { rows: true })).toBe("right");
  });

  it("without a key, pairs any two cards and undoes a pair from either of its cards", () => {
    const paired = tapAll(
      [
        ["left", 0],
        ["right", 2],
      ],
      { checked: false },
    );

    expect(paired.board.pairs).toStrictEqual([2, -1, -1]);

    expect(cardState(paired.board, { checks: false, index: 2, rows: false, side: "right" })).toBe(
      "matched",
    );

    const undone = tapCard(paired.board, { index: 2, side: "right", total: 3 });

    expect(undone.move).toStrictEqual({ attempt: { left: 0, right: 2 }, kind: "unpair" });
    expect(undone.board.pairs).toStrictEqual([-1, -1, -1]);
  });

  it("without a key, a tap on a paired card picks it too, so the next tap gives it a new partner", () => {
    const paired = tapAll(
      [
        ["left", 0],
        ["right", 2],
      ],
      { checked: false },
    );

    const undone = tapCard(paired.board, { index: 2, side: "right", total: 3 });
    expect(undone.board.selected).toStrictEqual({ index: 2, side: "right" });

    const moved = tapCard(undone.board, { index: 1, side: "left", total: 3 });
    expect(moved.board.pairs).toStrictEqual([-1, 2, -1]);
  });
});

describe(dropPick, () => {
  it("lets go of the picked card and keeps the pairs", () => {
    const picked = tapAll([
      ["left", 1],
      ["right", 0],
      ["left", 2],
    ]).board;

    expect(dropPick(picked)).toStrictEqual({ ...picked, selected: null });
  });
});

describe(firstMisses, () => {
  it("keeps each left card's first wrong try, in the order they happened", () => {
    expect(
      firstMisses([
        { left: 2, right: 0 },
        { left: 0, right: 2 },
        { left: 2, right: 1 },
      ]),
    ).toStrictEqual([
      { left: 2, right: 0 },
      { left: 0, right: 2 },
    ]);
  });
});
