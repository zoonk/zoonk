import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { Fragment, type ReactNode } from "react";

type Side = "left" | "right";
type RenderItem<Item> = (side: Side, item: Item, index: number) => ReactNode;

type MatchBoardRow<Item> = { left: Item | null; right: Item | null };

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
      <div className="grid grid-cols-1 gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-x-2.5 @min-[20.5em]:gap-y-2">
        {solvedRows.map((row, index) => (
          <div
            className="grid grid-cols-1 gap-y-2 @min-[20.5em]:col-span-2 @min-[20.5em]:grid-cols-subgrid"
            key={row.left?.id ?? row.right?.id}
          >
            {row.left ? (
              renderItem("left", row.left, index)
            ) : (
              <div className="hidden @min-[20.5em]:block" />
            )}
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
        className="grid grid-cols-1 gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-x-2.5 @min-[20.5em]:gap-y-2"
        style={rowCount(Math.max(left.length, right.length))}
      >
        <Column className={column} items={left} renderItem={renderItem} side="left" />
        <Column className={column} items={right} renderItem={renderItem} side="right" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 @min-[20.5em]:grid-cols-2 @min-[20.5em]:gap-2.5">
      <Column className="flex flex-col gap-2" items={left} renderItem={renderItem} side="left" />
      <Column className="flex flex-col gap-2" items={right} renderItem={renderItem} side="right" />
    </div>
  );
}

/**
 * `className` sets the cards' text size. The board stays side by side while it's 20.5em of that text
 * wide, about ten letters beside each card's mark, so larger text stacks the right column under the
 * left and each card gets the board's width, as Apple's board does at accessibility sizes.
 */
export function MatchBoard<Item extends { id: string }>({
  className,
  label,
  ...board
}: BoardProps<Item> & { className: string; label?: string }) {
  return (
    <div
      aria-label={label}
      className={cn("@container", className)}
      role={label ? "group" : undefined}
    >
      <BoardLayout {...board} />
    </div>
  );
}
