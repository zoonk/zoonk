"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useSharedPlayerAudio } from "../player-audio-context";
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
    return { handleClick: sharedAudio.toggle, isPlaying: sharedAudio.isPlaying };
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
  };
}

export function PlayAudioButton({
  audioUrl,
  preload = true,
  size = "md",
  variant = "filled",
}: {
  audioUrl: string;
  preload?: boolean;
  size?: "sm" | "md";
  variant?: PlayAudioButtonVariant;
}) {
  const t = useExtracted();
  const { handleClick, isPlaying } = usePlayAudioButtonState({ audioUrl, preload });

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause pronunciation") : t("Play pronunciation");

  if (variant === "text") {
    return (
      <button
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        onClick={handleClick}
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
        onClick={handleClick}
        size={size === "md" ? "icon-lg" : "icon"}
        type="button"
        variant="outline"
      >
        <Icon aria-hidden className={size === "md" ? "size-5" : "size-4"} />
      </Button>
    );
  }

  return (
    <button
      aria-label={label}
      className={cn(
        "bg-primary text-primary-foreground flex items-center justify-center rounded-full transition-all duration-150",
        "hover:bg-primary/90 focus-visible:ring-ring/50 outline-none hover:scale-105 focus-visible:ring-[3px] active:scale-95",
        size === "md" ? "size-14" : "size-12",
      )}
      onClick={handleClick}
      type="button"
    >
      <Icon className={size === "md" ? "size-6" : "size-5"} />
    </button>
  );
}
