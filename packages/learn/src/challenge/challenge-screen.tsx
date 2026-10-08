"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { MovedScreen } from "../_components/moved-screen";
import { TaskFrame } from "../shell/task-frame";
import {
  type ChallengeActions,
  type ChallengeHrefs,
  ChallengeProvider,
  useChallengeScreen,
} from "./challenge-context";
import { ChallengeFooter, MoveFailed } from "./challenge-footer";
import { ChallengeIntro } from "./challenge-intro";
import { useChallengeMove } from "./use-challenge-move";
import { useChallengeStart } from "./use-challenge-start";

export type { ChallengeActions } from "./challenge-context";

/** Right after "Move to Monday": the challenge's new day, with an undo while the plan allows it. */
function ChallengeMovedScreen({ changeId }: { changeId: string }) {
  const { challenge, hrefs, move } = useChallengeScreen();

  return (
    <MovedScreen
      date={challenge.date ?? challenge.today}
      error={<MoveFailed />}
      exitHref={hrefs.exit}
      onUndo={() => void move.undo(changeId)}
      pending={move.pending}
    />
  );
}

/**
 * A phase's checkpoint (the Trickster) or the week's challenge (an exam's mock), before its day
 * and on it: what it asks and what it's worth, then, on its day, one button that starts it. The
 * week's challenge can move to Monday before it starts. The host supplies the challenge, how to
 * reach the server and where to go.
 */
export function ChallengeScreen({
  actions,
  challenge,
  hrefs,
  movedBy,
}: {
  actions: ChallengeActions;
  challenge: ChallengeView;
  hrefs: ChallengeHrefs;
  /** The plan change that just moved it here, whose undo takes it back. */
  movedBy: string | null;
}) {
  const move = useChallengeMove(actions);
  const start = useChallengeStart(actions);

  return (
    <ChallengeProvider value={{ challenge, hrefs, move, start }}>
      {movedBy ? (
        <ChallengeMovedScreen changeId={movedBy} />
      ) : (
        <TaskFrame closeOnEscape exitHref={hrefs.exit} footer={<ChallengeFooter />}>
          <div className="flex flex-col gap-6 pt-2">
            <ChallengeIntro />
          </div>
        </TaskFrame>
      )}
    </ChallengeProvider>
  );
}
