"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { MissionMoment } from "@zoonk/learn/mission-moment";
import { useCallback, useEffect, useRef, useState } from "react";

export function useConversationMissionMoment({
  goalId,
  onMoment,
}: {
  goalId: string;
  onMoment?: (moment: MissionMomentView) => void;
}) {
  const [latest, setLatest] = useState<{ goalId: string; moment: MissionMomentView } | null>(null);

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
    <MissionMoment
      buddyName={buddyName}
      completed={moment.completed}
      fullMeal={moment.fullMeal}
      missions={moment.missions}
    />
  );
}
