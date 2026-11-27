"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { MissionMoment } from "@zoonk/learn/mission-moment";
import { useCallback, useEffect, useRef, useState } from "react";

/** A moment belongs to the conversation whose question earned it, and shows only there. */
export function useConversationMissionMoment({
  conversationId,
  onMoment,
}: {
  conversationId: string;
  onMoment?: (moment: MissionMomentView) => void;
}) {
  const [latest, setLatest] = useState<{
    conversationId: string;
    moment: MissionMomentView;
  } | null>(null);

  const onMomentRef = useRef(onMoment);

  useEffect(() => {
    onMomentRef.current = onMoment;
  }, [onMoment]);

  const receive = useCallback(
    (next: MissionMomentView | null) => {
      setLatest(next ? { conversationId, moment: next } : null);

      if (next) {
        onMomentRef.current?.(next);
      }
    },
    [conversationId],
  );

  return { moment: latest?.conversationId === conversationId ? latest.moment : null, receive };
}

export function ConversationMissionMoment({ moment }: { moment: MissionMomentView | null }) {
  if (!moment) {
    return null;
  }

  return (
    <MissionMoment
      completed={moment.completed}
      fullMeal={moment.fullMeal}
      missions={moment.missions}
    />
  );
}
