"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useExperienceMode } from "../mode-provider";
import { type CheckpointHrefs, CheckpointProvider } from "./checkpoint-context";
import { CheckpointDuelView } from "./checkpoint-duel-view";
import { CheckpointResultView } from "./checkpoint-result-view";
import { FocusCheckpointIntro } from "./focus-checkpoint-intro";
import { FunCheckpointIntro } from "./fun-checkpoint-intro";
import { ChallengeMoved } from "./move-to-monday";
import { useChallengeMove } from "./use-challenge-move";
import { type CheckpointActions, useCheckpointDuel } from "./use-checkpoint-duel";

export type { CheckpointActions } from "./use-checkpoint-duel";

/**
 * A phase boss, the final boss or the weekly Big Challenge, from its intro to its result. Both
 * modes play the same questions with the same pass mark and reward: Fun as the Trickster duel or
 * an event, Focus as a quiet checkpoint. The host supplies the checkpoint's view model, how to
 * reach the server, where to go next and, in Fun, the learner's buddy.
 */
export function CheckpointScreen({
  actions,
  checkpoint,
  hrefs,
  buddy,
}: {
  actions: CheckpointActions;
  checkpoint: CheckpointView;
  hrefs: CheckpointHrefs;
  buddy: LearnBuddy | null;
}) {
  const mode = useExperienceMode();
  const duel = useCheckpointDuel({ actions, checkpoint });
  const move = useChallengeMove({ actions, checkpoint });
  const { phase } = duel.state;
  const intro = mode === "fun" ? <FunCheckpointIntro /> : <FocusCheckpointIntro />;

  return (
    <CheckpointProvider
      value={{ buddy: mode === "fun" ? buddy : null, checkpoint, duel, hrefs, move }}
    >
      {phase === "intro" && (move.moved ? <ChallengeMoved /> : intro)}
      {phase === "duel" && <CheckpointDuelView />}
      {phase === "result" && <CheckpointResultView />}
    </CheckpointProvider>
  );
}
