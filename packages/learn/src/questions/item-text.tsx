import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { type InlineMarkup } from "@zoonk/utils/inline-markup";
import { Fragment } from "react";
import { RichTable } from "../_components/rich-table";
import { RichTextBlocks } from "../rich-text/rich-text-blocks";
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
          className="bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.85em]"
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

export const QUESTION_TEXT_CLASS =
  "text-[1.1875rem] leading-[1.35] font-[560] tracking-[-0.02em] text-balance";

export function ItemLine({ text }: { text: string }) {
  return <InlineMarkupView segments={parseItemLine(text)} />;
}

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
      {context && (
        <ItemText className={cn("text-base leading-relaxed", className)} text={context} />
      )}
      {image && <ItemPicture image={image} />}
      <LessonVisual visual={visual} />
    </>
  );
}

export function ItemStem({
  text,
  heading = false,
}: {
  text: string;
  heading?: false | "h1" | "h2";
}) {
  return <RichTextBlocks paragraphTag={heading || "p"} text={text} />;
}
