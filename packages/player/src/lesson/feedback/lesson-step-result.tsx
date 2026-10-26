"use client";

import { DiffLines } from "@zoonk/learn/diff-lines";
import { FeedbackExplanation, FeedbackPanel } from "@zoonk/learn/feedback-panel";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { useExtracted } from "next-intl";
import { type Verdict, VerdictLabel } from "../../components/verdict-label";
import { LessonRichText } from "../_components/lesson-rich-text";
import { isLanguageStep } from "../_utils/lesson-steps";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { WordHints } from "../steps/word-hints";
import { ExplainAnswer } from "./explain-answer";
import { LessonKeyPoints } from "./lesson-key-points";
import { HyperdriveStreak, type LessonResultNext, LessonResultNote } from "./lesson-result-notes";
import { LessonSpokenWords } from "./lesson-spoken-words";

/** Language screens whose options already show the right answer and the pick once checked. */
const OPTION_LANGUAGE_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "multipleChoice",
  "translation",
]);

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
    return result.answerText === null ? "sampleAnswer" : "unchecked";
  }

  if (result.isCorrect) {
    return result.spelling ? "typo" : "correct";
  }

  return result.score !== null && result.score > 0 ? "almost" : "incorrect";
}

/**
 * The right answer, for screens that don't show it themselves: language answers built from words.
 * Options already show it, and a written answer has its key points.
 */
function CorrectAnswerLine({
  result,
  step,
}: {
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();

  if (
    !result.correctAnswer ||
    result.isCorrect ||
    !result.checked ||
    !isLanguageStep(step) ||
    OPTION_LANGUAGE_KINDS.has(step.kind)
  ) {
    return null;
  }

  return (
    <FeedbackExplanation>
      <span className="text-muted-foreground">{t("Answer:")}</span>{" "}
      <span className="text-success-text font-medium">
        <LessonRichText text={result.correctAnswer} />
      </span>
    </FeedbackExplanation>
  );
}

/**
 * A written answer nothing checked: why, and the sample answer to compare it with. One the learner
 * didn't know has nothing to compare: the sample answer alone.
 */
function SampleAnswerLine({ result }: { result: LessonStepResult }) {
  const t = useExtracted();

  if (result.checked || !result.correctAnswer) {
    return null;
  }

  if (result.answerText === null) {
    return (
      <FeedbackExplanation>
        <LessonRichText text={result.correctAnswer} />
      </FeedbackExplanation>
    );
  }

  return (
    <FeedbackExplanation className="flex flex-col gap-1">
      <p className="text-muted-foreground">
        {t("Each question is checked a few times a day. Compare your answer with this one:")}
      </p>
      <p className="font-medium">
        <LessonRichText text={result.correctAnswer} />
      </p>
    </FeedbackExplanation>
  );
}

function SpellingLine({ spelling }: { spelling: string }) {
  const t = useExtracted();

  return (
    <FeedbackExplanation>
      <span className="text-muted-foreground">{t("Spelled:")}</span>{" "}
      <span className="text-success-text font-medium">
        <LessonRichText text={spelling} />
      </span>
    </FeedbackExplanation>
  );
}

/**
 * A language answer's form mistakes as a diff: each as the learner wrote it, then its right form.
 * The ideas were stated (the key points say so), only how they were written needs fixing.
 */
function CorrectionLines({ corrections }: { corrections: LessonStepResult["corrections"] }) {
  const t = useExtracted();

  return (
    <DiffLines
      labels={{ added: t("Correct answer"), removed: t("Your answer") }}
      lines={corrections.flatMap((correction) => [
        { kind: "removed" as const, text: correction.wrong },
        { kind: "added" as const, text: correction.right },
      ])}
    />
  );
}

/**
 * A written answer's key points, unless they'd read against its verdict: a right answer that left
 * out a detail, or one marked wrong with every point stated, shows the grader's feedback instead,
 * which explains the verdict. A language answer's corrections already say why its stated ideas
 * aren't right yet, so its key points stay.
 */
function getShownKeyPoints(result: LessonStepResult): LessonStepResult["keyPoints"] {
  if (!result.keyPoints || !result.feedback || result.corrections.length > 0) {
    return result.keyPoints;
  }

  const allMet = result.keyPoints.every((point) => point.met);
  return allMet === result.isCorrect ? result.keyPoints : null;
}

/**
 * The result of one screen, on the feedback panel under the question: the verdict (with
 * Hyperdrive's streak on its right), one why, and a faint last line on what happens next. The
 * options on screen already show what was picked and what was right, so nothing repeats them; a
 * written answer shows its key points instead of a paragraph (see `getShownKeyPoints`), a typo its
 * right spelling, a language answer's form mistakes as a diff, and a spoken one the words heard.
 */
export function LessonStepResultView({
  hyperdriveStreak,
  next,
  result,
  step,
}: {
  hyperdriveStreak: number | null;
  next: LessonResultNext;
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();
  const verdict = getVerdict({ result, step });
  const keyPoints = getShownKeyPoints(result);
  const { answerText } = result;
  const wordHints = "wordHints" in step ? step.wordHints : null;

  const canExplain =
    !result.isCorrect &&
    answerText &&
    (step.kind === "typedAnswer" || (step.kind === "spokenAnswer" && !result.feedback));

  return (
    <FeedbackPanel aria-label={t("Answer feedback")}>
      <div aria-live="polite" className="flex flex-col gap-2.5" role="status">
        <VerdictLabel
          end={
            hyperdriveStreak === null ? undefined : <HyperdriveStreak count={hyperdriveStreak} />
          }
          verdict={verdict}
        />
        {result.spelling && <SpellingLine spelling={result.spelling} />}
        {result.corrections.length > 0 && <CorrectionLines corrections={result.corrections} />}
        <CorrectAnswerLine result={result} step={step} />
        <SampleAnswerLine result={result} />
        {result.heard && step.kind === "spokenAnswer" && (
          <LessonSpokenWords heard={result.heard} language={step.content.language} />
        )}
        {keyPoints ? (
          <LessonKeyPoints keyPoints={keyPoints} />
        ) : (
          result.feedback && (
            <FeedbackExplanation>
              <RichTextBlocks text={result.feedback} />
            </FeedbackExplanation>
          )
        )}
        {wordHints && <WordHints hints={wordHints} />}
      </div>

      {canExplain && <ExplainAnswer answer={answerText} stepId={step.id} />}

      <LessonResultNote {...next} />
    </FeedbackPanel>
  );
}
