"use client";

import { requestSpeechClip } from "@/lib/speech/speech-clip-request";
import { SpeechPlayerProvider } from "@zoonk/learn/speech/provider";

export function MainSpeechProvider({ children }: { children: React.ReactNode }) {
  return <SpeechPlayerProvider voice={requestSpeechClip}>{children}</SpeechPlayerProvider>;
}
