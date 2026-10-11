import { cn } from "@zoonk/ui/lib/utils";
import { findMarkdownTableLines } from "@zoonk/utils/markdown-table";
import { LessonRichText, LessonRichTextBlocks } from "./lesson-rich-text";

/**
 * A question written with a table of data ("The office logged its letters:", a table, then "Which
 * month had the fewest?") reads as that data, then the question itself: its last paragraph that
 * isn't a table. Data written after the question ("Which sensor…?", then the table) shows above it
 * too, so the heading never holds a table.
 */
function splitQuestionData(text: string): { data: string | null; question: string } {
  const lines = text.split(/\r?\n/u);
  const tableLines = findMarkdownTableLines(lines);

  if (tableLines.size === 0) {
    return { data: null, question: text };
  }

  const isProse = (index: number) => !tableLines.has(index) && Boolean(lines[index]?.trim());
  const end = lines.findLastIndex((_, index) => isProse(index));

  if (end === -1) {
    return { data: text, question: "" };
  }

  const start = lines.findLastIndex((_, index) => index < end && !isProse(index)) + 1;

  return {
    data: [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n").trim(),
    question: lines.slice(start, end + 1).join("\n"),
  };
}

/** The question or prompt of a screen: the one line the learner answers. */
export function LessonQuestion({ children, id }: { children: string; id?: string }) {
  const { data, question } = splitQuestionData(children);

  return (
    <>
      {data && <LessonContext>{data}</LessonContext>}
      {question && (
        <h2
          className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl"
          id={id}
        >
          <LessonRichText text={question} />
        </h2>
      )}
    </>
  );
}

/** The situation before a question, read before answering. */
export function LessonContext({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <LessonRichTextBlocks className="text-lg leading-relaxed sm:text-xl" text={children} />;
}

/** The main reading text of a screen, large and calm. */
export function LessonBody({ children }: { children: string }) {
  return (
    <LessonRichTextBlocks
      className="text-foreground text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
      text={children}
    />
  );
}

/** A small label above a screen's content, such as "Guess first" or "Worked example". */
export function LessonEyebrow({
  children,
  className,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "bg-muted text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium [&_svg]:size-3.5",
        className,
      )}
    >
      {icon}
      {children}
    </p>
  );
}
