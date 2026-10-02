"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type openCallAudio } from "./live-call-session";

type CallAudio = Awaited<ReturnType<typeof openCallAudio>>;

/**
 * The call's microphone: open for the whole call, closed when the call fails or ends and when the
 * screen closes, even a screen left while the call was still opening. It must not close when the
 * session is set: that would cut the audio GPT-Live needs before it says a word.
 */
export function useCallMicrophone() {
  const [blocked, setBlocked] = useState(false);
  const stopAudio = useRef<(() => void) | null>(null);
  const screenClosed = useRef(false);

  /** Keeps the audio for the call; false when the screen closed meanwhile, and the audio with it. */
  const keep = useCallback((audio: CallAudio): boolean => {
    if (screenClosed.current) {
      audio.stop();
      return false;
    }

    stopAudio.current = audio.stop;
    setBlocked(audio.blocked);
    return true;
  }, []);

  const stop = useCallback(() => stopAudio.current?.(), []);

  useEffect(
    () => () => {
      screenClosed.current = true;
      stopAudio.current?.();
    },
    [],
  );

  return { blocked, keep, stop };
}
