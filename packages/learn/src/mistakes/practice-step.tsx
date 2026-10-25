"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import {
  FeedbackExplanation,
  FeedbackNote,
  FeedbackPanel,
  FeedbackVerdict,
} from "../_components/feedback-panel";
import { type ChoiceAnswer, type ChoiceFeedback } from "../questions/choice-question";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemSupport, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { ChoiceQuestion, type ChoiceResult } from "../session/question-block/choice-question";
import { CheckButton, ContinueButton } from "../session/question-block/question-actions";
import { useVerdict } from "../session/question-block/question-feedback";
import { QuestionTitle } from "../session/question-block/question-title";
import {
  TrueFalseQuestion,
  type TrueFalseResult,
} from "../session/question-block/true-false-question";
import { DrillAnswerNotes } from "./drill/drill-answer-notes";
import { NotSureButton, ShowAnswersButton } from "./drill/drill-controls";
import { DrillCountdown } from "./drill/drill-countdown";
import { DrillIntro } from "./drill/drill-intro";
import { type LessonHref, isIdeaFirst, isReadFirst } from "./drill/drill-types";
import {
  type MistakePracticeFeedback,
  type PracticeStep as Step,
  isMistakeQuestion,
} from "./mistake-practice-state";
import { type useMistakePractice } from "./use-mistake-practice";

type Run = ReturnType<typeof useMistakePractice>;

/** The options an answer picks: one, several, or none for another shape. */
function getPicks(answer: ChoiceAnswer | null): number[] {
  if (!answer) {
    return [];
  }

  if ("selectedIndex" in answer) {
    return [answer.selectedIndex];
  }

  return "selectedIndexes" in answer ? answer.selectedIndexes : [];
}

/** What a graded choice question marks: the right options, and the learner's picks. */
function getChoiceResult({
  answer,
  feedback,
}: {
  answer: ChoiceAnswer;
  feedback: ChoiceFeedback;
}): ChoiceResult {
  return { correct: getPicks(feedback.correctAnswer), picked: getPicks(answer) };
}

/** What a graded statement marks: its right answer, and the learner's ("not sure" included). */
function getTrueFalseResult({
  answer,
  feedback,
}: {
  answer: ChoiceAnswer;
  feedback: ChoiceFeedback;
}): TrueFalseResult {
  const correct = feedback.correctAnswer;

  return {
    answer: "isTrue" in answer ? { isTrue: answer.isTrue } : { dontKnow: true },
    correct: "isTrue" in correct ? correct.isTrue : null,
  };
}

/**
 * The step's actions in the run's pinned bar: "Show the answers" while a misread is read; Check
 * the picked answer (or Enter) with the honest way out beside it; Continue once graded.
 */
export function PracticeStepActions({ run, step }: { run: Run; step: Step }) {
  const t = useExtracted();
  const { phase } = run.state;

  if (phase.kind === "reading") {
    return <ShowAnswersButton onReveal={run.reveal} />;
  }

  if (phase.kind === "feedback") {
    return <ContinueButton onContinue={run.next} />;
  }

  const selected = phase.kind === "answering" ? phase.selected : null;
  const retry = phase.kind === "answerFailed" ? phase.answer : null;
  const answer = selected ?? retry;
  const checking = phase.kind === "checking";

  return (
    <>
      {step.entry.drill.kind === "noGuessing" ? (
        <NotSureButton disabled={checking} onClick={run.notSure} />
      ) : (
        <Button disabled={checking} onClick={run.notSure} size="lg" variant="outline">
          {t("I don't know yet")}
        </Button>
      )}

      <CheckButton
        busy={checking}
        disabled={!answer}
        onCheck={() => (answer ? run.check(answer) : undefined)}
      />
    </>
  );
}

/**
 * The grade on the quiet feedback panel, said as the session says it: right or wrong, why, the
 * drill's notes (time running out, an honest "not sure", the trap) and, last, a fixed mistake.
 */
