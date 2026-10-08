"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpeechStatusIcon, useSpeechActionLabel } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";

/**
 * The character's initial in a circle: calls show a person, never a stock face. While they talk, a
 * quiet ring shows it.
 */
export function CharacterAvatar({
  name,
  size = "md",
  talking = false,
}: {
  name: string;
  size?: "lg" | "md";
  talking?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-foreground ring-foreground/0 ring-offset-background grid shrink-0 place-items-center rounded-full font-semibold ring-4 ring-offset-2 transition-shadow duration-300",
        size === "lg" ? "size-20 text-3xl" : "size-11 text-lg",
        talking && "ring-foreground/15",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Plays a phrase read aloud in its language; the phrase is on screen if the audio fails. */
export function SpeakButton({ language, text }: { language: string; text: string }) {
  const t = useExtracted();
  const speech = useSpokenAudio(language);
  const { status } = speech.state;
  const label = useSpeechActionLabel(speech.state, t("Listen to {text}", { text }));

  if (!speech.isAvailable) {
    return null;
  }

  return (
    <Button
      aria-busy={status === "loading"}
      className="shrink-0"
      onClick={
        status === "loading" || status === "playing"
          ? speech.cancel
          : () => speech.speak({ segments: [text] })
      }
      size="icon"
      variant="outline"
    >
      <SpeechStatusIcon idle={<Volume2Icon aria-hidden="true" />} state={speech.state} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
