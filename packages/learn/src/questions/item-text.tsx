import { cn } from "@zoonk/ui/lib/utils";
import { type InlineMarkup } from "@zoonk/utils/inline-markup";
import { Fragment } from "react";
import {
  type ItemTextAlign,
  type ItemTextBlock,
  parseItemLine,
  parseItemText,
} from "./_utils/item-text";

type ItemTable = Extract<ItemTextBlock, { kind: "table" }>;

function InlineMarkupView({ segments }: { segments: InlineMarkup[] }) {
  return segments.map((segment, index) => {
    const key = `${segment.kind}-${index}`;

    if (segment.kind === "bold") {
      return <strong key={key}>{segment.text}</strong>;
    }

    if (segment.kind === "italic") {
      return <em key={key}>{segment.text}</em>;
    }

    if (segment.kind === "code") {
      return (
        <code
          className="bg-foreground text-background rounded-sm px-1 py-0.5 font-mono text-[0.85em]"
          key={key}
        >
          {segment.text}
        </code>
      );
    }

    return <Fragment key={key}>{segment.text}</Fragment>;
  });
}

function ItemParagraph({ lines }: { lines: InlineMarkup[][] }) {
  return (
    <p>
      {lines.map((line, index) => {
        const key = `line-${index}`;

        return (
          <Fragment key={key}>
            {index > 0 && <br />}
            <InlineMarkupView segments={line} />
          </Fragment>
        );
      })}
    </p>
  );
}

/**
 * Numbers line up on their digits. Cells wrap between words, amounts stay whole, and the gap
 * between columns is tighter than the frame's edge, so four columns fit a phone.
 */
function getCellClass(align: ItemTextAlign | undefined) {
  return cn(
    "p-2 align-top first:ps-3 last:pe-3",
    align === "right" && "text-right tabular-nums",
    align === "center" && "text-center tabular-nums",
    (align === "left" || !align) && "text-left",
  );
}

function toPlainText(cell: InlineMarkup[]): string {
  return cell.map((segment) => segment.text).join("");
}

/**
 * A table of data with its header row. On a narrow screen it scrolls sideways inside its frame
 * instead of widening the page, and keyboard users can focus it to scroll.
 */
function ItemTableView({ table }: { table: ItemTable }) {
  return (
    <div
      aria-label={table.header.map((cell) => toPlainText(cell)).join(", ")}
      className="border-border focus-visible:ring-ring/50 max-w-full overflow-x-auto rounded-xl border outline-none focus-visible:ring-[3px]"
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A wide table scrolls sideways, which needs focus by keyboard.
      tabIndex={0}
    >
      <table className="text-foreground w-full border-collapse text-sm leading-snug">
        <thead className="bg-muted">
          <tr>
            {table.header.map((cell, index) => {
              const key = `head-${index}`;

              return (
                <th
                  // Long labels ("Durchschnittlicher Fahrpreis") hyphenate, so the table fits a phone.
                  className={cn(getCellClass(table.align[index]), "font-semibold hyphens-auto")}
                  key={key}
                  scope="col"
                >
                  <InlineMarkupView segments={cell} />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {table.rows.map((row, rowIndex) => {
            const rowKey = `row-${rowIndex}`;

            return (
              <tr className="border-border border-t" key={rowKey}>
                {row.map((cell, index) => {
                  const key = `cell-${index}`;

                  return (
                    <td className={getCellClass(table.align[index])} key={key}>
                      <InlineMarkupView segments={cell} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * An item's support text, such as a question's context or an essay's motivating texts: its
 * paragraphs, tables of data and emphasis, the way item writers write them.
 */
export function ItemText({ className, text }: { className?: string; text: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)} data-slot="item-text">
      {parseItemText(text).map((block, index) => {
        const key = `${block.kind}-${index}`;

        return block.kind === "table" ? (
          <ItemTableView key={key} table={block} />
        ) : (
          <ItemParagraph key={key} lines={block.lines} />
        );
      })}
    </div>
  );
}

/** One line of item text, such as a question's command or a statement, with its emphasis. */
export function ItemLine({ text }: { text: string }) {
  return <InlineMarkupView segments={parseItemLine(text)} />;
}
