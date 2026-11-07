import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { Fragment, type ReactNode } from "react";

type Side = "left" | "right";
type RenderItem<Item> = (side: Side, item: Item, index: number) => ReactNode;

export type MatchBoardRow<Item> = { left: Item | null; right: Item | null };

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
      <div className="grid gap-4 @3xs:grid-cols-2 @3xs:gap-x-2.5 @3xs:gap-y-2">
        {solvedRows.map((row, index) => (
          <div
            className="grid gap-y-2 @3xs:col-span-2 @3xs:grid-cols-subgrid"
            key={row.left?.id ?? row.right?.id}
          >
            {row.left ? renderItem("left", row.left, index) : <div className="hidden @3xs:block" />}
            {row.right && renderItem("right", row.right, index)}
          </div>
        ))}
      </div>
    );
  }

  if (alignRows) {
    const column = "grid gap-2 @3xs:row-span-(--rows) @3xs:grid-rows-subgrid";

    return (
      <div
        className="grid gap-4 @3xs:grid-cols-2 @3xs:gap-x-2.5 @3xs:gap-y-2"
        style={rowCount(Math.max(left.length, right.length))}
      >
        <Column className={column} items={left} renderItem={renderItem} side="left" />
        <Column className={column} items={right} renderItem={renderItem} side="right" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 @3xs:grid-cols-2 @3xs:gap-2.5">
      <Column className="flex flex-col gap-2" items={left} renderItem={renderItem} side="left" />
      <Column className="flex flex-col gap-2" items={right} renderItem={renderItem} side="right" />
    </div>
  );
}

/**
 * Side by side while the board is 16rem wide, so larger text stacks the right column under the left
 * and each card gets the board's width, as Apple's board does at accessibility sizes.
 */
export function MatchBoard<Item extends { id: string }>({
  label,
  ...board
}: BoardProps<Item> & { label?: string }) {
  return (
    <div aria-label={label} className="@container" role={label ? "group" : undefined}>
      <BoardLayout {...board} />
    </div>
  );
}
