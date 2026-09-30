import { cn } from "@zoonk/ui/lib/utils";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

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
  if (htmlFor) {
    return (
      <label
        className={cn(QUESTION_CLASS, className)}
        data-slot="activity-check-question"
        htmlFor={htmlFor}
      >
        <LessonRichText text={children} />
      </label>
    );
  }

  return (
    <p className={cn(QUESTION_CLASS, className)} data-slot="activity-check-question">
      <LessonRichText text={children} />
    </p>
  );
}
