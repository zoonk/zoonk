import { ANSWER_OPTION_CLASS, AnswerOptionContent } from "@/components/public/answer-option";
import { FIRST_ANSWER_PARAM } from "@/lib/public/public-hrefs";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { cn } from "@zoonk/ui/lib/utils";
import { FirstAnswerForm } from "./first-answer-form";

/** Chromium leaves MathML out of a button's name, so each option and the form are named in words. */
export function FirstScreenChoices({
  action,
  lessonId,
  options,
  origin,
  question,
}: {
  action: string;
  lessonId: string;
  origin: string;
  options: { id: string; text: string }[];
  question: string;
}) {
  const spoken = useSpokenText();

  return (
    <FirstAnswerForm
      action={action}
      label={spoken.blocks(question)}
      lessonId={lessonId}
      origin={origin}
    >
      <ul className="flex flex-col gap-2 sm:gap-2.5">
        {options.map((option, index) => (
          <li key={option.id}>
            <button
              aria-label={spoken.inline(option.text)}
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
    </FirstAnswerForm>
  );
}
