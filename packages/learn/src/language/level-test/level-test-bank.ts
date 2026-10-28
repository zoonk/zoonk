import { type LanguageLevelTestView } from "@zoonk/core/language/level-test/contract";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";

type PreparingTest = Extract<LanguageLevelTestView, { status: "preparing" }>;

/** Runs claim a pair's questions within seconds of starting, so one that hasn't by now was lost. */
const BANK_START_MS = 45_000;

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

export function updateBankWait({
  preparing,
  wait,
}: {
  preparing: PreparingTest;
  wait: BankWait;
}): BankWait {
  const writing = preparing.startedAt !== null;
  const lostStart = !writing && wait.askedAt !== null && Date.now() - wait.askedAt > BANK_START_MS;

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

export function askedBankWait({
  preparing,
  started,
}: {
  preparing: PreparingTest;
  started: boolean;
}): BankWait {
  return {
    ...updateBankWait({ preparing, wait: INITIAL_BANK_WAIT }),
    askedAt: Date.now(),
    startFailed: !started,
  };
}

export function isBankStopped(wait: BankWait): boolean {
  return wait.startFailed || (wait.sawWriter && !isWriting(wait));
}

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
