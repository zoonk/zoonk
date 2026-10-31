"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { type StartChallengeResult } from "@zoonk/core/checkpoints/challenge-start";
import { type UnfundedMove } from "@zoonk/core/plans/plan-error-contract";
import { createContext, use } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";
import { type GenerationRun } from "../generation/generation-run";
import { type ChallengeMoveState } from "./use-challenge-move";
import { type ChallengeStartState } from "./use-challenge-start";

/**
 * On `notToday` and `earlierFirst` the host reads the intro again. A move or its undo that went
 * through takes the learner to the challenge on its day, a new plan item once moved.
 */
export type ChallengeActions = {
  move: () => Promise<
    | "failed"
    | "moved"
    | { moveBeforeNextMonday: true }
    | { mockCollision: true }
    | { noRoom: true }
    | { unfundedMove: UnfundedMove }
  >;
  start: () => Promise<
    | Extract<StartChallengeResult, { status: "earlierFirst" }>
    | "dailyLimitReached"
    | "failed"
    | "notToday"
    | "plusRequired"
    | "started"
    | "writing"
  >;
  undoMove: (changeId: string) => Promise<boolean>;
};

export type ChallengeWriting =
  | { kind: "refused"; limit: HelpLimit }
  | { kind: "writing"; run: GenerationRun };

export type ChallengeHrefs = { exit: string; open: string | null };

type ChallengeScreenValue = {
  challenge: ChallengeView;
  hrefs: ChallengeHrefs;
  move: ChallengeMoveState;
  start: ChallengeStartState;
  writing: ChallengeWriting | null;
};

const ChallengeContext = createContext<ChallengeScreenValue | null>(null);

export function ChallengeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ChallengeScreenValue;
}) {
  return <ChallengeContext value={value}>{children}</ChallengeContext>;
}

export function useChallengeScreen(): ChallengeScreenValue {
  const value = use(ChallengeContext);

  if (!value) {
    throw new Error("Challenge parts must be used within a ChallengeScreen");
  }

  return value;
}
