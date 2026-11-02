"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MomentCeremony } from "../session/moment-ceremony";
import { type CheckpointAnswer } from "./checkpoint-duel-state";
import { type CheckpointDuel } from "./use-checkpoint-duel";

export type CheckpointHrefs = { continue: string; exit: string };

type CheckpointScreenValue = {
  answersGiven: Record<string, CheckpointAnswer>;
  buddy?: LearnBuddy | null;
  checkpoint: CheckpointView;
  duel: CheckpointDuel;
  hrefs: CheckpointHrefs;
  renderCeremony?: MomentCeremony;
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
