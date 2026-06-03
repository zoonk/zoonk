"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  autoPlayAudio,
  children,
  onAutoPlayAudioEnabled,
}: {
  audioUrl: string | null;
  autoPlayAudio: boolean;
  children: React.ReactNode;
  onAutoPlayAudioEnabled: () => void;
}) {
  const [hasHandledAudioPrompt, setHasHandledAudioPrompt] = useState(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const { pause, play } = useWordAudio({
    onEnded: () => setPlayingAudioUrl(null),
    preloadUrls: audioUrl ? [audioUrl] : undefined,
  });

  const isPlaying = Boolean(audioUrl && playingAudioUrl === audioUrl);

  /**
   * Starts the active prompt and records that this step already had its automatic
   * or manual playback attempt. That prevents an opt-in click or pause from
   * immediately triggering another autoplay attempt for the same prompt.
   */
  const startAudio = useCallback(
    async ({
      shouldEnableAutoplay,
      targetAudioUrl,
    }: {
      shouldEnableAutoplay: boolean;
      targetAudioUrl: string;
    }) => {
      setHasHandledAudioPrompt(true);

      const playbackStatus = await play(targetAudioUrl);

      if (playbackStatus === "failed") {
        setPlayingAudioUrl(null);
        return;
      }

      setPlayingAudioUrl(targetAudioUrl);

      if (shouldEnableAutoplay) {
        onAutoPlayAudioEnabled();
      }
    },
    [onAutoPlayAudioEnabled, play],
  );

  const toggleAudio = useCallback(
    (targetAudioUrl: string) => {
      if (playingAudioUrl === targetAudioUrl) {
        pause();
        setHasHandledAudioPrompt(true);
        setPlayingAudioUrl(null);
        return;
      }

      void startAudio({ shouldEnableAutoplay: true, targetAudioUrl });
    },
    [pause, playingAudioUrl, startAudio],
  );

  useEffect(() => {
    if (!audioUrl || !autoPlayAudio || hasHandledAudioPrompt || isPlaying) {
      return;
    }

    void startAudio({ shouldEnableAutoplay: false, targetAudioUrl: audioUrl });
  }, [audioUrl, autoPlayAudio, hasHandledAudioPrompt, isPlaying, startAudio]);

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
