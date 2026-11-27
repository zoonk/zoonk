"use client";

import { ArrowRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FeedbackExplanation } from "./feedback-panel";
import { type MatchSide, type MatchTry, firstMisses } from "./match-board-state";

const SHOWN_MISSES = 3;

/** Read between the two cards; Geist's own arrow is drawn long, so the line shows a short icon. */
const ARROW = "→";

/**
 * Under a match board's verdict, the pairs the learner first put together wrong: the solved board
 * above them shows each pair as it is. One line per card that had a wrong try, its first one, for
 * the first few cards. Each card is shown as written, since one can be a sentence with its own
 * punctuation.
 */
export function MatchMisses({
  misses,
  renderCard,
}: {
  misses: readonly MatchTry[];
  renderCard: (side: MatchSide, index: number) => React.ReactNode;
}) {
  const t = useExtracted();
  const shown = firstMisses(misses).slice(0, SHOWN_MISSES);

  if (shown.length === 0) {
    return null;
  }

  return (
    <FeedbackExplanation className="flex flex-col gap-1" data-slot="match-misses">
      <p>
        {t({
          description:
            "Under a matching question's verdict, before the pairs of cards the learner first put together wrong, one per line as “card → card”.",
          message: "You first matched:",
        })}
      </p>

      <ul className="flex flex-col gap-1">
        {shown.map((miss) => (
          <li key={miss.left}>
            {renderCard("left", miss.left)}{" "}
            <span className="text-muted-foreground">
              <ArrowRightIcon aria-hidden="true" className="inline size-3.5 align-middle" />
              <span className="sr-only">{ARROW}</span>
            </span>{" "}
            {renderCard("right", miss.right)}
          </li>
        ))}
      </ul>
    </FeedbackExplanation>
  );
}
