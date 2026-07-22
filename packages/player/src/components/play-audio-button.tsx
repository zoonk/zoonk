"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PointerEvent, useState } from "react";
import { useSharedPlayerAudio } from "../player-audio-context";
import { renderPlayerShortcutHintKey, showPlayerShortcutHint } from "../player-shortcut-hint";
import { PLAYER_AUDIO_KEYBOARD_SHORTCUT } from "../player-shortcuts";
import { useWordAudio } from "../use-word-audio";

type PlayAudioButtonVariant = "filled" | "outline" | "text";

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

export function PlayAudioButton({
  audioUrl,
  className,
  preload = true,
  size = "md",
  variant = "filled",
}: {
  audioUrl: string;
  className?: string;
  preload?: boolean;
  size?: "sm" | "md";
  variant?: PlayAudioButtonVariant;
}) {
  const t = useExtracted();

  const { handleClick, isPlaying, keyboardShortcut } = usePlayAudioButtonState({
    audioUrl,
    preload,
  });

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause pronunciation") : t("Play pronunciation");

  /**
   * Only active prompt audio has a player keyboard shortcut. Standalone word
   * audio keeps its normal click behavior without advertising a key that does
   * not control it.
   */
  function handleAudioPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (keyboardShortcut) {
      showPlayerShortcutHint({
        event,
        hint: "promptAudio",
        message: t.rich("Keyboard shortcut: press <kbd>{shortcut}</kbd> to play audio.", {
          kbd: renderPlayerShortcutHintKey,
          shortcut: keyboardShortcut.toUpperCase(),
        }),
      });
    }
  }

  if (variant === "text") {
    return (
      <button
        aria-keyshortcuts={keyboardShortcut}
        className={cn(
          "text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors",
          className,
        )}
        onClick={handleClick}
        onPointerUp={handleAudioPointerUp}
        type="button"
      >
        <Icon aria-hidden className="size-4" />
        {label}
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <Button
        aria-label={label}
        aria-keyshortcuts={keyboardShortcut}
        className={cn("relative", className)}
        onClick={handleClick}
        onPointerUp={handleAudioPointerUp}
        size={size === "md" ? "icon-lg" : "icon"}
        type="button"
        variant="outline"
      >
        <Icon aria-hidden className={size === "md" ? "size-5" : "size-4"} />

        {keyboardShortcut && (
          <ShortcutKbd variant="badge">{keyboardShortcut.toUpperCase()}</ShortcutKbd>
        )}
      </Button>
    );
  }

  return (
    <button
      aria-label={label}
      aria-keyshortcuts={keyboardShortcut}
      className={cn(
        "bg-primary text-primary-foreground relative flex items-center justify-center rounded-full transition-all duration-150",
        "hover:bg-primary/90 focus-visible:ring-ring/50 outline-none hover:scale-105 focus-visible:ring-[3px] active:scale-95",
        size === "md" ? "size-14" : "size-12",
        className,
      )}
      onClick={handleClick}
      onPointerUp={handleAudioPointerUp}
      type="button"
    >
      <Icon className={size === "md" ? "size-6" : "size-5"} />

      {keyboardShortcut && (
        <ShortcutKbd variant="badge">{keyboardShortcut.toUpperCase()}</ShortcutKbd>
      )}
    </button>
  );
}
