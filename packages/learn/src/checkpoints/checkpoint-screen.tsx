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

export function CheckpointScreen({
  actions,
  buddy,
  checkpoint,
  hrefs,
  renderCeremony,
}: {
  actions: CheckpointActions;
  buddy?: LearnBuddy | null;
  checkpoint: CheckpointView;
  hrefs: CheckpointHrefs;
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
