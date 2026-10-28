import { cn } from "@zoonk/ui/lib/utils";
import { useLocale } from "next-intl";
import { RichTable } from "../_components/rich-table";
import { type RichInlineSegment, RichInlineSegments } from "./rich-inline-segments";
import { type RichBlock, markRichBlocks, parseRichBlocks } from "./rich-text-parser";
import { typesetNumbers } from "./rich-text-typography";

function typeset({
  locale,
  segments,
}: {
  locale: string;
  segments: RichInlineSegment[];
}): RichInlineSegment[] {
  return segments.map((segment) =>
    segment.kind === "math" || segment.kind === "displayMath" || segment.kind === "code"
      ? segment
      : { ...segment, text: typesetNumbers({ locale, text: segment.text }) },
  );
}

function typesetBlock({ block, locale }: { block: RichBlock; locale: string }): RichBlock {
  const each = (segments: RichInlineSegment[]) => typeset({ locale, segments });

  switch (block.kind) {
    case "list":
      return { ...block, items: block.items.map((item) => each(item)) };
    case "table":
      return {
        ...block,
        header: block.header.map((cell) => each(cell)),
        rows: block.rows.map((row) => row.map((cell) => each(cell))),
      };
    case "paragraph":
      return { ...block, lines: block.lines.map((line) => each(line)) };
    default:
      throw new Error("Unknown rich text block.");
  }
}

function toPlainText(segments: RichInlineSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

function RichBlockView({
  block,
  paragraphTag,
  htmlFor,
}: {
  block: RichBlock;
  htmlFor?: string;
  paragraphTag: "p" | "h1" | "h2" | "h3" | "label";
}) {
  if (block.kind === "table") {
    return (
      <RichTable
        align={block.align}
        header={block.header}
        label={block.header.map((cell) => toPlainText(cell)).join(", ")}
        renderCell={(cell) => <RichInlineSegments segments={cell} />}
        rows={block.rows}
      />
    );
  }

  if (block.kind === "list") {
    const List = block.ordered ? "ol" : "ul";

    return (
      <List
        className={cn("flex flex-col gap-1.5 ps-6", block.ordered ? "list-decimal" : "list-disc")}
      >
        {block.items.map((item, index) => {
          const key = `item-${index}`;

          return (
            <li className="ps-1" key={key}>
              <RichInlineSegments segments={item} />
            </li>
          );
        })}
      </List>
    );
  }

  const Paragraph = paragraphTag;

  return (
    <Paragraph htmlFor={htmlFor}>
      {block.lines.map((line, index) => {
        const key = `line-${index}`;

        return (
          <span className="block" key={key}>
            <RichInlineSegments segments={line} />
          </span>
        );
      })}
    </Paragraph>
  );
}

export function RichTextBlocks({
  className,
  htmlFor,
  mark,
  paragraphTag = "p",
  text,
}: {
  className?: string;
  htmlFor?: string;
  mark?: string | null;
  paragraphTag?: "p" | "h1" | "h2" | "h3" | "label";
  text: string;
}) {
  const locale = useLocale();
  const blocks = parseRichBlocks(text);

  return (
    <div
      className={cn("flex max-w-full min-w-0 flex-col gap-3", className)}
      data-slot="lesson-rich-text"
    >
      {(mark ? markRichBlocks(blocks, mark) : blocks).map((block, index) => {
        const key = `${block.kind}-${index}`;

        return (
          <RichBlockView
            block={typesetBlock({ block, locale })}
            key={key}
            paragraphTag={paragraphTag}
            htmlFor={htmlFor}
          />
        );
      })}
    </div>
  );
}
