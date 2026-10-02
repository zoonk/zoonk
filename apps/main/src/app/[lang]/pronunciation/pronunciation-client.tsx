"use client";

import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import { PronunciationReviewScreen } from "@zoonk/learn/language/pronunciation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { answerPronunciationAction, finishPronunciationRoundAction } from "./pronunciation-actions";

/** The review round, saved in the learner's timezone so it counts toward their day. */
export function PronunciationClient({ reviews }: { reviews: PronunciationReviewsView }) {
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
        form.set("reviewId", reviewId);
        form.set("roundId", roundId);
        form.set("timeZone", getLocalTimeZone());
        return answerPronunciationAction(form);
      },
      finish: (roundId: string) =>
        finishPronunciationRoundAction(roundId, {
          goalId: reviews.goalId,
          timeZone: getLocalTimeZone(),
        }),
    }),
    [reviews.goalId],
  );

  return <PronunciationReviewScreen actions={actions} exitHref="/today" reviews={reviews} />;
}
