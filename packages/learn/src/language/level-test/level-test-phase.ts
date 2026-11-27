import {
  LEVEL_TEST_BLOCK_SIZE,
  type LanguageLevelTestView,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { type LanguageLevelTestOutResult } from "@zoonk/core/language/level-test/test-out";
import { type PlacementQuestion } from "../../onboarding/onboarding-actions";

export type ReadyLevelTest = Extract<LanguageLevelTestView, { status: "ready" }>;

export type TestOutView = Extract<LanguageLevelTestOutResult, { status: "ready" }>["test"];

type TestOutQuestion = NonNullable<TestOutView["next"]>;
type TestOutTapQuestion = TestOutQuestion & { format: PlacementQuestion["format"] };

/** The test's questions in the sections it asks them in: reading, listening, then both skills' check. */
export function toLevelTestGroups(total: number): number[] {
  const reading = Math.min(LEVEL_TEST_BLOCK_SIZE, total);
  const listening = Math.min(LEVEL_TEST_BLOCK_SIZE, total - reading);

  return [reading, listening, total - reading - listening].filter((size) => size > 0);
}

export type ListeningOut = "cantListen" | "notUnderstood" | "skip";

/**
 * What a listening question's second button does. "Can't listen now" ends listening for the whole
 * test, so it's only for a learner who has a recording to play: while the server is still making
 * it (`audioPending`, whether or not the client still checks for it) or its play failed, the
 * button skips this one question.
 */
export function toListeningOut({
  audioPending,
  heard,
  playFailed,
}: {
  audioPending: boolean;
  heard: boolean;
  playFailed: boolean;
}): ListeningOut {
  if (heard) {
    return "notUnderstood";
  }

  return audioPending || playFailed ? "skip" : "cantListen";
}

/** What the test asks before it starts, from the server. */
export type LevelTestOffer = { estimatedMinutes: number; total: number };

export type LevelTestPhase =
  | { kind: "loadFailed" | "loading" }
  | { kind: "offer"; offer: LevelTestOffer }
  | { attemptId: string; kind: "waiting" }
  /** The test asks nothing more and isn't closed yet: closing it is the next save. */
  | { attemptId: string; kind: "finish" }
  /** `failures`: saves from this question (answers and Stop) that failed in a row. */
  | { attemptId: string; failures: number; kind: "test"; test: ReadyLevelTest }
  | { kind: "result"; nextTestOutLevel: string | null; result: LevelTestResult | null }
  | { failures: number; kind: "testOut"; question: TestOutTapQuestion; view: TestOutView }
  | { attemptId: string; kind: "testOutFinish" }
  | { kind: "testOutResult"; view: TestOutView }
  /** A test-out whose questions are still being written; `arrived` once they are, until the wait moves on. */
  | { arrived?: TestOutView; attemptId: string; kind: "testOutWaiting" };

/**
 * Where a read of the test leaves the learner: an open test goes on at its next question. A
 * finished one shows its result in onboarding, which ran it; the Plan offers the test again.
 */
export function toOpenedLevelTestPhase({
  surface,
  view,
}: {
  surface: "onboarding" | "plan";
  view: LanguageLevelTestView | null;
}): LevelTestPhase {
  if (!view) {
    return { kind: "loadFailed" };
  }

  const ownResult =
    view.attemptId && view.result?.attemptId === view.attemptId ? view.result : null;

  if (surface === "onboarding" && ownResult) {
    return { kind: "result", nextTestOutLevel: null, result: ownResult };
  }

  if (!view.attemptId || ownResult) {
    return { kind: "offer", offer: { estimatedMinutes: view.estimatedMinutes, total: view.total } };
  }

  if (view.status === "preparing") {
    return { attemptId: view.attemptId, kind: "waiting" };
  }

  if (view.next.kind !== "question" && view.next.kind !== "confirmation") {
    return { attemptId: view.attemptId, kind: "finish" };
  }

  return { attemptId: view.attemptId, failures: 0, kind: "test", test: view };
}

const TAP_FORMATS: readonly PlacementQuestion["format"][] = [
  "matchPairs",
  "multipleChoice",
  "order",
  "trueFalse",
];

/** A test-out asks taps only; anything else would be a question its screen can't take. */
function isTapQuestion(question: TestOutQuestion): question is TestOutTapQuestion {
  return TAP_FORMATS.some((tap) => tap === question.format);
}

export function toTestOutPhase(view: TestOutView): LevelTestPhase {
  if (view.preparing) {
    return { attemptId: view.attemptId, kind: "testOutWaiting" };
  }

  const question = view.next;

  if (!question && !view.result && view.total > 0) {
    return { attemptId: view.attemptId, kind: "testOutFinish" };
  }

  return question && isTapQuestion(question)
    ? { failures: 0, kind: "testOut", question, view }
    : { kind: "testOutResult", view };
}
