"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import {
  FeedbackExplanation,
  FeedbackNote,
  FeedbackPanel,
  FeedbackVerdict,
} from "../_components/feedback-panel";
import { ItemText } from "../questions/item-text";
import { QuestionMainButton } from "../session/question-block/question-actions";
import {
  WorkedSteps,
  useAnswerText,
  useVerdict,
} from "../session/question-block/question-feedback";
import { BankPracticeQuestion } from "./bank-practice-question";
import { DrillAnswerNotes } from "./drill/drill-answer-notes";
import { NotSureButton } from "./drill/drill-controls";
import { DrillCountdown } from "./drill/drill-countdown";
import { DrillIntro } from "./drill/drill-intro";
import { type LessonHref, isIdeaFirst, pressesCheck } from "./drill/drill-types";
import {
  type MistakePracticeFeedback,
  type PracticeAnswer,
  type PracticeStep as Step,
  getPracticeAnswer,
} from "./mistake-practice-state";
import { type useMistakePractice } from "./use-mistake-practice";

type Run = ReturnType<typeof useMistakePractice>;

function getMainAction(run: Run): React.ComponentProps<typeof QuestionMainButton> {
  const { phase } = run.state;

  if (phase.kind === "feedback") {
    return { action: "continue", onPress: run.next };
  }

  const selected = phase.kind === "answering" ? phase.selected : null;
  const answer = selected ?? (phase.kind === "answerFailed" ? phase.answer : null);

  return {
    action: "check",
    busy: phase.kind === "checking" && pressesCheck(phase.sender),
    disabled: !answer,
    onPress: () => {
      if (phase.kind === "answerFailed") {
        run.retry();
        return;
      }

      if (answer) {
        run.check(answer);
      }
    },
  };
}

export type LessonPracticeRenderer = (props: {
  answer: PracticeAnswer | null;
  disabled: boolean;
  lesson: NonNullable<Step["lesson"]>;
  onAnswer: (answer: PracticeAnswer | null) => void;
  onDontKnow: () => void;
  onCheck: (answer: PracticeAnswer) => void;
  onContinue: () => void;
  result: NonNullable<MistakePracticeFeedback>["lessonResult"];
  spoken: Extract<Run["state"]["phase"], { kind: "feedback" }>["spoken"];
  onRecord: Run["record"];
  recordIssue: Run["recordIssue"];
}) => React.ReactNode;

export function PracticeStepActions({ run, step }: { run: Run; step: Step }) {
  const t = useExtracted();
  const { phase } = run.state;
  const answering = phase.kind !== "feedback";
  const sender = phase.kind === "checking" ? phase.sender : null;
  const checking = sender !== null;

  return (
    <>
      {answering && (
        <NotSureButton
          busy={sender === "notSure"}
          disabled={checking}
          label={step.entry.drill.kind === "noGuessing" ? undefined : t("I don't know yet")}
          onClick={run.notSure}
        />
      )}

      {(step.lesson?.step.kind !== "challenge" || phase.kind === "feedback") && (
        <QuestionMainButton {...getMainAction(run)} />
      )}
    </>
  );
}

function FixedMistakesNote({ count }: { count: number }) {
  const t = useExtracted();

  if (count === 0) {
    return null;
  }

  return (
    <FeedbackNote>
      {t({
        description: '"Your notebook" is the learner\'s Mistakes notebook.',
        message:
          "{count, plural, =0 {No mistakes fixed} one {Mistake fixed. It leaves your notebook.} other {# mistakes fixed. They leave your notebook.}}",
        values: { count },
      })}
    </FeedbackNote>
  );
}

