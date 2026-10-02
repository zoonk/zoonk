"use client";

import { Button } from "@zoonk/ui/components/button";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";

/** The character's initial in a circle: calls show a person, never a stock face. */
export function CharacterAvatar({ name, size = "md" }: { name: string; size?: "lg" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-foreground in-data-[mode=fun]:bg-fun-accent-violet/30 in-data-[mode=fun]:text-fun-fg grid shrink-0 place-items-center rounded-full font-semibold",
        size === "lg" ? "size-20 text-3xl" : "size-11 text-lg",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Plays a phrase with the device's voice for the language; hidden where there's none. */
export function SpeakButton({ language, text }: { language: string; text: string }) {
  const t = useExtracted();
  const isMounted = useIsMounted();

  if (!isMounted || globalThis.speechSynthesis === undefined) {
    return null;
  }

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  };

  return (
    <Button
      className="in-data-[mode=fun]:fun-glass shrink-0"
      onClick={speak}
      size="icon"
      variant="outline"
    >
      <Volume2Icon aria-hidden="true" />
      <span className="sr-only">{t("Listen to {text}", { text })}</span>
    </Button>
  );
}
