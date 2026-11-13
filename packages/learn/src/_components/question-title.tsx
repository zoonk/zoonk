import { cn } from "@zoonk/ui/lib/utils";
import { ItemStem } from "../questions/item-text";

const QUESTION_TITLE_CLASS =
  "text-foreground in-data-[phase=feedback]:text-muted-foreground text-xl leading-[1.35] font-semibold tracking-[-0.02em] text-pretty outline-none";

/**
 * A question's title, one size everywhere a question is asked. `text` is the question as written,
 * with its math and line breaks; `children` is a title a screen composes itself. `heading={false}`
 * draws a sentence in the title's type that isn't the screen's heading.
 */
export function QuestionTitle({
  children,
  className,
  heading = "h2",
  muted = false,
  text,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  children?: React.ReactNode;
  heading?: false | "h1" | "h2";
  muted?: boolean;
  text?: string;
}) {
  const titleClass = cn(QUESTION_TITLE_CLASS, muted && "text-muted-foreground", className);

  if (text !== undefined) {
    return (
      <div className={titleClass} data-slot="question-title" {...props}>
        <ItemStem heading={heading} text={text} />
      </div>
    );
  }

  const Tag = heading || "p";

  return (
    <Tag className={titleClass} data-slot="question-title" {...props}>
      {children}
    </Tag>
  );
}
