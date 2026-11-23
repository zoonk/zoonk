"use client";

import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { useExtracted } from "next-intl";
import { ActivityReason, ActivityReasons } from "../_components/activity-reasons";
import { type MatchCard } from "./match-pairs-columns";

function textOf(side: readonly MatchCard[], id: string | undefined): string {
  return side.find((card) => card.id === id)?.text ?? "";
}

function MissedPair({ guess, left, right }: { guess: string; left: string; right: string }) {
  const t = useExtracted();
  const guessText = () => <LessonRichText text={guess} />;
  const leftText = () => <LessonRichText text={left} />;
  const rightText = () => <LessonRichText text={right} />;

  if (!guess) {
    return (
      <>
        {leftText()}
        {" → "}
        {rightText()}
      </>
    );
  }

  return t.rich("<left></left> goes with <right></right>, not <guess></guess>.", {
    guess: guessText,
    left: leftText,
    right: rightText,
  });
}

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

  const missed = cards.left.filter((card) => firstTries[card.id] !== expected[card.id]);

  if (missed.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2" data-slot="match-pairs-results">
      <h3 className="text-sm font-semibold">{t("Missed on the first try")}</h3>
      <ActivityReasons>
        {missed.map((card) => (
          <ActivityReason key={card.id} why={card.why}>
            <MissedPair
              guess={textOf(cards.right, firstTries[card.id])}
              left={card.text}
              right={textOf(cards.right, expected[card.id])}
            />
          </ActivityReason>
        ))}
      </ActivityReasons>
    </section>
  );
}
