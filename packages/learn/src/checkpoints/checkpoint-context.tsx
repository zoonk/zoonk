"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { createContext, use } from "react";
import { type CheckpointDuel } from "./use-checkpoint-duel";

/** Where the screen leads: back to the day, or out of the checkpoint. */
export type CheckpointHrefs = { continue: string; exit: string };

type CheckpointScreenValue = {
  checkpoint: CheckpointView;
  duel: CheckpointDuel;
  hrefs: CheckpointHrefs;
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
