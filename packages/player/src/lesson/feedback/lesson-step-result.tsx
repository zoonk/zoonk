"use client";

import { DiffLines } from "@zoonk/learn/diff-lines";
import {
  FeedbackAnswerLabel,
  FeedbackAnswerValue,
  FeedbackExplanation,
  FeedbackPanel,
} from "@zoonk/learn/feedback-panel";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { RightAnswerLine } from "@zoonk/learn/right-answer-line";
import { type Verdict, VerdictLabel } from "@zoonk/learn/verdict-label";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../_components/lesson-rich-text";
import { isLanguageStep } from "../_utils/lesson-steps";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { WordHints } from "../steps/word-hints";
import { ExplainAnswer } from "./explain-answer";
import { LessonKeyPoints } from "./lesson-key-points";
import { HyperdriveStreak, type LessonResultNext, LessonResultNote } from "./lesson-result-notes";
import { LessonSpokenWords } from "./lesson-spoken-words";

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

function LabeledAnswerLine({ label, text }: { label: string; text: string }) {
  return (
    <FeedbackExplanation>
      <FeedbackAnswerLabel>{label}</FeedbackAnswerLabel>{" "}
      <FeedbackAnswerValue>
        <LessonRichText text={text} />
      </FeedbackAnswerValue>
    </FeedbackExplanation>
  );
}

function CorrectAnswerLine({
  result,
  step,
}: {
  result: LessonStepResult;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();

  if (!result.correctAnswer || !result.checked) {
    return null;
  }

  if (result.isCorrect) {
    return (
      <LabeledAnswerLine
        label={t({
          description:
            "After a right answer whose words came in another order, before the lesson's own version of the sentence, which is right too.",
          message: "Also correct:",
        })}
        text={result.correctAnswer}
      />
    );
  }

  if (!isLanguageStep(step) || OPTION_LANGUAGE_KINDS.has(step.kind)) {
    return null;
  }

  return <RightAnswerLine answer={<LessonRichText text={result.correctAnswer} />} />;
}

/**
 * Why an answer wasn't checked: a sample asked for, a question checked a few times today (with its
 * sample to compare), or a screen a fix changed after the learner started, which has no answer to
 * show since they may still see the old screen.
 */
function UncheckedLine({ result }: { result: LessonStepResult }) {
  const t = useExtracted();

  if (result.checked) {
    return null;
  }

  if (!result.correctAnswer) {
    return (
      <FeedbackExplanation className="text-muted-foreground">
        {t({
          description:
            "Under “Not checked this time”: we corrected this lesson question while the learner was in the lesson, so their answer isn't graded either way.",
          message: "This question was updated after you started, so this answer doesn't count.",
        })}
      </FeedbackExplanation>
    );
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
        {t(
          "This question was already checked a few times today, so this answer doesn't count. Compare it with this one:",
        )}
      </p>
      <p className="font-medium">
        <LessonRichText text={result.correctAnswer} />
      </p>
    </FeedbackExplanation>
  );
}

function SpellingLine({ spelling }: { spelling: string }) {
  const t = useExtracted();
  return <LabeledAnswerLine label={t("Spelled:")} text={spelling} />;
}

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

function getShownKeyPoints(result: LessonStepResult): LessonStepResult["keyPoints"] {
  if (!result.keyPoints || !result.feedback || result.corrections.length > 0) {
    return result.keyPoints;
  }

  const allMet = result.keyPoints.every((point) => point.met);
  return allMet === result.isCorrect ? result.keyPoints : null;
}

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
    step.kind === "typedAnswer" && result.checked && !result.isCorrect && answerText;

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
        <UncheckedLine result={result} />
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
