"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MomentCeremony } from "../session/moment-ceremony";
import { type CheckpointAnswer } from "./checkpoint-duel-state";
import { type CheckpointDuel } from "./use-checkpoint-duel";

/** Where the screen leads: back to the day, or out of the checkpoint. */
export type CheckpointHrefs = { continue: string; exit: string };

type CheckpointScreenValue = {
  /**
   * The answers graded on this screen, by item, so the review marks the learner's own pick; one
   * given before the screen was opened again isn't here.
   */
  answersGiven: Record<string, CheckpointAnswer>;
  /** The learner's buddy, glad about the missions the duel completed. */
  buddy?: LearnBuddy | null;
  checkpoint: CheckpointView;
  duel: CheckpointDuel;
  hrefs: CheckpointHrefs;
  /** The full-screen moment for a milestone the duel earned (new glasses, a belt). */
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
