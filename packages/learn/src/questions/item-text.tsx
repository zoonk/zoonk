import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { readWholeCodeFence } from "@zoonk/utils/code-fence";
import { Fragment } from "react";
import { RichTable } from "../_components/rich-table";
import { useAppLocale } from "../_utils/locale";
import { CodeBlock, CodeSnippet } from "../code/code-listing";
import { type RichInlineSegment, RichInlineSegments } from "../rich-text/rich-inline-segments";
import { RichTextBlocks } from "../rich-text/rich-text-blocks";
import { speakSegments } from "../rich-text/rich-text-speech";
import { typesetNumbers, typesetProse } from "../rich-text/rich-text-typography";
import { SpokenMath } from "../rich-text/spoken-math";
import { useMathWords } from "../rich-text/use-spoken-text";
import { LessonVisual } from "../visuals/lesson-visual";
import { type ItemTextBlock, parseItemLine, parseItemText } from "./_utils/item-text";
import { ItemPicture, type ItemPictureData } from "./item-picture";

type ItemTable = Extract<ItemTextBlock, { kind: "table" }>;

/** Keep a question's own digits as written, including codes and IDs. */
function useQuestionTypesetting() {
  const locale = useAppLocale();

  return (segments: RichInlineSegment[]) =>
    typesetProse({
      locale,
      segments,
      typeset: (text) => typesetNumbers({ group: false, locale, text }),
    });
}

function ItemParagraph({ lines }: { lines: RichInlineSegment[][] }) {
  const typeset = useQuestionTypesetting();

  return (
    <p>
      {lines.map((line, index) => {
        const key = `line-${index}`;

        return (
          <Fragment key={key}>
            {index > 0 && <br />}
            <RichInlineSegments segments={typeset(line)} />
          </Fragment>
        );
      })}
    </p>
  );
}

function ItemTableView({ table }: { table: ItemTable }) {
  const words = useMathWords();
  const typeset = useQuestionTypesetting();

  return (
    <RichTable
      align={table.align}
      header={table.header}
      label={table.header.map((cell) => speakSegments({ segments: cell, words })).join(", ")}
      renderCell={(cell) => <RichInlineSegments segments={typeset(cell)} />}
      rows={table.rows}
    />
  );
}

export function ItemText({ className, text }: { className?: string; text: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)} data-slot="item-text">
      {parseItemText(text).map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "code") {
          return <CodeBlock code={block.code} key={key} language={block.language} />;
        }

        return block.kind === "table" ? (
          <ItemTableView key={key} table={block} />
        ) : (
          <ItemParagraph key={key} lines={block.lines} />
        );
      })}
    </div>
  );
}

/**
 * One element, so a flex parent such as an answer option wraps the line as text instead of stacking
 * each styled word. A line usually names a control (an option, a pair, a step), so its formulas
 * read in words. A line that is one code block, such as an option that is a program, shows it as
 * code.
 */
export function ItemLine({ text }: { text: string }) {
  const typeset = useQuestionTypesetting();
  const code = readWholeCodeFence(text);

  if (code) {
    return <CodeSnippet code={code.code} language={code.language} />;
  }

  return (
    <SpokenMath>
      <RichInlineSegments segments={typeset(parseItemLine(text))} />
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
        <ItemText className={cn("text-reading leading-relaxed", className)} text={context} />
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
