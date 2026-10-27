"use client";

import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useRouter } from "@/i18n/navigation";
import { useRefreshAfterAppWrites } from "@/lib/http/app-writes";
import { postToApp } from "@/lib/http/post-to-app";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import {
  type PronunciationAnswerOutcome,
  PronunciationReviewScreen,
} from "@zoonk/learn/language/pronunciation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { finishPronunciationRoundAction } from "./pronunciation-actions";

/**
 * The review round, saved in the learner's timezone so it counts toward their day, with a
 * milestone it earned as its full-screen moment.
 */
export function PronunciationClient({
  buddy,
  reviews,
}: {
  buddy: LearnerBuddy;
  reviews: PronunciationReviewsView;
}) {
  const { bfcacheId } = useRouter();
  useRefreshAfterAppWrites();

  const actions = useMemo(
    () => ({
      answer: ({
        audio,
        durationMs,
        reviewId,
        roundId,
      }: {
        audio: Blob;
        durationMs: number;
        reviewId: string;
        roundId: string;
      }) => {
        const form = new FormData();
        form.set("audio", audio);
        form.set("durationMs", String(durationMs));
        form.set("roundId", roundId);
        form.set("timeZone", getLocalTimeZone());

        return postToApp<PronunciationAnswerOutcome>({
          body: form,
          path: `/api/pronunciation-reviews/${encodeURIComponent(reviewId)}/answers`,
        }).then((outcome): PronunciationAnswerOutcome => outcome ?? { status: "failed" });
      },
      finish: (roundId: string) =>
        finishPronunciationRoundAction(roundId, {
          goalId: reviews.goalId,
          timeZone: getLocalTimeZone(),
        }),
    }),
    [reviews.goalId],
  );

  return (
    /** Fresh link entries start a new round; answer refreshes and history keep the active cohort. */
    <PronunciationReviewScreen
      actions={actions}
      buddy={buddy}
      exitHref="/today"
      key={`${bfcacheId}:${reviews.goalId}`}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
      reviews={reviews}
    />
  );
}
