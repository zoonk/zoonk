import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";

export const QUESTION_TEXT_CLASS =
  "text-foreground in-data-[phase=feedback]:text-muted-foreground text-[1.1875rem] leading-[1.35] font-[560] tracking-[-0.02em] text-balance md:text-[1.3125rem]";

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
