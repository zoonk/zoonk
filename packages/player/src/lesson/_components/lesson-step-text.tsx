import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";
import { QUESTION_TEXT_CLASS } from "../../components/question-text";
import { splitQuestionData } from "../_utils/lesson-aside";
import { useLessonPlayerConfig } from "../lesson-player-context";

export function LessonQuestion({ children, id }: { children: string; id?: string }) {
  const { data, question } = splitQuestionData(children);

  return (
    <>
      {data && <LessonContext>{data}</LessonContext>}
      {question && (
        <div id={id}>
          <RichTextBlocks className={QUESTION_TEXT_CLASS} paragraphTag="h2" text={question} />
        </div>
      )}
    </>
  );
}

export function LessonContext({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <RichTextBlocks className="text-base leading-relaxed" text={children} />;
}

export const LESSON_BODY_CLASS =
  "text-foreground text-lg leading-relaxed md:text-[1.1875rem] md:leading-[1.6]";

/** Knowledge lessons put a teaching screen's bold terms on the highlighter; language lessons keep plain bold. */
export function useTermHighlighter(): string | null {
  const { lesson } = useLessonPlayerConfig();
  return lesson.targetLanguage ? null : "highlight-strong";
}

export function LessonBody({ children }: { children: string }) {
  return <RichTextBlocks className={cn(LESSON_BODY_CLASS, "lg:max-w-xl")} text={children} />;
}

export const SCREEN_CHIP_CLASS =
  "text-muted-foreground ring-border inline-flex min-h-5.5 w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3.5";

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
    <p className={cn(SCREEN_CHIP_CLASS, className)}>
      {icon}
      {children}
    </p>
  );
}
