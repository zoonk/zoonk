import { FIRST_ANSWER_PARAM } from "@/lib/public/public-hrefs";
import { AnswerOption, AnswerOptionGroup } from "@zoonk/learn/answer-option";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { LessonRichText } from "@zoonk/player/lesson/rich-text";
import { FirstAnswerForm } from "./first-answer-form";

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
      <AnswerOptionGroup role="group">
        {options.map((option, index) => (
          <AnswerOption
            key={option.id}
            marker={index + 1}
            name={FIRST_ANSWER_PARAM}
            picked={false}
            type="submit"
            value={option.id}
          >
            <LessonRichText text={option.text} />
          </AnswerOption>
        ))}
      </AnswerOptionGroup>
    </FirstAnswerForm>
  );
}
