"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { fractionDigitsFor } from "@zoonk/utils/localized-number";
import { useExtracted } from "next-intl";
import { VerdictLabel } from "../../components/verdict-label";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

const FEEDBACK_FRACTION_DIGITS = 2;

type ChoiceCheck = Extract<ActivityStepContent["check"], { kind: "choice" }>;
type NumericCheck = Extract<ActivityStepContent["check"], { kind: "numeric" }>;

function FeedbackText({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      <LessonRichText text={children} />
    </p>
  );
}

/** The chosen option's reason; after a wrong pick, also the right option and why it's right. */
function ChoiceFeedback({ answer, check }: { answer: ActivityAnswer | null; check: ChoiceCheck }) {
  const t = useExtracted();

  const chosen = check.options.find(
    (option) => answer?.kind === "choice" && option.id === answer.optionId,
  );

  const correct = check.options.find((option) => option.isCorrect);

  return (
    <>
      {chosen && <FeedbackText>{chosen.reason}</FeedbackText>}

      {correct && !chosen?.isCorrect && (
        <>
          <p className="text-sm leading-relaxed">
            <span className="text-muted-foreground">{t("Correct answer:")}</span>{" "}
            <span className="text-success font-medium">
              <LessonRichText text={correct.text} />
            </span>
          </p>

          <FeedbackText>{correct.reason}</FeedbackText>
        </>
      )}
    </>
  );
}

/** The learner's number next to the one code computed, then how it's worked out. */
function NumericFeedback({
  answer,
  check,
  isCorrect,
}: {
  answer: ActivityAnswer | null;
  check: NumericCheck;
  isCorrect: boolean;
}) {
  const t = useExtracted();
  const format = useFormatNumber();

  /* Exact enough to tell a near miss from the answer, like 3,869.68 next to 3,870. */
  const exact = (value: number) =>
    format(value, {
      maximumFractionDigits: Math.max(fractionDigitsFor(value), FEEDBACK_FRACTION_DIGITS),
      unit: check.unit,
    });

  return (
    <>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
        {answer?.kind === "numeric" && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{t("Your answer:")}</dt>
            <dd className="font-medium">{exact(answer.value)}</dd>
          </div>
        )}

        {!isCorrect && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{t("Answer:")}</dt>
            <dd className="text-success font-medium">{exact(check.answer)}</dd>
          </div>
        )}
      </dl>

      <FeedbackText>{check.explanation}</FeedbackText>
    </>
  );
}

/**
 * The verdict and the why after an activity's check. It reads the check's own explanation or
 * option reasons and code's computed answer, never a model's judgment of the learner.
 */
export function ActivityFeedback({
  answer,
  content,
  isCorrect,
}: {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  isCorrect: boolean;
}) {
  const t = useExtracted();
  const { check } = content;

  return (
    <div
      aria-label={t("Answer feedback")}
      aria-live="polite"
      className="flex flex-col gap-2"
      data-slot="activity-feedback"
      role="region"
    >
      <VerdictLabel verdict={isCorrect ? "correct" : "incorrect"} />

      {check.kind === "choice" && <ChoiceFeedback answer={answer} check={check} />}

      {check.kind === "numeric" && (
        <NumericFeedback answer={answer} check={check} isCorrect={isCorrect} />
      )}

      {check.kind === "interaction" && <FeedbackText>{check.explanation}</FeedbackText>}
    </div>
  );
}
