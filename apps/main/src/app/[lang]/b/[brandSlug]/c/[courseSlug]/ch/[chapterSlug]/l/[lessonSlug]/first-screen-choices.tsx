"use client";

import { ANSWER_OPTION_CLASS, AnswerOptionContent } from "@/components/public/answer-option";
import { FIRST_ANSWER_PARAM } from "@/lib/public/public-hrefs";
import { trackEvent } from "@zoonk/core/analytics/client";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The lesson's first question, answerable right on the page. Each option is a
 * submit button of a plain GET form, so any answer opens the player with it
 * (and still works before the page's scripts load).
 */
export function FirstScreenChoices({
  action,
  lessonId,
  options,
  questionId,
}: {
  action: string;
  lessonId: string;
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
      <ul className="flex flex-col gap-2 sm:gap-2.5">
        {options.map((option, index) => (
          <li key={option.id}>
            <button
              className={cn(
                ANSWER_OPTION_CLASS,
                "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 transition-[background-color,scale] outline-none focus-visible:ring-[3px] active:scale-[0.99] motion-reduce:transition-none sm:min-h-[52px]",
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
