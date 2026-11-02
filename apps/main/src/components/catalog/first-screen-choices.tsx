"use client";

import { ANSWER_OPTION_CLASS, AnswerOptionContent } from "@/components/public/answer-option";
import { FIRST_ANSWER_PARAM, ORIGIN_PARAM } from "@/lib/public/public-hrefs";
import { trackEvent } from "@zoonk/core/analytics/client";
import { cn } from "@zoonk/ui/lib/utils";

/** Each option submits a plain GET form, so an answer opens the player even before the page's scripts load. */
export function FirstScreenChoices({
  action,
  lessonId,
  options,
  origin,
  questionId,
}: {
  action: string;
  lessonId: string;
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
                "hover:bg-muted focus-visible:ring-ring/50 press outline-none [--press-scale:0.99] focus-visible:ring-[3px]",
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
