"use client";

import { useExtracted } from "next-intl";
import { ActivityReason, ActivityReasons } from "../_components/activity-reasons";
import { type MatchCard } from "./match-pairs-columns";

function textOf(side: readonly MatchCard[], id: string | undefined): string {
  return side.find((card) => card.id === id)?.text ?? "";
}

/**
 * After the check: the pairs whose first try was wrong, with the right match and why, then the
 * look-alike traps and what they really mean. The right match per pair comes from code.
 */
export function MatchPairsResults({
  cards,
  expected,
  firstTries,
}: {
  cards: { left: readonly MatchCard[]; right: readonly MatchCard[] };
  expected: Readonly<Record<string, string>>;
  firstTries: Readonly<Record<string, string>>;
}) {
  const t = useExtracted();

  const missed = cards.left.filter(
    (card) => !card.isTrap && firstTries[card.id] !== expected[card.id],
  );

  const traps = [...cards.left, ...cards.right].filter((card) => card.isTrap);

  if (missed.length === 0 && traps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" data-slot="match-pairs-results">
      {missed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("Missed on the first try")}</h3>
          <ActivityReasons>
            {missed.map((card) => (
              <ActivityReason key={card.id} why={card.why}>
                {t("{left} goes with {right}, not {guess}.", {
                  guess: textOf(cards.right, firstTries[card.id]),
                  left: card.text,
                  right: textOf(cards.right, expected[card.id]),
                })}
              </ActivityReason>
            ))}
          </ActivityReasons>
        </section>
      )}

      {traps.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("Look-alikes with no match")}</h3>
          <ActivityReasons>
            {traps.map((card) => (
              <ActivityReason key={card.id} why={card.why}>
                {card.text}
              </ActivityReason>
            ))}
          </ActivityReasons>
        </section>
      )}
    </div>
  );
}
