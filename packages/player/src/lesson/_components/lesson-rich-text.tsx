import { cn } from "@zoonk/ui/lib/utils";
import { RichInlineSegments } from "../../components/rich-inline-segments";
import { type RichBlock, parseRichBlocks, parseRichInline } from "../_utils/lesson-rich-text";

/** One line of lesson text (a question, an option, a label) with its emphasis and math. */
export function LessonRichText({ text }: { text: string }) {
  return <RichInlineSegments segments={parseRichInline(text.replaceAll(/\s*\n\s*/gu, " "))} />;
}

function RichBlockView({ block }: { block: RichBlock }) {
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

/** Lesson text with paragraphs and short lists, as the step contract allows. */
export function LessonRichTextBlocks({ className, text }: { className?: string; text: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="lesson-rich-text">
      {parseRichBlocks(text).map((block, index) => {
        const key = `${block.kind}-${index}`;

        return <RichBlockView block={block} key={key} />;
      })}
    </div>
  );
}
