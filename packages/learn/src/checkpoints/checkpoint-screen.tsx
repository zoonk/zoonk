"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useMemo, useState } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MomentCeremony } from "../session/moment-ceremony";
import { type CheckpointHrefs, CheckpointProvider } from "./checkpoint-context";
import { type CheckpointAnswer } from "./checkpoint-duel-state";
import { CheckpointDuelView } from "./checkpoint-duel-view";
import { CheckpointResultView } from "./checkpoint-result-view";
import { type CheckpointActions, useCheckpointDuel } from "./use-checkpoint-duel";

export type { CheckpointActions } from "./use-checkpoint-duel";

/**
 * The host's actions, keeping each answer that was graded: the result's review marks the learner's
 * own pick beside the right one, which the result itself doesn't carry.
 */
function useAnswersGiven(actions: CheckpointActions) {
  const [answersGiven, setAnswersGiven] = useState<Record<string, CheckpointAnswer>>({});

  const recording = useMemo<CheckpointActions>(
    () => ({
      ...actions,
      answer: async (input) => {
        const graded = await actions.answer(input);

        if (graded) {
          setAnswersGiven((given) => ({ ...given, [input.itemId]: input.answer }));
        }

        return graded;
      },
    }),
    [actions],
  );

  return { actions: recording, answersGiven };
}

/**
 * A started phase checkpoint (the Trickster's duel), final checkpoint or weekly challenge, to its
 * result. Its challenge page introduces and starts it. The host supplies the checkpoint's view
 * model, how to reach the server and where to go next.
 */
export function CheckpointScreen({
  actions,
  buddy,
  checkpoint,
  hrefs,
  renderCeremony,
}: {
  actions: CheckpointActions;
  /** The learner's buddy, glad about the missions the duel completed. */
  buddy?: LearnBuddy | null;
  checkpoint: CheckpointView;
  hrefs: CheckpointHrefs;
  /** The full-screen moment for a milestone the duel earned (new glasses, a belt). */
  renderCeremony?: MomentCeremony;
}) {
  const given = useAnswersGiven(actions);
  const duel = useCheckpointDuel({ actions: given.actions, checkpoint });

  return (
    <CheckpointProvider
      value={{ answersGiven: given.answersGiven, buddy, checkpoint, duel, hrefs, renderCeremony }}
    >
      {duel.state.phase === "duel" ? <CheckpointDuelView /> : <CheckpointResultView />}
    </CheckpointProvider>
  );
}