function PracticeFeedback({
  feedback,
  notSure,
  notes,
  question,
  trueFalseLabels,
}: {
  question: NonNullable<Step["question"]>;
  trueFalseLabels: TrueFalseLabels;
  feedback: NonNullable<MistakePracticeFeedback>;
  notSure: boolean;
  notes: React.ReactNode;
}) {
  const t = useExtracted();
  const verdict = useVerdict({ ...feedback, notSure });
  const fixed = feedback.fixedMistakeIds.length;
  const answerText = useAnswerText(trueFalseLabels);

  const correct =
    !feedback.isCorrect && question.format !== "multipleChoice" && question.format !== "trueFalse"
      ? answerText({ answer: feedback.correctAnswer, question })
      : null;

  return (
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite">
      <FeedbackVerdict tone={verdict.tone}>{verdict.label}</FeedbackVerdict>

      {correct && (
        <FeedbackExplanation>
          {t("Right answer: {answer}", { answer: correct })}
        </FeedbackExplanation>
      )}
      <WorkedSteps steps={feedback.workedSteps} />

      {feedback.explanation && (
        <FeedbackExplanation>
          <ItemText text={feedback.explanation} />
        </FeedbackExplanation>
      )}

      {notes}

      <FixedMistakesNote count={fixed} />
    </FeedbackPanel>
  );
}

function ReplayQuestion({
  run,
  step,
  renderLesson,
}: {
  run: Run;
  step: Step;
  renderLesson: LessonPracticeRenderer;
}) {
  if (!step.lesson) {
    return null;
  }

  const { phase } = run.state;
  const graded = phase.kind === "feedback" ? phase : null;

  return renderLesson({
    answer: getPracticeAnswer(run.state),
    disabled: phase.kind === "checking",
    lesson: step.lesson,
    onAnswer: run.select,
    onCheck: run.check,
    onContinue: run.next,
    onDontKnow: run.notSure,
    onRecord: run.record,
    recordIssue: run.recordIssue,
    result: graded?.feedback.lessonResult ?? null,
    spoken: graded?.spoken,
  });
}

export function PracticeStepView({
  lessonHref,
  run,
  step,
  trueFalseLabels,
  renderLesson,
}: {
  lessonHref: LessonHref | null;
  run: Run;
  step: Step;
  trueFalseLabels: TrueFalseLabels;
  renderLesson: LessonPracticeRenderer;
}) {
  const { phase } = run.state;
  const { drill } = step.entry;
  const { question } = step;

  if (phase.kind === "idea") {
    return <DrillIntro drill={drill} lessonHref={lessonHref} onStart={run.start} />;
  }

  const graded = phase.kind === "feedback" ? phase : null;

  return (
    <>
      {step.firstOfEntry && !isIdeaFirst(drill) && (
        <DrillIntro answered={graded !== null} drill={drill} lessonHref={lessonHref} />
      )}

      {drill.timeLimitSeconds !== null && phase.kind === "answering" && (
        <DrillCountdown
          key={step.lesson?.step.id ?? question?.itemId}
          onTimeUp={run.timeUp}
          seconds={drill.timeLimitSeconds}
        />
      )}

      <ReplayQuestion
        key={step.entry.mistakeId}
        run={run}
        step={step}
        renderLesson={renderLesson}
      />

      {question && (
        <BankPracticeQuestion
          key={question.itemId}
          question={question}
          run={run}
          trueFalseLabels={trueFalseLabels}
        />
      )}

      {graded && step.lesson && (
        <>
          <DrillAnswerNotes
            drill={drill}
            notSure={"dontKnow" in graded.answer}
            timedOut={graded.sender === "timer"}
            trap={graded.feedback.trap}
          />
          <FixedMistakesNote count={graded.feedback.fixedMistakeIds.length} />
        </>
      )}

      {graded && question && (
        <PracticeFeedback
          question={question}
          trueFalseLabels={trueFalseLabels}
          feedback={graded.feedback}
          notSure={graded.sender !== "timer" && "dontKnow" in graded.answer}
          notes={
            <DrillAnswerNotes
              drill={drill}
              notSure={"dontKnow" in graded.answer}
              timedOut={graded.sender === "timer"}
              trap={graded.feedback.trap}
            />
          }
        />
      )}
    </>
  );
}
