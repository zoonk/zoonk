"use client";

import { ANSWER_OPTION_CLASS, AnswerOptionContent } from "@/components/public/answer-option";
import { FIRST_ANSWER_PARAM, ORIGIN_PARAM } from "@/lib/public/public-hrefs";
import { trackEvent } from "@zoonk/core/analytics/client";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The lesson's first question, answerable right on the page. Each option is a
 * submit button of a plain GET form, so any answer opens the player with it
 * (and still works before the page's scripts load), and with the page it was answered on
 * (`origin`), which closing the lesson returns to.
 */
export function FirstScreenChoices({
  action,
  lessonId,
  options,
  origin,
  questionId,
}: {
  action: string;
  lessonId: string;
  /** The catalog page the question is on, without the language (`getLessonHref`…). */
  origin: string;
  options: { id: string; text: string }[];
  questionId: string;
}) {
  return (
    <form
      action={action}
      aria-labelledby={questionId}
      method="get"
      onSubmit={() => trackEvent({ name: "Hook Answered", properties: { lesson_id: lessonId } })}
    >
      <input name={ORIGIN_PARAM} type="hidden" value={origin} />

      <ul className="flex flex-col gap-2 sm:gap-2.5">
        {options.map((option, index) => (
          <li key={option.id}>
            <button
              className={cn(
                ANSWER_OPTION_CLASS,
                "hover:bg-muted focus-visible:ring-ring/50 transition-[background-color,scale] outline-none focus-visible:ring-[3px] active:scale-[0.99] motion-reduce:transition-none",
              )}
              name={FIRST_ANSWER_PARAM}
              type="submit"
              value={option.id}
            >
              <AnswerOptionContent number={index + 1} text={option.text} />
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
