import { type LanguageLevelTestView } from "@zoonk/core/language/level-test/contract";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";

export type PreparingTest = Extract<LanguageLevelTestView, { status: "preparing" }>;

/**
 * A run asked for this long ago still hasn't claimed the pair's questions: its start was lost.
 * Runs claim them within seconds of starting.
 */
const BANK_START_MS = 45_000;

/**
 * Waiting for a language pair's questions, as the level test sees it: what the test said last,
 * whether this learner's tap asked for them to be written (`asked`, when; `startFailed` when
 * asking failed) and whether a writer was seen at work, so one that stops shows as a failure.
 */
export type BankWait = {
  askedAt: number | null;
  preparing: PreparingTest | null;
  sawWriter: boolean;
  startFailed: boolean;
};

export const INITIAL_BANK_WAIT: BankWait = {
  askedAt: null,
  preparing: null,
  sawWriter: false,
  startFailed: false,
};

/** What a new answer from the test means for the wait, `now` being when it came. */
export function updateBankWait({
  now = Date.now(),
  preparing,
  wait,
}: {
  now?: number;
  preparing: PreparingTest;
  wait: BankWait;
}): BankWait {
  const writing = preparing.startedAt !== null;
  const lostStart = !writing && wait.askedAt !== null && now - wait.askedAt > BANK_START_MS;

  return {
    ...wait,
    preparing,
    sawWriter: wait.sawWriter || writing,
    startFailed: wait.startFailed || lostStart,
  };
}

function isWriting(wait: BankWait): boolean {
  return Boolean(wait.preparing?.startedAt);
}

/** The wait once this learner's tap asked for the questions: `started` when the request went through. */
export function askedBankWait({
  now = Date.now(),
  preparing,
  started,
}: {
  now?: number;
  preparing: PreparingTest;
  started: boolean;
}): BankWait {
  return {
    ...updateBankWait({ now, preparing, wait: INITIAL_BANK_WAIT }),
    askedAt: now,
    startFailed: !started,
  };
}

/** Asking for the questions failed, or the writer stopped: only the learner's tap asks again. */
export function isBankStopped(wait: BankWait): boolean {
  return wait.startFailed || (wait.sawWriter && !isWriting(wait));
}

/**
 * The wait for a pair's questions as a generation run for `GenerationWait`: writing while
 * something holds the pair's claim, a failure when asking to write them failed or was lost, when
 * the writer stopped, or when checking on them kept failing. Each failure's way out is `retry`
 * (asking again, the learner's tap), or `recheck` after a lost connection.
 */
export function toBankRun({
  poll,
  recheck,
  retry,
  wait,
}: {
  poll: PollStatus;
  recheck: () => void;
  retry: () => void;
  wait: BankWait;
}): GenerationRun {
  const writing = isWriting(wait);
  const steps = writing ? { writeLevelTestBank: "started" as const } : {};

  if (poll === "failed" || poll === "timedOut") {
    return { failure: "connection", retry: recheck, status: "failed", steps };
  }

  if (wait.startFailed) {
    return { failure: "notStarted", retry, status: "failed", steps };
  }

  if (wait.sawWriter && !writing) {
    return { failure: "generation", retry, status: "failed", steps };
  }

  return { failure: null, status: writing ? "following" : "waiting", steps };
}
