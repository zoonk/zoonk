import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { ActivityCanvasLabel } from "../activities/_components/activity-canvas";

type Side = "left" | "right";
type RenderItem<Item> = (side: Side, item: Item, index: number) => ReactNode;

type MatchBoardRow<Item> = { left: Item; right: Item | null };

type BoardProps<Item> = {
  alignRows?: boolean;
  left: readonly Item[];
  renderItem: RenderItem<Item>;
  right: readonly Item[];
  solvedRows?: readonly MatchBoardRow<Item>[];
};

function rowCount(rows: number): CSSPropertiesWithVariables {
  return { "--rows": rows };
}

function Column<Item extends { id: string }>({
  className,
  items,
  renderItem,
  side,
}: {
  className: string;
  items: readonly Item[];
  renderItem: RenderItem<Item>;
  side: Side;
}) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <Fragment key={item.id}>{renderItem(side, item, index)}</Fragment>
      ))}
    </div>
  );
}

function BoardLayout<Item extends { id: string }>({
  alignRows = false,
  left,
  renderItem,
  right,
  solvedRows,
}: BoardProps<Item>) {
  if (solvedRows) {
    return (
      <div className="grid grid-cols-1 gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-2">
        {solvedRows.map((row, index) => (
          <div
            className="grid grid-cols-1 gap-y-2 @min-[20.5em]:col-span-2 @min-[20.5em]:grid-cols-subgrid"
            key={row.left.id}
          >
            {renderItem("left", row.left, index)}
            {row.right && renderItem("right", row.right, index)}
          </div>
        ))}
      </div>
    );
  }

  if (alignRows) {
    const column =
      "grid grid-cols-1 gap-2 @min-[20.5em]:row-span-(--rows) @min-[20.5em]:grid-rows-subgrid";

    return (
      <div
        className="grid grid-cols-1 gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-2"
        style={rowCount(Math.max(left.length, right.length))}
      >
        <Column className={column} items={left} renderItem={renderItem} side="left" />
        <Column className={column} items={right} renderItem={renderItem} side="right" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-2">
      <Column className="flex flex-col gap-2" items={left} renderItem={renderItem} side="left" />
      <Column className="flex flex-col gap-2" items={right} renderItem={renderItem} side="right" />
    </div>
  );
}

/**
 * The board stays side by side while it's 20.5em of its text wide, about ten letters beside each
 * card's mark, so larger text stacks the right column under the left and each card gets the board's
 * width, as Apple's board does at accessibility sizes.
 */
export function MatchBoard<Item extends { id: string }>({
  label,
  ...board
}: BoardProps<Item> & { label?: string }) {
  return (
    <div
      aria-label={label}
      className="@container text-sm sm:text-base"
      role={label ? "group" : undefined}
    >
      <BoardLayout {...board} />
    </div>
  );
}

export function MatchBoardCount({ matched, total }: { matched: number; total: number }) {
  const t = useExtracted();

  return (
    <ActivityCanvasLabel className="tabular-nums">
      {t("{matched, plural, one {# of {total} pairs matched} other {# of {total} pairs matched}}", {
        matched,
        total: String(total),
      })}
    </ActivityCanvasLabel>
  );
}
