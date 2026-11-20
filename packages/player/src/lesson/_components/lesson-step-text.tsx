import { QuestionTitle } from "@zoonk/learn/question-title";
import { LESSON_BODY_CLASS, RichTextBlocks } from "@zoonk/learn/rich-text";
import { SpokenMath } from "@zoonk/learn/rich-text/spoken-math";
import { cn } from "@zoonk/ui/lib/utils";
import { splitQuestionData } from "../_utils/lesson-aside";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { LessonRichText } from "./lesson-rich-text";

/** A reading step's heading: the size of the text it heads, set apart by its weight, never smaller. */
export function LessonStepHeading({ children }: { children: string }) {
  return (
    <h2 className="text-foreground mb-2 text-lg leading-snug font-semibold text-pretty sm:mb-3 md:text-xl">
      <SpokenMath>
        <LessonRichText text={children} />
      </SpokenMath>
    </h2>
  );
}

export function LessonQuestion({ children, id }: { children: string; id?: string }) {
  const { data, question } = splitQuestionData(children);

  return (
    <>
      {data && <LessonContext>{data}</LessonContext>}
      {question && <QuestionTitle id={id} text={question} />}
    </>
  );
}

export function LessonContext({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <RichTextBlocks className="text-base leading-relaxed" text={children} />;
}

/** Knowledge lessons put a teaching screen's bold terms on the highlighter; language lessons keep plain bold. */
export function useTermHighlighter(): string | null {
  const { lesson } = useLessonPlayerConfig();
  return lesson.targetLanguage ? null : "highlight-strong";
}

export function LessonBody({ children }: { children: string }) {
  return <RichTextBlocks className={cn(LESSON_BODY_CLASS, "lg:max-w-xl")} text={children} />;
}
