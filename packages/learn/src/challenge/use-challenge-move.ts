"use client";

import { type UnfundedMove } from "@zoonk/core/plans/plan-error-contract";
import { useState } from "react";
import { type ChallengeActions } from "./challenge-context";

/** Why the plan refused a move, for the screen to say. */
type MoveRefusal =
  | { kind: "moveBeforeNextMonday" }
  | { kind: "mockCollision" }
  | { kind: "noRoom" }
  | { kind: "unfundedMove"; unfundedMove: UnfundedMove };

export type ChallengeMoveState = {
  failed: boolean;
  moveToMonday: () => Promise<void>;
  pending: boolean;
  /**
   * The move the plan refused, and why: it can't make room for the mock on its new day
   * (`unfundedMove`), that day already has a mock (`mockCollision`), or it can't put the weekly
   * challenge there (`noRoom`).
   */
  refusal: MoveRefusal | null;
  undo: (changeId: string) => Promise<void>;
};

/**
 * "Move to Monday" and its undo. Each goes on to the challenge on its day when it went through, so
 * the button stays busy until then; one that didn't go through says so plainly, and a mock the
 * days before Monday can't save the time for says why (`refusal`), the plan as it was.
 */
export function useChallengeMove(actions: ChallengeActions): ChallengeMoveState {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<MoveRefusal | null>(null);

  async function run(
    request: () => Promise<boolean | Awaited<ReturnType<ChallengeActions["move"]>>>,
  ) {
    setPending(true);
    setFailed(false);
    setRefusal(null);

    const outcome = await request().catch(() => false as const);

    if (outcome && typeof outcome === "object") {
      setPending(false);

      if ("unfundedMove" in outcome) {
        setRefusal({ kind: "unfundedMove", unfundedMove: outcome.unfundedMove });
      } else if ("moveBeforeNextMonday" in outcome) {
        setRefusal({ kind: "moveBeforeNextMonday" });
      } else {
        setRefusal({ kind: "noRoom" in outcome ? "noRoom" : "mockCollision" });
      }

      return;
    }

    if (outcome === false || outcome === "failed") {
      setPending(false);
      setFailed(true);
    }
  }

  return {
    failed,
    moveToMonday: () => run(actions.move),
    pending,
    refusal,
    undo: (changeId) => run(() => actions.undoMove(changeId)),
  };
}
