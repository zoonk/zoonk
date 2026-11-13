"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpeechStatusIcon, useSpeechActionLabel } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";

export const CALL_MARK_CLASS =
  "grid size-8 shrink-0 place-items-center rounded-full [&>svg]:size-4";

/**
 * Whoever has the turn gets a line just inside the mark's edge, with a gap before its fill. It is
 * drawn inside the mark's 32px, so the mark never grows past its column.
 */
export function callTurnClass(hasTurn: boolean) {
  return cn(
    "ring-[3.5px] inset-ring-[1.5px] transition-shadow duration-150 ring-inset motion-reduce:transition-none",
    hasTurn
      ? "inset-ring-foreground/40 ring-background"
      : "ring-transparent inset-ring-transparent",
  );
}

export function CharacterAvatar({ name, talking }: { name: string; talking: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        CALL_MARK_CLASS,
        "bg-secondary text-secondary-foreground text-sm font-medium",
        callTurnClass(talking),
      )}
      data-slot="character-avatar"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

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

/** A whole screen saying a call can't go on. Inside a sheet or under another title, use `CallReason`. */
export function CallOffMessage({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col gap-2" role="alert">
      <p className="text-title">{title}</p>
      {children}
    </div>
  );
}

/** Why a call can't go on, under its screen's or its sheet's own title. */
export function CallReason({
  children,
  className,
  role,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  role?: "alert";
  title: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)} role={role}>
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

export function SpeakButton({
  language,
  personal = false,
  text,
}: {
  language: string;
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

export function SoundNote() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-compact flex items-start gap-3 leading-snug text-pretty">
      <LineMarker className="w-4 justify-center">
        <Volume2Icon aria-hidden="true" className="size-3.5" />
      </LineMarker>
      {t("Turn your sound on.")}
    </p>
  );
}
