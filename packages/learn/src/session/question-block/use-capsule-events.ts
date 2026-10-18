"use client";

import { MS_PER_DAY } from "@zoonk/utils/date";
import { useEffect, useRef } from "react";
import { useLearnAnalytics } from "../../learn-context";
import { type StudyBlockDetail } from "../session-types";

/** Days since the capsule's ideas were last answered, which is when it was sealed. */
function getDaysSinceSealed({
  capsuleKey,
  detail,
  now,
}: {
  capsuleKey: string;
  detail: StudyBlockDetail;
  now: number;
}): number {
  const answeredAt = detail.questions.flatMap((question) =>
    question.capsuleKey === capsuleKey && question.timeMachine
      ? [question.timeMachine.answeredAt.getTime()]
      : [],
  );

  return answeredAt.length > 0 ? Math.floor((now - Math.max(...answeredAt)) / MS_PER_DAY) : 0;
}

/** Each capsule opened in a finished review block counts once. */
export function useCapsuleEvents({
  detail,
  finished,
}: {
  detail: StudyBlockDetail;
  finished: boolean;
}) {
  const analytics = useLearnAnalytics();
  const sent = useRef(false);

  useEffect(() => {
    if (!finished || sent.current || detail.block.kind !== "review") {
      return;
    }

    sent.current = true;
    const now = Date.now();

    for (const capsule of detail.block.capsules) {
      analytics.track({
        name: "Capsule Opened",
        properties: {
          days_since_sealed: getDaysSinceSealed({ capsuleKey: capsule.key, detail, now }),
          lesson_id: capsule.lessonId,
        },
      });
    }
  }, [analytics, detail, finished]);
}
