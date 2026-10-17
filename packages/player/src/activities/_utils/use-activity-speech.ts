"use client";

import { type SpokenAudioState, type SpokenText, useSpokenAudio } from "@zoonk/learn/speech";
import { useState } from "react";

const IDLE: SpokenAudioState = { status: "idle" };

/**
 * Speak buttons of one activity that share its voice, one sound at a time: each button shows its
 * own sound loading, playing or failed, and pressing a button while its sound plays stops it.
 */
export function useActivitySpeech(language: string) {
  const speech = useSpokenAudio(language);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const isBusy = speech.state.status === "loading" || speech.state.status === "playing";

  const stateFor = (key: string): SpokenAudioState => (key === activeKey ? speech.state : IDLE);

  const toggle = (key: string, segments: readonly SpokenText[]) => {
    if (key === activeKey && isBusy) {
      speech.cancel();
      return;
    }

    setActiveKey(key);
    speech.speak({ segments });
  };

  return { isAvailable: speech.isAvailable, stateFor, toggle };
}
