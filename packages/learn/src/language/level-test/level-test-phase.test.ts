import {
  LANGUAGE_LEVEL_TEST_OFFER,
  type LanguageLevelTestView,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { describe, expect, it } from "vitest";
import { toLevelTestGroups, toOpenedLevelTestPhase } from "./level-test-phase";

const ATTEMPT_ID = "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a71";

const OFFER = {
  estimatedMinutes: LANGUAGE_LEVEL_TEST_OFFER.estimatedMinutes,
  total: LANGUAGE_LEVEL_TEST_OFFER.total,
};

const RESULT: LevelTestResult = {
  attemptId: ATTEMPT_ID,
  finishedAt: "2026-11-26T12:00:00.000Z",
  lessonsSkipped: 0,
  levelsSkipped: [],
  ranges: { reading: { high: "B2", low: "B1" } },
};

type Ready = Extract<LanguageLevelTestView, { status: "ready" }>;

function ready(view: Partial<Ready> = {}): Ready {
  return {
    ...OFFER,
    answered: 4,
    canStop: true,
    lastCorrect: null,
    levels: [],
    next: {
      kind: "question",
      question: {
        audio: null,
        audioPending: false,
        id: "listening-1",
        level: "A2",
        options: ["a", "b", "c", "d"],
        passage: "Hola",
        question: "What did you hear?",
        skill: "listening",
      },
    },
    showAlphabetNote: false,
    status: "ready",
    targetLanguage: "es",
    ...view,
  };
}

describe(toOpenedLevelTestPhase, () => {
  it("offers the test with the server's count and minutes when none is open", () => {
    expect(toOpenedLevelTestPhase({ surface: "onboarding", view: ready() })).toStrictEqual({
      kind: "offer",
      offer: OFFER,
    });
  });

  it("goes on at the next question of an open test", () => {
    const view = ready({ attemptId: ATTEMPT_ID });

    expect(toOpenedLevelTestPhase({ surface: "plan", view })).toStrictEqual({
      attemptId: ATTEMPT_ID,
      failures: 0,
      kind: "test",
      test: view,
    });
  });

  it("shows onboarding the result of the test it ran, and offers the test again from the Plan", () => {
    const view = ready({ attemptId: ATTEMPT_ID, next: { kind: "done" }, result: RESULT });

    expect(toOpenedLevelTestPhase({ surface: "onboarding", view })).toStrictEqual({
      kind: "result",
      nextTestOutLevel: null,
      result: RESULT,
    });

    expect(toOpenedLevelTestPhase({ surface: "plan", view })).toStrictEqual({
      kind: "offer",
      offer: OFFER,
    });
  });

  it("closes an open test that asks nothing more", () => {
    const view = ready({ attemptId: ATTEMPT_ID, next: { kind: "done" } });

    expect(toOpenedLevelTestPhase({ surface: "plan", view })).toStrictEqual({
      attemptId: ATTEMPT_ID,
      kind: "finish",
    });
  });

  it("waits while an open test's questions are being written", () => {
    const view: LanguageLevelTestView = {
      ...OFFER,
      attemptId: ATTEMPT_ID,
      expectedSeconds: 120,
      showAlphabetNote: false,
      startedAt: null,
      status: "preparing",
    };

    expect(toOpenedLevelTestPhase({ surface: "onboarding", view })).toStrictEqual({
      attemptId: ATTEMPT_ID,
      kind: "waiting",
    });
  });

  it("says a read that failed couldn't open the test", () => {
    expect(toOpenedLevelTestPhase({ surface: "plan", view: null })).toStrictEqual({
      kind: "loadFailed",
    });
  });
});

describe(toLevelTestGroups, () => {
  it("draws the test as reading, listening and both skills' check", () => {
    expect(toLevelTestGroups(LANGUAGE_LEVEL_TEST_OFFER.total)).toStrictEqual([4, 4, 4]);
  });

  it("covers every question of a test of another size", () => {
    expect(toLevelTestGroups(10)).toStrictEqual([4, 4, 2]);
    expect(toLevelTestGroups(6)).toStrictEqual([4, 2]);
  });
});
