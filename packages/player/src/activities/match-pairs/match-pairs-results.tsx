"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type MatchCard } from "./match-pairs-columns";

function textOf(side: readonly MatchCard[], id: string | undefined): string {
  return side.find((card) => card.id === id)?.text ?? "";
}

function ResultRow({ children, why }: { children: React.ReactNode; why: string | null }) {
  return (
    <li className="bg-background rounded-2xl border px-3 py-2.5 text-sm leading-snug">
      <p>{children}</p>
      {why && (
        <p className="text-muted-foreground mt-0.5">
          <LessonRichText text={why} />
        </p>
      )}
    </li>
  );
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
          <ul className="flex flex-col gap-2">
            {missed.map((card) => (
              <ResultRow key={card.id} why={card.why}>
                {t("{left} goes with {right}, not {guess}.", {
                  guess: textOf(cards.right, firstTries[card.id]),
                  left: card.text,
                  right: textOf(cards.right, expected[card.id]),
                })}
              </ResultRow>
            ))}
          </ul>
        </section>
      )}

      {traps.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("Look-alikes with no match")}</h3>
          <ul className="flex flex-col gap-2">
            {traps.map((card) => (
              <ResultRow key={card.id} why={card.why}>
                {card.text}
              </ResultRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
