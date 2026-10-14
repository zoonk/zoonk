import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";

const QUESTION_CLASS = "text-base leading-snug font-semibold";

/**
 * The check's question: it asks about what the learner just saw or did. With `htmlFor` it labels
 * the answer's input.
 */
export function ActivityCheckQuestion({
  children,
  className,
  htmlFor,
}: {
  children: string;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn(QUESTION_CLASS, className)} data-slot="activity-check-question">
      <RichTextBlocks htmlFor={htmlFor} paragraphTag={htmlFor ? "label" : "p"} text={children} />
    </div>
  );
}
