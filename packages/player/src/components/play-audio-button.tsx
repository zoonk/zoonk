"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useSharedPlayerAudio } from "../player-audio-context";
import { PLAYER_AUDIO_KEYBOARD_SHORTCUT } from "../player-shortcuts";
import { useWordAudio } from "../use-word-audio";

/**
 * Picks the shared player audio controller when this button represents the
 * active step prompt, otherwise falls back to a local controller. That keeps
 * duplicate prompt buttons synchronized while preserving standalone audio
 * buttons in other contexts.
 */
function usePlayAudioButtonState({ audioUrl, preload }: { audioUrl: string; preload: boolean }) {
  const sharedAudio = useSharedPlayerAudio(audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);

  const { pause, play } = useWordAudio({
    onEnded: () => setIsPlaying(false),
    preloadUrls: preload && !sharedAudio ? [audioUrl] : undefined,
  });

  if (sharedAudio) {
    return {
      handleClick: sharedAudio.toggle,
      isPlaying: sharedAudio.isPlaying,
      keyboardShortcut: PLAYER_AUDIO_KEYBOARD_SHORTCUT,
    };
  }

  return {
    handleClick: () => {
      if (isPlaying) {
        pause();
        setIsPlaying(false);
        return;
      }

      void play(audioUrl).then((playbackStatus) => {
        if (playbackStatus === "started") {
          setIsPlaying(true);
        }
      });
    },
    isPlaying,
    keyboardShortcut: undefined,
  };
}

/**
 * Plays a prompt's sound, as an outline button 44px tall. `icon` is the bare speaker beside the
 * lesson's next action; `labeled` says "Play" (or "Pause") beside it, with its key on a keyboard,
 * for a listening question whose sentence is the prompt.
 */
export function PlayAudioButton({
  audioUrl,
  className,
  preload = true,
  variant,
}: {
  audioUrl: string;
  className?: string;
  preload?: boolean;
  variant: "icon" | "labeled";
}) {
  const t = useExtracted();

  const { handleClick, isPlaying, keyboardShortcut } = usePlayAudioButtonState({
    audioUrl,
    preload,
  });

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause pronunciation") : t("Play pronunciation");

  if (variant === "icon") {
    return (
      <Button
        aria-keyshortcuts={keyboardShortcut}
        aria-label={label}
        className={cn("size-11", className)}
        onClick={handleClick}
        size="icon"
        type="button"
        variant="outline"
      >
        <Icon aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      aria-keyshortcuts={keyboardShortcut}
      aria-label={label}
      className={cn("w-fit", className)}
      onClick={handleClick}
      size="lg"
      type="button"
      variant="outline"
    >
      <Icon aria-hidden="true" />
      {isPlaying ? t("Pause") : t("Play")}
      {keyboardShortcut && <ShortcutKbd>{keyboardShortcut.toUpperCase()}</ShortcutKbd>}
    </Button>
  );
}
