import { QuestionTitle } from "@zoonk/learn/question-title";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { stripWrappingQuotes } from "@zoonk/utils/string";

export function ContextText({ children }: { children: React.ReactNode }) {
  return typeof children === "string" ? (
    <RichTextBlocks className="text-base leading-relaxed" text={stripWrappingQuotes(children)} />
  ) : (
    <p className="text-base leading-relaxed">{children}</p>
  );
}

/** A lesson's question as its author wrote it, without the quotes some come wrapped in. */
export function QuestionText({ children }: { children: React.ReactNode }) {
  return typeof children === "string" ? (
    <QuestionTitle text={stripWrappingQuotes(children)} />
  ) : (
    <QuestionTitle>{children}</QuestionTitle>
  );
}
