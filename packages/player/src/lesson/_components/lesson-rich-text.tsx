import { RichTable } from "@zoonk/learn/rich-table";
import { cn } from "@zoonk/ui/lib/utils";
import { useLocale } from "next-intl";
import { type RichInlineSegment, RichInlineSegments } from "../../components/rich-inline-segments";
import { type RichBlock, parseRichBlocks, parseRichInline } from "../_utils/lesson-rich-text";
import { typesetNumbers } from "../_utils/lesson-typography";

/** Numbers in the learner's language, kept with their units; math and code stay as written. */
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

/** One line of lesson text (a question, an option, a label) with its emphasis and math. */
export function LessonRichText({ text }: { text: string }) {
  const locale = useLocale();
  const segments = parseRichInline(text.replaceAll(/\s*\n\s*/gu, " "));

  return <RichInlineSegments segments={typeset({ locale, segments })} />;
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

function RichBlockView({ block }: { block: RichBlock }) {
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

  return (
    <p>
      {block.lines.map((line, index) => {
        const key = `line-${index}`;

        return (
          <span className="block" key={key}>
            <RichInlineSegments segments={line} />
          </span>
        );
      })}
    </p>
  );
}

/** Lesson text with paragraphs, short lists and tables of data, as the step contract allows. */
export function LessonRichTextBlocks({ className, text }: { className?: string; text: string }) {
  const locale = useLocale();

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="lesson-rich-text">
      {parseRichBlocks(text).map((block, index) => {
        const key = `${block.kind}-${index}`;

        return <RichBlockView block={typesetBlock({ block, locale })} key={key} />;
      })}
    </div>
  );
}
