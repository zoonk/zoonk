"use client";

import { useRouter } from "@/i18n/navigation";
import { useRefreshAfterAppWrites } from "@/lib/http/app-writes";
import { sendStudyAnswer } from "@/lib/session/study-answer-request";
import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type CheckpointActions, CheckpointScreen } from "@zoonk/learn/checkpoint";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";

/**
 * Wires the started checkpoint to the session's answer route and its block finish, in the
 * learner's timezone. Leaving goes to Today; once done, it continues
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
  const router = useRouter();
  useRefreshAfterAppWrites();

  const actions = useMemo<CheckpointActions>(() => {
    const ids = { blockId, sessionId };

    return {
      answer: async (input) => {
        const outcome = await sendStudyAnswer({ ...ids, ...input });

        if (outcome.status !== "answered") {
          router.refresh();
        }

        return outcome.status === "answered"
          ? {
              isCorrect: outcome.feedback.isCorrect,
              reinforcementLessons: outcome.feedback.reinforcementLessons,
              transcript: outcome.feedback.transcript,
            }
          : null;
      },
      finish: async () => {
        const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
        return outcome.status === "finished" ? outcome.moment : null;
      },
    };
  }, [blockId, router, sessionId]);

  const hrefs = useMemo(() => ({ continue: continueHref, exit: "/today" }), [continueHref]);

  return (
    <CheckpointScreen
      actions={actions}
      checkpoint={checkpoint}
      hrefs={hrefs}
      key={checkpoint.questions.map((question) => question.itemId).join(",")}
    />
  );
}
