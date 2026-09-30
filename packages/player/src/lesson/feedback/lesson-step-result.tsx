"use client";

import { useExtracted } from "next-intl";
import { type Verdict, VerdictLabel } from "../../components/verdict-label";
import { LessonRichText, LessonRichTextBlocks } from "../_components/lesson-rich-text";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { WordHints } from "../steps/word-hints";
import { ExplainAnswer } from "./explain-answer";
import { LessonKeyPoints } from "./lesson-key-points";
import { LessonSpokenWords } from "./lesson-spoken-words";

function getVerdict({
  result,
  step,
}: {
  result: LessonStepResult;
  step: PlayableLibraryStep;
}): Verdict {
  if (step.kind === "hook") {
    return result.isCorrect ? "guessRight" : "guess";
  }

  if (result.isCorrect) {
    return result.spelling ? "typo" : "correct";
  }

  return result.score !== null && result.score > 0 ? "almost" : "incorrect";
}

function AnswerLines({
  answerText,
  result,
  step,
}: {
  answerText: string | null;
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();
  const isOpenAnswer = step.kind === "typedAnswer" || step.kind === "spokenAnswer";

  return (
    <dl className="flex flex-col gap-1 text-sm">
      {answerText && !isOpenAnswer && (
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">
            {step.kind === "hook" ? t("Your guess:") : t("You chose:")}
          </dt>
          <dd className="font-medium">
            <LessonRichText text={answerText} />
          </dd>
        </div>
      )}

      {result.spelling && (
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">{t("Spelled:")}</dt>
          <dd className="text-success font-medium">
            <LessonRichText text={result.spelling} />
          </dd>
        </div>
      )}

      {result.correctAnswer && (
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">
            {isOpenAnswer ? t("A full answer:") : t("Answer:")}
          </dt>
          <dd className="text-success font-medium">
            <LessonRichText text={result.correctAnswer} />
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * The result of one screen, shared by both modes: the verdict, the learner's answer next to the
 * right one (or the right spelling, when a typo was all that was off), the why, and key points or
 * words heard. Focus shows it under the question; Fun shows
 * it on the back of the paper.
 */
export function LessonStepResultView({
  result,
  step,
}: {
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const verdict = getVerdict({ result, step });
  const { answerText } = result;
  const wordHints = "wordHints" in step ? step.wordHints : null;

  const canExplain =
    !result.isCorrect &&
    answerText &&
    (step.kind === "typedAnswer" || (step.kind === "spokenAnswer" && !result.feedback));

  return (
    <section
      className="bg-muted/40 flex flex-col gap-4 rounded-2xl p-4 sm:p-5"
      data-slot="lesson-step-result"
    >
      <div aria-live="polite" className="flex flex-col gap-3" role="status">
        <VerdictLabel verdict={verdict} />
        <AnswerLines answerText={answerText} result={result} step={step} />
        {result.heard && step.kind === "spokenAnswer" && (
          <LessonSpokenWords heard={result.heard} language={step.content.language} />
        )}
        {result.keyPoints && <LessonKeyPoints keyPoints={result.keyPoints} />}
        {result.feedback && (
          <LessonRichTextBlocks className="text-base leading-relaxed" text={result.feedback} />
        )}
        {wordHints && <WordHints hints={wordHints} />}
      </div>

      {canExplain && <ExplainAnswer answer={answerText} stepId={step.id} />}
    </section>
  );
}
