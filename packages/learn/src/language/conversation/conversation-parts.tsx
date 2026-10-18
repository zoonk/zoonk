"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { MicIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpeechStatusIcon, useSpeechActionLabel } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";

/**
 * The character's initial in a small circle: calls show a person, never a stock face. While they
 * talk, a thin ring around it shows it.
 */
function CharacterAvatar({ name, talking }: { name: string; talking: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-secondary text-secondary-foreground grid size-8 shrink-0 place-items-center rounded-full text-sm font-medium ring-[1.5px] ring-transparent transition-shadow duration-150 motion-reduce:transition-none",
        talking && "ring-foreground/40",
      )}
      data-slot="character-avatar"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Who the learner talks to, in one row at the column's edge: their initial, their name, and who
 * they are ("Landlord · Toronto"), quiet beside it.
 */
export function CharacterRow({
  detail,
  name,
  talking = false,
}: {
  detail: string;
  name: string;
  talking?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3" data-slot="character-row">
      <CharacterAvatar name={name} talking={talking} />
      <p className="text-muted-foreground min-w-0 text-sm leading-snug">
        <span className="text-foreground font-medium">{name}</span>
        {" · "}
        <span>{detail}</span>
      </p>
    </div>
  );
}

/**
 * Why the call can't go on (it didn't connect, it dropped, it ended, or the plan's call time is
 * used), at the column's edge: one title and what to do, never the learner's fault.
 */
export function CallOffMessage({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 py-6", className)} role="alert">
      <p className="text-[1.1875rem] leading-snug font-[560] tracking-[-0.02em] text-balance">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Plays a phrase read aloud in its language; the phrase is on screen if the audio fails. */
export function SpeakButton({
  language,
  personal = false,
  text,
}: {
  language: string;
  /** The learner's own words, read in a clip of theirs alone. */
  personal?: boolean;
  text: string;
}) {
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
          : () => speech.speak({ segments: [{ audioUrl: null, personal, text }] })
      }
      size="icon"
      variant="outline"
    >
      <SpeechStatusIcon idle={<Volume2Icon aria-hidden="true" />} state={speech.state} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

/** How the call hears the learner, in one quiet line at the end of an intro. */
export function MicNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-[0.8125rem] leading-snug text-pretty">
      <LineMarker>
        <MicIcon aria-hidden="true" className="size-3.5" />
      </LineMarker>
      {children}
    </p>
  );
}
