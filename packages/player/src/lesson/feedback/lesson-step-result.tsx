"use client";

import { useExtracted } from "next-intl";
import { type Verdict, VerdictLabel } from "../../components/verdict-label";
import { LessonRichText, LessonRichTextBlocks } from "../_components/lesson-rich-text";
import { isLanguageStep } from "../_utils/lesson-steps";
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

  if (!result.checked) {
    return "unchecked";
  }

  if (result.isCorrect) {
    return result.spelling ? "typo" : "correct";
  }

  return result.score !== null && result.score > 0 ? "almost" : "incorrect";
}

/**
 * The right answer, for screens that don't show it themselves: language answers built from words.
 * Options already turn green and red, and a written answer has its key points.
 */
function CorrectAnswerLine({
  result,
  step,
}: {
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();

  if (!result.correctAnswer || result.isCorrect || !result.checked || !isLanguageStep(step)) {
    return null;
  }

  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{t("Answer:")}</span>{" "}
      <span className="text-success font-medium">
        <LessonRichText text={result.correctAnswer} />
      </span>
    </p>
  );
}

/** A written answer nothing checked: why, and the sample answer to compare it with. */
function UncheckedLine({ sampleAnswer }: { sampleAnswer: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-muted-foreground">
        {t("Each question is checked a few times a day. Compare your answer with this one:")}
      </p>
      <p className="text-base font-medium">
        <LessonRichText text={sampleAnswer} />
      </p>
    </div>
  );
}

function SpellingLine({ spelling }: { spelling: string }) {
  const t = useExtracted();

  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{t("Spelled:")}</span>{" "}
      <span className="text-success font-medium">
        <LessonRichText text={spelling} />
      </span>
    </p>
  );
}

/**
 * A language answer's form mistakes, each struck through next to its right form: the ideas were
 * stated (the key points say so), only how they were written needs fixing.
 */
function CorrectionLines({ corrections }: { corrections: LessonStepResult["corrections"] }) {
  const t = useExtracted();

  return (
    <ul className="flex flex-col gap-1 text-sm" data-slot="lesson-corrections">
      {corrections.map((correction) => (
        <li
          className="flex flex-wrap items-baseline gap-x-2"
          key={`${correction.wrong}→${correction.right}`}
        >
          <span className="text-muted-foreground decoration-destructive line-through decoration-2">
            <span className="sr-only">{t("Your answer:")} </span>
            {correction.wrong}
          </span>{" "}
          <span className="text-success font-medium">
            <span className="sr-only">{t("Correct answer:")} </span>
            {correction.right}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The result of one screen, shown under the question: the verdict and one why. The options on
 * screen already show what was picked and what was right, so nothing repeats them; a written
 * answer shows its key points instead of a paragraph, a typo its right spelling, a language
 * answer's form mistakes their corrections, and a spoken one the words heard.
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
        {result.spelling && <SpellingLine spelling={result.spelling} />}
        {result.corrections.length > 0 && <CorrectionLines corrections={result.corrections} />}
        <CorrectAnswerLine result={result} step={step} />
        {!result.checked && result.correctAnswer && (
          <UncheckedLine sampleAnswer={result.correctAnswer} />
        )}
        {result.heard && step.kind === "spokenAnswer" && (
          <LessonSpokenWords heard={result.heard} language={step.content.language} />
        )}
        {result.keyPoints ? (
          <LessonKeyPoints keyPoints={result.keyPoints} />
        ) : (
          result.feedback && (
            <LessonRichTextBlocks className="text-base leading-relaxed" text={result.feedback} />
          )
        )}
        {wordHints && <WordHints hints={wordHints} />}
      </div>

      {canExplain && <ExplainAnswer answer={answerText} stepId={step.id} />}
    </section>
  );
}
