import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { type InlineMarkup } from "@zoonk/utils/inline-markup";
import { Fragment } from "react";
import { RichTable } from "../_components/rich-table";
import { LessonVisual } from "../visuals/lesson-visual";
import { type ItemTextBlock, parseItemLine, parseItemText } from "./_utils/item-text";
import { ItemPicture, type ItemPictureData } from "./item-picture";

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

function toPlainText(cell: InlineMarkup[]): string {
  return cell.map((segment) => segment.text).join("");
}

/** A table of data with its header row, shared with the lesson player's tables. */
function ItemTableView({ table }: { table: ItemTable }) {
  return (
    <RichTable
      align={table.align}
      header={table.header}
      label={table.header.map((cell) => toPlainText(cell)).join(", ")}
      renderCell={(cell) => <InlineMarkupView segments={cell} />}
      rows={table.rows}
    />
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

/**
 * What a question shows before its command: its support text (paragraphs and tables), the figure
 * it's about and the chart or timeline it reads. Every question screen uses it, so a picture or a
 * visual never goes missing.
 */
export function ItemSupport({
  className,
  context,
  image,
  visual,
}: {
  className?: string;
  context: string | null;
  image: ItemPictureData | null;
  visual: LessonVisualData | null;
}) {
  return (
    <>
      {context && <ItemText className={className} text={context} />}
      {image && <ItemPicture image={image} />}
      <LessonVisual visual={visual} />
    </>
  );
}
