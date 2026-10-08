"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type CheckpointHrefs, CheckpointProvider } from "./checkpoint-context";
import { CheckpointDuelView } from "./checkpoint-duel-view";
import { CheckpointResultView } from "./checkpoint-result-view";
import { type CheckpointActions, useCheckpointDuel } from "./use-checkpoint-duel";

export type { CheckpointActions } from "./use-checkpoint-duel";

/**
 * A started phase checkpoint (the Trickster's duel), final checkpoint or weekly challenge, to its
 * result. Its challenge page introduces and starts it. The host supplies the checkpoint's view
 * model, how to reach the server and where to go next.
 */
export function CheckpointScreen({
  actions,
  checkpoint,
  hrefs,
}: {
  actions: CheckpointActions;
  checkpoint: CheckpointView;
  hrefs: CheckpointHrefs;
}) {
  const duel = useCheckpointDuel({ actions, checkpoint });

  return (
    <CheckpointProvider value={{ checkpoint, duel, hrefs }}>
      {duel.state.phase === "duel" ? <CheckpointDuelView /> : <CheckpointResultView />}
    </CheckpointProvider>
  );
}
