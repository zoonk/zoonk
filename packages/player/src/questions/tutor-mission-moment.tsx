"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { MissionMoment } from "@zoonk/learn/mission-moment";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the latest question in a goal's conversation did to the day's missions: kept with that
 * goal, so another goal's conversation never shows it, and replaced by the next question's (null
 * when it completed none). A moment is passed on to the host (`onMoment`), which reads its day
 * again.
 */
export function useConversationMissionMoment({
  goalId,
  onMoment,
}: {
  goalId: string;
  onMoment?: (moment: MissionMomentView) => void;
}) {
  const [latest, setLatest] = useState<{ goalId: string; moment: MissionMomentView } | null>(null);

  // The host's handler can change each render; the conversation's host keeps one `receive`.
  const onMomentRef = useRef(onMoment);

  useEffect(() => {
    onMomentRef.current = onMoment;
  }, [onMoment]);

  const receive = useCallback(
    (next: MissionMomentView | null) => {
      setLatest(next ? { goalId, moment: next } : null);

      if (next) {
        onMomentRef.current?.(next);
      }
    },
    [goalId],
  );

  return { moment: latest?.goalId === goalId ? latest.moment : null, receive };
}

/** Asking was one of the day's missions: the conversation says so after the question. */
export function ConversationMissionMoment({
  buddyName,
  moment,
}: {
  buddyName: string;
  moment: MissionMomentView | null;
}) {
  if (!moment) {
    return null;
  }

  return (
    <div className="ring-border rounded-xl px-4 py-3.5 ring-1">
      <MissionMoment
        buddyName={buddyName}
        completed={moment.completed}
        fullMeal={moment.fullMeal}
        missions={moment.missions}
      />
    </div>
  );
}
