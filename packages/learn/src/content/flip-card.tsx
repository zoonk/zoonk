"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type ContentCard } from "./content-context";

/** Area tones for the cards' gradients; each group keeps its own color. */
const CARD_TONES = [
  "fun-card-indigo",
  "fun-card-emerald",
  "fun-card-orange",
  "fun-card-pink",
  "fun-card-cyan",
  "fun-card-violet",
  "fun-card-amber",
  "fun-card-teal",
] as const;

export function getCardTone(index: number): string {
  return CARD_TONES[index % CARD_TONES.length] ?? CARD_TONES[0];
}

function CardChip({ card }: { card: ContentCard }) {
  const t = useExtracted();

  if (card.state === "mastered") {
    return (
      <span className="bg-fun-gold text-fun-lime-foreground rounded-full px-2 py-0.5 text-xs font-bold">
        {t("gold")}
      </span>
    );
  }

  if (card.fading) {
    return <span className="fun-glass rounded-full px-2 py-0.5 text-xs">{t("fading")}</span>;
  }

  return card.state === "new" ? (
    <span className="bg-fun-lime text-fun-lime-foreground rounded-full px-2 py-0.5 text-xs font-bold">
      {t("new")}
    </span>
  ) : null;
}

/**
 * A study card: the idea on the front and an example on the back; tapping flips it. It dims as
 * memory fades and turns gold when it's remembered on three different days. Reduced motion swaps
 * the flip for a fade.
 */
export function FlipCard({ card, tone }: { card: ContentCard; tone: string }) {
  const t = useExtracted();
  const [flipped, setFlipped] = useState(false);
  const back = card.example ?? card.description ?? card.name;

  return (
    <button
      aria-label={flipped ? t("{skill}, back of the card", { skill: card.name }) : card.name}
      aria-pressed={flipped}
      className={cn(
        "fun-card focus-visible:ring-fun-fg focus-visible:ring-offset-background relative flex aspect-4/5 w-full flex-col justify-between rounded-2xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,opacity] motion-safe:duration-300",
        tone,
        card.fading && card.state !== "mastered" && "opacity-60",
        card.state === "mastered" && "ring-fun-gold shadow-[0_0_18px_-4px_var(--fun-gold)] ring-2",
        flipped && "motion-safe:transform-[rotateY(180deg)]",
      )}
      data-flipped={flipped}
      data-state={card.state}
      onClick={() => setFlipped((value) => !value)}
      type="button"
    >
      <span
        className={cn(
          "flex h-full w-full flex-col justify-between gap-2",
          flipped && "motion-safe:transform-[rotateY(180deg)]",
        )}
      >
        {flipped ? (
          <span className="line-clamp-6 text-sm leading-snug">{back}</span>
        ) : (
          <>
            <span className="self-start">
              <CardChip card={card} />
            </span>
            <span className="line-clamp-4 text-sm leading-snug font-bold">{card.name}</span>
          </>
        )}
      </span>
    </button>
  );
}
