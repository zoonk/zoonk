"use client";

import { requestSpeechClip } from "@/lib/speech/speech-clip-request";
import { SpeechPlayerProvider } from "@zoonk/learn/speech/provider";

/**
 * Gives every page's learn screens and lesson player generated speech: clips come from the public
 * API on the learner's tap and one shared element plays them.
 */
export function MainSpeechProvider({ children }: { children: React.ReactNode }) {
  return <SpeechPlayerProvider voice={requestSpeechClip}>{children}</SpeechPlayerProvider>;
}
