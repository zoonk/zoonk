import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";
import { RichTable } from "../_components/rich-table";
import { type RichInlineSegment, RichInlineSegments } from "../rich-text/rich-inline-segments";
import { RichTextBlocks } from "../rich-text/rich-text-blocks";
import { speakSegments } from "../rich-text/rich-text-speech";
import { SpokenMath } from "../rich-text/spoken-math";
import { useMathWords } from "../rich-text/use-spoken-text";
import { LessonVisual } from "../visuals/lesson-visual";
import { type ItemTextBlock, parseItemLine, parseItemText } from "./_utils/item-text";
import { ItemPicture, type ItemPictureData } from "./item-picture";

type ItemTable = Extract<ItemTextBlock, { kind: "table" }>;

function ItemParagraph({ lines }: { lines: RichInlineSegment[][] }) {
  return (
    <p>
      {lines.map((line, index) => {
        const key = `line-${index}`;

        return (
          <Fragment key={key}>
            {index > 0 && <br />}
            <RichInlineSegments segments={line} />
          </Fragment>
        );
      })}
    </p>
  );
}

function ItemTableView({ table }: { table: ItemTable }) {
  const words = useMathWords();

  return (
    <RichTable
      align={table.align}
      header={table.header}
      label={table.header.map((cell) => speakSegments({ segments: cell, words })).join(", ")}
      renderCell={(cell) => <RichInlineSegments segments={cell} />}
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
  "text-[1.1875rem] leading-[1.35] font-[560] tracking-[-0.02em] text-pretty";

/**
 * One element, so a flex parent such as an answer option wraps the line as text instead of stacking
 * each styled word. A line usually names a control (an option, a pair, a step), so its formulas
 * read in words.
 */
export function ItemLine({ text }: { text: string }) {
  return (
    <SpokenMath>
      <RichInlineSegments segments={parseItemLine(text)} />
    </SpokenMath>
  );
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
