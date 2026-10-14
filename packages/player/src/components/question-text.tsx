import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";
import { useReplaceName } from "../user-name-context";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";

/**
 * The type of the line the learner answers, the same on every screen: a step up from a tablet,
 * where the column has the room. Once the answer is checked it steps back to the muted color, so
 * the result takes the focus.
 */
export const QUESTION_TEXT_CLASS =
  "text-foreground in-data-[phase=feedback]:text-muted-foreground text-[1.1875rem] leading-[1.35] font-[560] tracking-[-0.02em] text-balance md:text-[1.3125rem]";

/** The situation before a question, read before answering, quieter than the question itself. */
export function ContextText({ children }: { children: React.ReactNode }) {
  const replaceName = useReplaceName();

  return typeof children === "string" ? (
    <RichTextBlocks
      className="text-base leading-relaxed"
      text={stripWrappingQuotes(replaceName(children))}
    />
  ) : (
    <p className="text-base leading-relaxed">{children}</p>
  );
}

/** The line the learner answers, in the same type as a lesson's other questions. */
export function QuestionText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const replaceName = useReplaceName();

  if (typeof children === "string") {
    return (
      <RichTextBlocks
        className={cn(QUESTION_TEXT_CLASS, className)}
        paragraphTag="h2"
        text={stripWrappingQuotes(replaceName(children))}
      />
    );
  }

  return <h2 className={cn(QUESTION_TEXT_CLASS, className)}>{children}</h2>;
}
