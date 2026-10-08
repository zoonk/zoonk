"use client";

import {
  answerStudyQuestionAction,
  finishStudyBlockAction,
} from "@/lib/session/study-session-actions";
import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type CheckpointActions, CheckpointScreen } from "@zoonk/learn/checkpoint";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";

/**
 * Wires the started checkpoint to the session's block actions (the ones the session screen uses to
 * answer and finish) in the learner's timezone. Leaving goes to Today; once done, it continues
 * where the page says: back to the session it was opened from, or Today.
 */
export function CheckpointClient({
  checkpoint,
  continueHref,
}: {
  checkpoint: CheckpointView;
  continueHref: string;
}) {
  const { blockId, sessionId } = checkpoint;

  const actions = useMemo<CheckpointActions>(() => {
    const ids = { blockId, sessionId };

    return {
      answer: async (input) => {
        const outcome = await answerStudyQuestionAction({
          ...ids,
          ...input,
          timeZone: getLocalTimeZone(),
        });

        return outcome.status === "answered" ? { isCorrect: outcome.feedback.isCorrect } : null;
      },
      finish: async () => {
        const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
        return outcome.status === "finished" ? outcome.moment : null;
      },
    };
  }, [blockId, sessionId]);

  const hrefs = useMemo(() => ({ continue: continueHref, exit: "/today" }), [continueHref]);

  return <CheckpointScreen actions={actions} checkpoint={checkpoint} hrefs={hrefs} />;
}
