import { QUESTION_TEXT_CLASS as LEARN_QUESTION_TEXT_CLASS } from "@zoonk/learn/item-text";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";
import { stripWrappingQuotes } from "@zoonk/utils/string";

export const QUESTION_TEXT_CLASS = cn(
  LEARN_QUESTION_TEXT_CLASS,
  "text-foreground in-data-[phase=feedback]:text-muted-foreground",
);

export function ContextText({ children }: { children: React.ReactNode }) {
  return typeof children === "string" ? (
    <RichTextBlocks className="text-base leading-relaxed" text={stripWrappingQuotes(children)} />
  ) : (
    <p className="text-base leading-relaxed">{children}</p>
  );
}

export function QuestionText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (typeof children === "string") {
    return (
      <RichTextBlocks
        className={cn(QUESTION_TEXT_CLASS, className)}
        paragraphTag="h2"
        text={stripWrappingQuotes(children)}
      />
    );
  }

  return <h2 className={cn(QUESTION_TEXT_CLASS, className)}>{children}</h2>;
}
