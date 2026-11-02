"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { AUDIO_KEY, useAudioKey } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { useSharedPlayerAudio } from "../player-audio-context";
import { useWordAudio } from "../use-word-audio";

function usePlayAudioButtonState({ audioUrl, preload }: { audioUrl: string; preload: boolean }) {
  const sharedAudio = useSharedPlayerAudio(audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);

  const { pause, play } = useWordAudio({
    onEnded: () => setIsPlaying(false),
    preloadUrls: preload && !sharedAudio ? [audioUrl] : undefined,
  });

  useEffect(() => () => setIsPlaying(false), []);

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

  const { handleClick, isPlaying } = usePlayAudioButtonState({ audioUrl, preload });
  const audioKey = useAudioKey(handleClick);

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause pronunciation") : t("Play pronunciation");

  if (variant === "icon") {
    return (
      <Button
        {...audioKey}
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
      {...audioKey}
      aria-label={label}
      className={cn("w-fit", className)}
      onClick={handleClick}
      size="lg"
      type="button"
      variant="outline"
    >
      <Icon aria-hidden="true" />
      {isPlaying ? t("Pause") : t("Play")}
      <ShortcutKbd>{AUDIO_KEY.toUpperCase()}</ShortcutKbd>
    </Button>
  );
}
