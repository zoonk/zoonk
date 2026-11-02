"use client";

import { Button } from "@zoonk/ui/components/button";
import { Kbd, ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { AUDIO_KEY, useAudioKey } from "@zoonk/ui/hooks/keyboard";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PromptAudio } from "../player-audio-context";

export function PromptAudioButton({
  audio,
  variant,
}: {
  audio: PromptAudio;
  variant: "icon" | "inline" | "labeled";
}) {
  const t = useExtracted();
  const Icon = audio.isPlaying ? PauseIcon : Volume2Icon;
  const label = audio.isPlaying ? t("Pause pronunciation") : t("Play pronunciation");
  const shortcut = AUDIO_KEY.toUpperCase();
  const audioKey = useAudioKey(audio.toggle);

  const shared = {
    ...audioKey,
    "aria-label": label,
    onClick: audio.toggle,
    type: "button",
  } as const;

  if (variant === "labeled") {
    return (
      <Button {...shared} className="w-fit" size="lg" variant="outline">
        <Icon aria-hidden="true" />
        {audio.isPlaying ? t("Pause") : t("Play")}
        <ShortcutKbd>{shortcut}</ShortcutKbd>
      </Button>
    );
  }

  const inline = variant === "inline";
  const inlineTone = audio.isPlaying ? "bg-muted text-foreground" : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger
        {...shared}
        render={
          <Button
            className={inline ? inlineTone : "size-11"}
            size="icon"
            variant={inline ? "ghost" : "outline"}
          />
        }
      >
        <Icon aria-hidden="true" className={inline ? "size-5" : undefined} />
      </TooltipTrigger>

      <TooltipContent>
        {label}
        <Kbd className="ms-2">{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
