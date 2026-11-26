"use client";

import { useExtracted } from "next-intl";
import { FeedbackExplanation } from "./feedback-panel";
import { type MatchSide, type MatchTry, firstMisses } from "./match-board-state";

const SHOWN_MISSES = 3;

function MissLine({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const t = useExtracted();
  const leftCard = () => <span className="font-medium">{left}</span>;
  const rightCard = () => <span className="font-medium">{right}</span>;

  return (
    <p>
      {t.rich({
        description:
          "Under a matching question's verdict: two cards the learner put together that don't go together. Each tag is a card's own text.",
        message: "You first matched <left></left> with <right></right>.",
        values: { left: leftCard, right: rightCard },
      })}
    </p>
  );
}

/**
 * Under a match board's verdict, the pairs the learner first put together wrong, in words: the
 * solved board above them shows every pair right. One line per card that had a wrong try, its
 * first one, for the first few cards.
 */
export function MatchMisses({
  misses,
  renderCard,
}: {
  misses: readonly MatchTry[];
  renderCard: (side: MatchSide, index: number) => React.ReactNode;
}) {
  const shown = firstMisses(misses).slice(0, SHOWN_MISSES);

  if (shown.length === 0) {
    return null;
  }

  return (
    <FeedbackExplanation className="flex flex-col gap-1" data-slot="match-misses">
      {shown.map((miss) => (
        <MissLine
          key={miss.left}
          left={renderCard("left", miss.left)}
          right={renderCard("right", miss.right)}
        />
      ))}
    </FeedbackExplanation>
  );
}
