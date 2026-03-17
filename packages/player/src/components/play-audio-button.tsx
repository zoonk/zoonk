"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useWordAudio } from "../use-word-audio";

export function PlayAudioButton({
  audioUrl,
  size = "md",
}: {
  audioUrl: string;
  size?: "xs" | "sm" | "md";
}) {
  const t = useExtracted();
  const [isPlaying, setIsPlaying] = useState(false);
  const { pause, play } = useWordAudio({ onEnded: () => setIsPlaying(false) });

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

  return (
    <button
      aria-label={label}
      className={cn(
        "bg-primary text-primary-foreground flex items-center justify-center rounded-full transition-all duration-150",
        "hover:bg-primary/90 focus-visible:ring-ring/50 outline-none hover:scale-105 focus-visible:ring-[3px] active:scale-95",
        size === "md" && "size-14",
        size === "sm" && "size-12",
        size === "xs" && "size-8",
      )}
      onClick={handleClick}
      type="button"
    >
      <Icon
        className={cn(
          size === "md" && "size-6",
          size === "sm" && "size-5",
          size === "xs" && "size-4",
        )}
      />
    </button>
  );
}
