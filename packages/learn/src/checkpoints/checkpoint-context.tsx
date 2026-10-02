"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type ChallengeMoveState } from "./use-challenge-move";
import { type CheckpointDuel } from "./use-checkpoint-duel";

/** Where the screen leads: back to the day, or out of the checkpoint. */
export type CheckpointHrefs = { continue: string; exit: string };

type CheckpointScreenValue = {
  checkpoint: CheckpointView;
  duel: CheckpointDuel;
  hrefs: CheckpointHrefs;
  move: ChallengeMoveState;
  /** Fun's buddy cheers from the side; Focus has none. */
  buddy: LearnBuddy | null;
};

const CheckpointContext = createContext<CheckpointScreenValue | null>(null);

export function CheckpointProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CheckpointScreenValue;
}) {
  return <CheckpointContext value={value}>{children}</CheckpointContext>;
}

export function useCheckpointScreen(): CheckpointScreenValue {
  const value = use(CheckpointContext);

  if (!value) {
    throw new Error("Checkpoint parts must be used within a CheckpointScreen");
  }

  return value;
}
