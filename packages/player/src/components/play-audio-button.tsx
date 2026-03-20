"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useWordAudio } from "../use-word-audio";

export function PlayAudioButton({
  audioUrl,
  preload = true,
  size = "md",
  variant = "filled",
}: {
  audioUrl: string;
  preload?: boolean;
  size?: "sm" | "md";
  variant?: "filled" | "text";
}) {
  const t = useExtracted();
  const [isPlaying, setIsPlaying] = useState(false);

  const { pause, play } = useWordAudio({
    onEnded: () => setIsPlaying(false),
    preloadUrls: preload ? [audioUrl] : undefined,
  });

  const handleClick = () => {
    if (isPlaying) {
      pause();
      setIsPlaying(false);
    } else {
      play(audioUrl);
      setIsPlaying(true);
    }
  };

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
