"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useCanRecord } from "@zoonk/ui/hooks/voice-recorder";
import { useLessonPlayerConfig } from "./lesson-player-context";

/**
 * A speaking screen is answered aloud, or by its listening fallback when the learner can't talk.
 * With neither, there is no way to answer it: typing the sentence shown would only copy it.
 */
export function getSpokenAnswerMode({
  canListen,
  canSpeak,
  cantTalk,
}: {
  canListen: boolean;
  canSpeak: boolean;
  cantTalk: boolean;
}): "listen" | "speak" | null {
  if (canSpeak && !cantTalk) {
    return "speak";
  }

  return canListen ? "listen" : null;
}

/** Null until the page is in the browser, where whether it can record is known. */
export function useCanSpeak(): boolean | null {
  const { adapters, canRecordSpokenAnswer } = useLessonPlayerConfig();
  const isMounted = useIsMounted();
  const canRecord = useCanRecord();

  if (!isMounted) {
    return null;
  }

  return (Boolean(adapters.gradeSpokenAnswer) || Boolean(canRecordSpokenAnswer)) && canRecord;
}
