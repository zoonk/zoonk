import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";

const QUESTION_CLASS = "text-base leading-snug font-semibold text-pretty";

/** A question an activity asks, under its card or inside it: one style wherever it's asked. */
export function ActivityCheckQuestion({
  children,
  className,
  htmlFor,
  id,
}: {
  children: string;
  className?: string;
  htmlFor?: string;
  id?: string;
}) {
  return (
    <div className={cn(QUESTION_CLASS, className)} data-slot="activity-check-question" id={id}>
      <RichTextBlocks htmlFor={htmlFor} paragraphTag={htmlFor ? "label" : "p"} text={children} />
    </div>
  );
}
