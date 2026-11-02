"use client";

import { useSpeechPlayer } from "@zoonk/learn/speech/provider";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PLAYER_AUDIO_KEYBOARD_SHORTCUT } from "./player-shortcuts";
import { useAudioPreload } from "./use-audio-preload";

export type PromptAudio = { isPlaying: boolean; toggle: () => void };

const PlayerAudioContext = createContext<PromptAudio | null>(null);

/**
 * Plays the screen's prompt (a word, a letter, a listening sentence) once each time the screen
 * shows, through the app's one speech element, so a browser that blocked it leaves the play buttons
 * at rest until the learner taps one.
 */
export function PlayerAudioProvider({
  audioUrl,
  children,
}: {
  audioUrl: string | null;
  children: React.ReactNode;
}) {
  const player = useSpeechPlayer();
  const ownerRef = useRef({});
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceFor = useAudioPreload([audioUrl]);

  const start = useCallback(() => {
    if (!player || !audioUrl) {
      return;
    }

    void player
      .play({
        onStart: () => setIsPlaying(true),
        owner: ownerRef.current,
        rate: 1,
        url: sourceFor(audioUrl),
      })
      .then(() => setIsPlaying(false));
  }, [audioUrl, player, sourceFor]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      player?.stop(ownerRef.current);
      return;
    }

    start();
  }, [isPlaying, player, start]);

  useEffect(() => {
    const owner = ownerRef.current;
    start();
    return () => player?.stop(owner);
  }, [player, start]);

  useKeyboardCallback(
    PLAYER_AUDIO_KEYBOARD_SHORTCUT,
    () => {
      if (!audioUrl || !player) {
        return false;
      }

      toggle();
    },
    { mode: "none", screen: true },
  );

  const value = useMemo(
    () => (audioUrl && player ? { isPlaying, toggle } : null),
    [audioUrl, isPlaying, player, toggle],
  );

  return <PlayerAudioContext value={value}>{children}</PlayerAudioContext>;
}

export function usePromptAudio(): PromptAudio | null {
  return useContext(PlayerAudioContext);
}
