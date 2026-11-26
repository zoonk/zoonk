"use client";

import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import { useExtracted } from "next-intl";
import { Component, type ReactNode, createRef } from "react";
import { type MatchSide } from "./use-match-board";

type RenderCard = (side: MatchSide, index: number) => ReactNode;

const SIDE_BY_SIDE = "grid grid-cols-1 gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-2";

/** A card's tints are see-through, so on a canvas's panel it keeps the page's ground under them. */
const CARD_GROUND = "bg-background flex rounded-xl";

function cardsOf(board: HTMLElement) {
  return [...board.querySelectorAll<HTMLElement>("[data-match-card]")];
}

function cardBoxes(board: HTMLElement): Map<string, DOMRect> {
  return new Map(
    cardsOf(board).map((card) => [card.dataset.matchCard ?? "", card.getBoundingClientRect()]),
  );
}

function slideFrom(board: HTMLElement, from: ReadonlyMap<string, DOMRect>) {
  if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const timing = { duration: readDuration(board, "base"), easing: readEasing(board, "out") };

  for (const card of cardsOf(board)) {
    const was = from.get(card.dataset.matchCard ?? "");
    const now = card.getBoundingClientRect();

    if (was && (was.left !== now.left || was.top !== now.top)) {
      const shift = `translate(${was.left - now.left}px, ${was.top - now.top}px)`;
      card.animate([{ transform: shift }, { transform: "none" }], timing);
    }
  }
}

type SlideProps = React.ComponentProps<"div"> & { rows: boolean };

// oxlint-disable-next-line react/prefer-function-component -- Only a class reads the cards' places before React takes the columns down (getSnapshotBeforeUpdate has no hook).
class RowsSlide extends Component<SlideProps> {
  board = createRef<HTMLDivElement>();

  override getSnapshotBeforeUpdate(previous: SlideProps): Map<string, DOMRect> | null {
    const board = this.board.current;
    return board && previous.rows !== this.props.rows ? cardBoxes(board) : null;
  }

  override componentDidUpdate(
    _previous: SlideProps,
    _state: unknown,
    from: Map<string, DOMRect> | null,
  ) {
    if (from && this.board.current) {
      slideFrom(this.board.current, from);
    }
  }

  override render() {
    const { rows: _rows, ...props } = this.props;
    return <div {...props} ref={this.board} />;
  }
}

/** A column's places, which are its cards' identity: a card never moves within its column. */
function placesUpTo(count: number): number[] {
  return Array.from({ length: count }, (_, place) => place);
}

function rowCount(rows: number): CSSPropertiesWithVariables {
  return { "--rows": rows };
}

function Column({
  count,
  label,
  renderCard,
  side,
}: {
  count: number;
  label: string;
  renderCard: RenderCard;
  side: MatchSide;
}) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-1 gap-2 @min-[20.5em]:row-span-(--rows) @min-[20.5em]:grid-rows-subgrid"
    >
      {placesUpTo(count).map((place) => (
        <li className={CARD_GROUND} data-match-card={`${side}-${place}`} key={place}>
          {renderCard(side, place)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The cards of a "match these with those" question: two columns whose rows line up, or, once
 * `solved` gives each left card's partner, one row per pair, every card sliding to its row. It
 * stays side by side while it's 20.5em of its text wide, about ten letters beside each card's mark,
 * so larger text stacks the right column under the left and each card gets the board's width, as
 * Apple's board does at accessibility sizes.
 */
export function MatchBoard({
  label,
  leftCount,
  renderCard,
  rightCount,
  solved,
}: {
  label?: string;
  leftCount: number;
  renderCard: RenderCard;
  rightCount: number;
  /** For each left card, the place of its partner in the right column. */
  solved?: readonly number[] | null;
}) {
  const t = useExtracted();

  return (
    <RowsSlide
      aria-label={label}
      className="@container text-sm sm:text-base"
      data-slot="match-board"
      role={label ? "group" : undefined}
      rows={Boolean(solved)}
    >
      {solved ? (
        <div className={SIDE_BY_SIDE}>
          {placesUpTo(solved.length).map((left) => (
            <div
              className="grid grid-cols-1 gap-y-2 @min-[20.5em]:col-span-2 @min-[20.5em]:grid-cols-subgrid"
              key={left}
            >
              <div className={CARD_GROUND} data-match-card={`left-${left}`}>
                {renderCard("left", left)}
              </div>
              {(solved[left] ?? -1) >= 0 && (
                <div className={CARD_GROUND} data-match-card={`right-${solved[left]}`}>
                  {renderCard("right", solved[left] ?? -1)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={SIDE_BY_SIDE} style={rowCount(Math.max(leftCount, rightCount))}>
          <Column count={leftCount} label={t("Match these")} renderCard={renderCard} side="left" />
          <Column count={rightCount} label={t("With these")} renderCard={renderCard} side="right" />
        </div>
      )}
    </RowsSlide>
  );
}
