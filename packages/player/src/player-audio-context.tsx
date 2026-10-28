"use client";

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
import { useWordAudio } from "./use-word-audio";

type PlayerAudioContextValue = {
  audioUrl: string | null;
  isPlaying: boolean;
  toggleAudio: (audioUrl: string) => void;
};

const PlayerAudioContext = createContext<PlayerAudioContextValue | null>(null);

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
  const hasHandledAudioPromptRef = useRef(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const { pause, play } = useWordAudio({
    onEnded: () => setPlayingAudioUrl(null),
    preloadUrls: audioUrl ? [audioUrl] : undefined,
  });

  const isPlaying = Boolean(audioUrl && playingAudioUrl === audioUrl);

  const startAudio = useCallback(
    async ({
      shouldEnableAutoplay,
      targetAudioUrl,
    }: {
      shouldEnableAutoplay: boolean;
      targetAudioUrl: string;
    }) => {
      hasHandledAudioPromptRef.current = true;

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
        hasHandledAudioPromptRef.current = true;
        setPlayingAudioUrl(null);
        return;
      }

      void startAudio({ shouldEnableAutoplay: true, targetAudioUrl });
    },
    [pause, playingAudioUrl, startAudio],
  );

  usePlayerAudioKeyboardShortcut({ audioUrl, onToggleAudio: toggleAudio });

  useEffect(() => {
    if (!audioUrl || !autoPlayAudio || hasHandledAudioPromptRef.current) {
      return;
    }

    void startAudio({ shouldEnableAutoplay: false, targetAudioUrl: audioUrl });

    return () => {
      hasHandledAudioPromptRef.current = false;
    };
  }, [audioUrl, autoPlayAudio, startAudio]);

  const value = useMemo(
    () => ({ audioUrl, isPlaying, toggleAudio }),
    [audioUrl, isPlaying, toggleAudio],
  );

  return <PlayerAudioContext value={value}>{children}</PlayerAudioContext>;
}

/** Use local playback for option sounds; this hook shares controls only for the active prompt. */
export function useSharedPlayerAudio(audioUrl: string) {
  const context = useContext(PlayerAudioContext);

  if (context?.audioUrl !== audioUrl) {
    return null;
  }

  return { isPlaying: context.isPlaying, toggle: () => context.toggleAudio(audioUrl) };
}

export function usePromptAudioUrl(): string | null {
  return useContext(PlayerAudioContext)?.audioUrl ?? null;
}

function usePlayerAudioKeyboardShortcut({
  audioUrl,
  onToggleAudio,
}: {
  audioUrl: string | null;
  onToggleAudio: (audioUrl: string) => void;
}) {
  useKeyboardCallback(
    PLAYER_AUDIO_KEYBOARD_SHORTCUT,
    () => {
      if (!audioUrl) {
        return false;
      }

      onToggleAudio(audioUrl);
    },
    { mode: "none", screen: true },
  );
}
