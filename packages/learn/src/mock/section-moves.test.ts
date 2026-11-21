import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { describe, expect, it } from "vitest";
import { getCurrentSectionMoves, getSectionMoves, replayKeptAnswers } from "./section-moves";

const navigation = { answerChanges: null, forwardOnly: true, itemSeconds: 3, mustAnswer: true };

function moves(answered: boolean) {
  const input = {
    answered,
    changed: [],
    changesLeft: null,
    navigation,
    position: 0,
    reached: 0,
    total: 3,
  };

  return getSectionMoves(input);
}

describe("mandatory mock answers", () => {
  it("keeps a blank question open and blocks the next question", () => {
    expect(moves(false).canOpen(0)).toBe(true);
    expect(moves(false).canOpen(1)).toBe(false);
  });

  it("opens the next question after an answer, but never skips ahead", () => {
    expect(moves(true).canOpen(1)).toBe(true);
    expect(moves(true).canOpen(2)).toBe(false);
  });

  it("also requires an answer when the section moves freely", () => {
    const input = {
      answered: false,
      changed: [],
      changesLeft: null,
      navigation: { ...navigation, forwardOnly: false },
      position: 1,
      reached: 1,
      total: 3,
    };

    const result = getSectionMoves(input);
    expect(result.canOpen(1)).toBe(true);
    expect(result.canOpen(0)).toBe(false);
    expect(result.canOpen(2)).toBe(false);
  });

  it("a clock timeout may advance past a blank, but only to the immediate next question", () => {
    const result = moves(false);
    expect(result.canOpenAfterTimeout(1)).toBe(true);
    expect(result.canOpenAfterTimeout(0)).toBe(false);
    expect(result.canOpenAfterTimeout(2)).toBe(false);
  });

  it("navigation never opens a question outside the section", () => {
    expect(moves(true).canOpen(-1)).toBe(false);
    expect(moves(true).canOpen(3)).toBe(false);
  });
});

describe("reviewing timed-out mandatory questions", () => {
  it("can leave a previously timed-out blank even when no review changes remain", () => {
    const result = getSectionMoves({
      answered: false,
      changed: [],
      changesLeft: 0,
      navigation: { ...navigation, answerChanges: 1 },
      position: 0,
      reached: 4,
      total: 5,
    });

    expect(result.canChange(0)).toBe(false);
    expect(result.canAdvance).toBe(true);
    expect(result.canOpen(1)).toBe(true);
    expect(result.canOpen(4)).toBe(true);
  });

  it("still requires an answer to the current last question", () => {
    const result = getSectionMoves({
      answered: false,
      changed: [],
      changesLeft: 1,
      navigation: { ...navigation, answerChanges: 1 },
      position: 4,
      reached: 4,
      total: 5,
    });

    expect(result.canAdvance).toBe(false);
    expect(result.canOpen(3)).toBe(false);
  });
});

function draftOf(itemId: string, selectedIndex: number): MockDraft {
  return { answer: { selectedIndex }, durationMs: 1000, flagged: false, itemId };
}

const reviewItemIds = ["q1", "q2", "q3", "q4"];

function reviewView({
  answerChanges = 2,
  changedItemIds = [],
  drafts = reviewItemIds.map((itemId) => draftOf(itemId, 0)),
}: {
  answerChanges?: number;
  changedItemIds?: string[];
  drafts?: MockDraft[];
}): MockView {
  const reached = Math.max(0, drafts.length - 1);

  return {
    current: {
      changedItemIds,
      changesLeft: answerChanges - changedItemIds.length,
      drafts,
      questions: reviewItemIds.map((itemId) => ({ itemId })),
      resume: reached,
    },
    sections: [{ navigation: { ...navigation, answerChanges }, status: "current" }],
  } as unknown as MockView;
}

function movesAfterReplay({ kept, view }: { kept: MockDraft[]; view: MockView }) {
  const place = replayKeptAnswers({ kept, view });
  return getCurrentSectionMoves({ ...place, answered: true, position: 0, view });
}

describe("review changes after reopening a mock", () => {
  it("keeps changing a question already changed for free, and leaves the other changes", () => {
    const view = reviewView({ changedItemIds: ["q1"] });
    const result = movesAfterReplay({ kept: [draftOf("q1", 2)], view });

    expect(result.changesLeft).toBe(1);
    expect(result.canChange(0)).toBe(true);
    expect(result.canChange(1)).toBe(true);
  });

  it("lets a question already changed change again once no changes are left", () => {
    const result = movesAfterReplay({
      kept: [],
      view: reviewView({ answerChanges: 1, changedItemIds: ["q1"] }),
    });

    expect(result.changesLeft).toBe(0);
    expect(result.canChange(0)).toBe(true);
    expect(result.canChange(1)).toBe(false);
  });

  it("counts a change kept on the device beside the ones already charged", () => {
    const result = movesAfterReplay({
      kept: [draftOf("q2", 1)],
      view: reviewView({ changedItemIds: ["q1"] }),
    });

    expect(result.changesLeft).toBe(0);
    expect(result.canChange(0)).toBe(true);
    expect(result.canChange(1)).toBe(true);
    expect(result.canChange(2)).toBe(false);
  });

  it("charges nothing for answers that reach the end or match what's stored", () => {
    const view = reviewView({ drafts: [draftOf("q1", 0), draftOf("q2", 0)] });

    const place = replayKeptAnswers({
      kept: [
        draftOf("q3", 1),
        draftOf("q4", 1),
        { ...draftOf("q2", 0), durationMs: 5000, flagged: true },
      ],
      view,
    });

    expect(place).toStrictEqual({ changed: [], reached: 3 });
  });

  it("charges a change made in review after the last question was answered offline", () => {
    const view = reviewView({ drafts: [draftOf("q1", 0), draftOf("q2", 0), draftOf("q3", 0)] });
    const place = replayKeptAnswers({ kept: [draftOf("q4", 1), draftOf("q1", 1)], view });

    expect(place).toStrictEqual({ changed: [0], reached: 3 });
  });
});
