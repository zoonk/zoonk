"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { createContext, use } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";
import { type GenerationRun } from "../generation/generation-run";
import { type ChallengeMoveState } from "./use-challenge-move";
import { type ChallengeStartState } from "./use-challenge-start";

/**
 * How the screen reaches the server. `start` opens the challenge's block when it went through, and
 * says why it didn't otherwise: `writing` when the questions it lacks are being written first,
 * which the host shows (`ChallengeWriting`). A move and its undo take the learner to the
 * challenge on its day when they went through (a dated plan item is a new one once it moves);
 * each resolves to false when it didn't.
 */
export type ChallengeActions = {
  move: () => Promise<boolean>;
  start: () => Promise<"dailyLimitReached" | "failed" | "started" | "writing">;
  undoMove: (changeId: string) => Promise<boolean>;
};

/**
 * A challenge's questions that Start asked to have written: the run writing them (the challenge
 * starts once it's done), or why the learner's AI help doesn't cover them now.
 */
export type ChallengeWriting =
  | { kind: "refused"; limit: HelpLimit }
  | { kind: "writing"; run: GenerationRun };

/** Where the screen leads: out, and to the challenge's block (running, or its result). */
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
