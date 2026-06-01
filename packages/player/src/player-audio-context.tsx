"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWordAudio } from "./use-word-audio";

type PlayerAudioContextValue = {
  audioUrl: string | null;
  isPlaying: boolean;
  toggleAudio: (audioUrl: string) => void;
};

const PlayerAudioContext = createContext<PlayerAudioContextValue | null>(null);

/**
 * Shares the active step's main audio prompt between duplicate controls.
 *
 * Vocabulary, alphabet, and listening screens can show the same play action in
 * the step content and in the mobile bottom bar. Keeping playback here makes
 * those controls reflect the same playing state instead of creating two
 * independent audio elements for one prompt.
 */
export function PlayerAudioProvider({
  audioUrl,
  children,
}: {
  audioUrl: string | null;
  children: React.ReactNode;
}) {
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const { pause, play } = useWordAudio({
    onEnded: () => setPlayingAudioUrl(null),
    preloadUrls: audioUrl ? [audioUrl] : undefined,
  });

  const isPlaying = Boolean(audioUrl && playingAudioUrl === audioUrl);

  const toggleAudio = useCallback(
    (targetAudioUrl: string) => {
      if (playingAudioUrl === targetAudioUrl) {
        pause();
        setPlayingAudioUrl(null);
        return;
      }

      play(targetAudioUrl);
      setPlayingAudioUrl(targetAudioUrl);
    },
    [pause, play, playingAudioUrl],
  );

  const value = useMemo(
    () => ({ audioUrl, isPlaying, toggleAudio }),
    [audioUrl, isPlaying, toggleAudio],
  );

  return <PlayerAudioContext value={value}>{children}</PlayerAudioContext>;
}

/**
 * Returns shared prompt-audio controls when a button targets the active step.
 *
 * Buttons outside the active step, such as word-bank option sounds, should keep
 * their local playback hook. Returning null lets those buttons continue using
 * their existing standalone behavior.
 */
export function useSharedPlayerAudio(audioUrl: string) {
  const context = useContext(PlayerAudioContext);

  if (context?.audioUrl !== audioUrl) {
    return null;
  }

  return { isPlaying: context.isPlaying, toggle: () => context.toggleAudio(audioUrl) };
}