function PracticeFeedback({
  feedback,
  notSure,
  notes,
}: {
  feedback: NonNullable<MistakePracticeFeedback>;
  notSure: boolean;
  notes: React.ReactNode;
}) {
  const t = useExtracted();
  const verdict = useVerdict({ ...feedback, notSure });
  const fixed = feedback.fixedMistakeIds.length;

  return (
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite">
      <FeedbackVerdict tone={verdict.tone}>{verdict.label}</FeedbackVerdict>

      {feedback.explanation && (
        <FeedbackExplanation>
          <ItemText text={feedback.explanation} />
        </FeedbackExplanation>
      )}

      {notes}

      {fixed > 0 && (
        <FeedbackNote>
          {t(
            "{count, plural, =0 {No mistakes fixed} one {Mistake fixed. It leaves your notebook.} other {# mistakes fixed. They leave your notebook.}}",
            { count: fixed },
          )}
        </FeedbackNote>
      )}
    </FeedbackPanel>
  );
}

/**
 * The question's picture, chart or context, then the question itself, unless its statement sits
 * on its own card (`withTitle`).
 */
function QuestionLead({
  graded,
  question,
  withTitle,
}: {
  graded: boolean;
  question: Step["question"];
  withTitle: boolean;
}) {
  return (
    <>
      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
      {withTitle && <QuestionTitle muted={graded} text={question.question} />}
    </>
  );
}

/**
 * One question of the run, played by its drill: the idea first for a content gap, the question
 * before its answers for a misread, a clock for a timed drill, "I'm not sure" when guessing is the
 * habit, and the trap named after the answer in a trap drill. Its options and feedback are the
 * session's; its actions sit in the run's pinned bar (`PracticeStepActions`).
 */
export function PracticeStepView({
  lessonHref,
  run,
  step,
  trueFalseLabels,
}: {
  lessonHref: LessonHref | null;
  run: Run;
  step: Step;
  trueFalseLabels: TrueFalseLabels;
}) {
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { phase } = run.state;
  const { drill } = step.entry;
  const { question } = step;
  // A recording's plays count in this run, as practice: a mistake retried another time starts over.
  const runId = useMemo(() => crypto.randomUUID(), []);

  // The earlier answer belongs to the mistake's own question; next to another one it misleads.
  const lastAnswer = isMistakeQuestion(step) ? answerText(step.entry.snapshot.answer) : null;

  if (phase.kind === "idea") {
    return (
      <DrillIntro
        drill={drill}
        lastAnswer={lastAnswer}
        lessonHref={lessonHref}
        onStart={run.start}
      />
    );
  }

  const graded = phase.kind === "feedback" ? phase : null;
  const disabled = phase.kind === "checking";

  return (
    <>
      {/* A gap's idea had its own screen; other drills say how they work above their first
          question, and a misread above each one, since each waits behind "Show the answers".
          From `lg` the run's aside says it beside every question (`PracticeAside`). */}
      {!isIdeaFirst(drill) && (step.firstOfEntry || isReadFirst(drill)) && (
        <div className="contents lg:hidden">
          <DrillIntro
            answered={graded !== null}
            drill={drill}
            lastAnswer={step.firstOfEntry ? lastAnswer : null}
            lessonHref={lessonHref}
          />
        </div>
      )}

      {drill.timeLimitSeconds !== null && phase.kind === "answering" && (
        <DrillCountdown
          key={question.itemId}
          onTimeUp={run.timeUp}
          seconds={drill.timeLimitSeconds}
        />
      )}

      {question.set && (
        <ItemSetStimulus askedIn={runId} key={question.itemId} practice set={question.set} />
      )}

      <section aria-label={question.question} className="flex flex-col gap-4" key={question.itemId}>
        {phase.kind === "reading" ? (
          <QuestionLead graded={false} question={question} withTitle />
        ) : (
          <>
            <QuestionLead
              graded={graded !== null}
              question={question}
              withTitle={question.format !== "trueFalse"}
            />

            {question.format === "trueFalse" ? (
              <TrueFalseQuestion
                allowBlank={false}
                disabled={disabled}
                onChange={run.select}
                result={graded ? getTrueFalseResult(graded) : null}
                statement={question.question}
                trueFalseLabels={trueFalseLabels}
              />
            ) : (
              <ChoiceQuestion
                disabled={disabled}
                onChange={run.select}
                options={question.options ?? []}
                result={graded ? getChoiceResult(graded) : null}
                select={question.select}
              />
            )}
          </>
        )}
      </section>

      {graded && (
        <PracticeFeedback
          feedback={graded.feedback}
          notSure={!graded.timedOut && "dontKnow" in graded.answer}
          notes={
            <DrillAnswerNotes
              drill={drill}
              notSure={"dontKnow" in graded.answer}
              timedOut={graded.timedOut}
              trap={graded.feedback.trap}
            />
          }
        />
      )}
    </>
  );
}
