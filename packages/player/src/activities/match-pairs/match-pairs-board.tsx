import { Fragment, type ReactNode } from "react";
import { type MatchCard, solvedRows } from "./match-pairs-columns";

export function MatchPairsBoard({
  isComplete,
  label,
  left,
  renderCard,
  right,
}: {
  isComplete: boolean;
  label: string;
  left: readonly MatchCard[];
  renderCard: (side: "left" | "right", card: MatchCard) => ReactNode;
  right: readonly MatchCard[];
}) {
  if (isComplete) {
    return (
      <div aria-label={label} className="grid grid-cols-2 gap-x-2.5 gap-y-2" role="group">
        {solvedRows({ left, right }).map((row) => (
          <Fragment key={row.left?.id ?? row.right?.id}>
            {row.left ? renderCard("left", row.left) : <div />}
            {row.right ? renderCard("right", row.right) : <div />}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div aria-label={label} className="grid grid-cols-2 items-start gap-2.5" role="group">
      <div className="flex flex-col gap-2">
        {left.map((card) => (
          <Fragment key={card.id}>{renderCard("left", card)}</Fragment>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {right.map((card) => (
          <Fragment key={card.id}>{renderCard("right", card)}</Fragment>
        ))}
      </div>
    </div>
  );
}
