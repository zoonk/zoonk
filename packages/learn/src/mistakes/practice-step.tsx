"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import {
  FeedbackExplanation,
  FeedbackNote,
  FeedbackPanel,
  FeedbackVerdict,
} from "../_components/feedback-panel";
import { MainActionSlot, usePlacedSound } from "../_components/main-action-slot";
import { checksEachPair } from "../_components/match-board-state";
import { QuestionDontKnow, QuestionMainAction } from "../_components/question-actions";
import { ItemText } from "../questions/item-text";
import { RightAnswerLine } from "../questions/right-answer-line";
import {
  AnswerMatchMisses,
  WorkedSteps,
  showsItsAnswer,
  useAnswerLine,
  useVerdict,
} from "../session/question-block/question-feedback";
import { BankPracticeQuestion } from "./bank-practice-question";
import { DrillAnswerNotes } from "./drill/drill-answer-notes";
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

/** A board checked pair by pair sends itself with its last pair, so its action waits as Continue. */
function sendsItself({ lesson, question }: Step): boolean {
  return lesson ? checksEachPair(lesson.step) : Boolean(question?.key);
}

function getMainAction(run: Run, step: Step): React.ComponentProps<typeof QuestionMainAction> {
  const { phase } = run.state;

  if (phase.kind === "feedback") {
    return { action: "continue", onPress: run.next };
  }

  const selected = phase.kind === "answering" ? phase.selected : null;
  const answer = selected ?? (phase.kind === "answerFailed" ? phase.answer : null);

  return {
    action: sendsItself(step) ? "continue" : "check",
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
  /** What the notebook adds to the feedback, such as "Mistake fixed", drawn with the step's own. */
  notes: React.ReactNode;
  onAnswer: (answer: PracticeAnswer | null) => void;
  onDontKnow: () => void;
  onCheck: (answer: PracticeAnswer) => void;
  onContinue: () => void;
  result: NonNullable<MistakePracticeFeedback>["lessonResult"];
  spoken: Extract<Run["state"]["phase"], { kind: "feedback" }>["spoken"];
  onRecord: Run["record"];
  recordIssue: Run["recordIssue"];
}) => React.ReactNode;

export function PracticeStepActions({
  ask,
  run,
  step,
}: {
  ask?: React.ReactNode;
  run: Run;
  step: Step;
}) {
  const t = useExtracted();
  const { phase } = run.state;
  const answering = phase.kind !== "feedback";
  const sender = phase.kind === "checking" ? phase.sender : null;
  const checking = sender !== null;
  const sound = usePlacedSound();

  return (
    <>
      {answering && (
        <QuestionDontKnow busy={sender === "notSure"} disabled={checking} onPress={run.notSure}>
          {step.entry.drill.kind === "noGuessing" && t("I'm not sure")}
        </QuestionDontKnow>
      )}

      {sound}

      {(step.lesson?.step.kind !== "challenge" || phase.kind === "feedback") && (
        <MainActionSlot>
          <QuestionMainAction {...getMainAction(run, step)} />
        </MainActionSlot>
      )}

      {ask}
    </>
  );
}

/** Fixed entries leave the notebook; a right answer on the day of the miss fixes nothing yet. */
function NotebookNote({ feedback }: { feedback: NonNullable<MistakePracticeFeedback> }) {
  const t = useExtracted();
  const count = feedback.fixedMistakeIds.length;

  if (count > 0) {
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

  if (feedback.requiresLaterDay) {
    return (
      <FeedbackNote>
        {t({
          description:
            "After a right answer to a question the learner missed earlier the same day. A mistake is fixed only by a right answer on a later day.",
          message: "This question comes back another day to make sure.",
        })}
      </FeedbackNote>
    );
  }

  return null;
}

function PracticeFeedback({
  answer,
  feedback,
  notSure,
  notes,
  question,
  trueFalseLabels,
}: {
  answer: PracticeAnswer;
  question: NonNullable<Step["question"]>;
  trueFalseLabels: TrueFalseLabels;
  feedback: NonNullable<MistakePracticeFeedback>;
  notSure: boolean;
  notes: React.ReactNode;
}) {
  const t = useExtracted();
  const verdict = useVerdict({ ...feedback, notSure });
  const answerLine = useAnswerLine(trueFalseLabels);

  const correct =
    !feedback.isCorrect && !showsItsAnswer(question)
      ? answerLine({ answer: feedback.correctAnswer, question })
      : null;

  return (
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite">
      <FeedbackVerdict tone={verdict.tone}>{verdict.label}</FeedbackVerdict>

      <AnswerMatchMisses answer={answer} question={question} />
      {correct && <RightAnswerLine answer={correct} />}
      <WorkedSteps steps={feedback.workedSteps} />

      {feedback.explanation && (
        <FeedbackExplanation>
          <ItemText text={feedback.explanation} />
        </FeedbackExplanation>
      )}

      {notes}

      <NotebookNote feedback={feedback} />
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
    notes: graded && (
      <>
        <DrillAnswerNotes
          drill={step.entry.drill}
          notSure={"dontKnow" in graded.answer}
          timedOut={graded.sender === "timer"}
          trap={graded.feedback.trap}
        />
        <NotebookNote feedback={graded.feedback} />
      </>
    ),
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

      {graded && question && (
        <PracticeFeedback
          answer={graded.answer}
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
