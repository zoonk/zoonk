"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { type ListeningQuestions } from "../../listening/listening-stimulus";
import { DrillAnswerNotes } from "../../mistakes/drill/drill-answer-notes";
import { NotSureButton, ShowAnswersButton } from "../../mistakes/drill/drill-controls";
import { DrillCountdown } from "../../mistakes/drill/drill-countdown";
import { DrillIntro } from "../../mistakes/drill/drill-intro";
import {
  type Drill,
  type LessonHref,
  isIdeaFirst,
  isReadFirst,
} from "../../mistakes/drill/drill-types";
import { ItemSetStimulus } from "../../questions/item-set-stimulus";
import { ItemLine, ItemSupport } from "../../questions/item-text";
import {
  type StudyAnswerFeedback,
  type StudyBlockDetail,
  type StudyQuestion,
} from "../session-types";
import { PlacementNote } from "./placement-note";
import { type QuestionBlockPhase } from "./question-block-state";
import { QuestionView } from "./question-view";
import { QuotedSource } from "./quoted-source";
import { type useQuestionBlock } from "./use-question-block";

const MS_PER_SECOND = 1000;
const NOT_SURE = { dontKnow: true } as const;

type Run = ReturnType<typeof useQuestionBlock>;

/** Before its question opens: a gap's idea first, then a misread's question before its answers. */
type DrillStage = "idea" | "open" | "reading";

function getOpeningStage({ drill, first }: { drill: Drill | null; first: boolean }): DrillStage {
  if (first && isIdeaFirst(drill)) {
    return "idea";
  }

  return isReadFirst(drill) ? "reading" : "open";
}

/**
 * The saved mistake's drill the current question belongs to, if any, and where the question
 * stands in it. It starts over with every question.
 */
export function useBlockDrill({ detail, index }: { detail: StudyBlockDetail; index: number }) {
  const question = detail.questions[index] ?? null;
  const drill = question?.drill ?? null;
  const first = drill !== null && detail.questions[index - 1]?.mistakeId !== question?.mistakeId;
  const opening = { index, stage: getOpeningStage({ drill, first }), timedOut: false };
  const [state, setState] = useState(opening);
  const current = state.index === index ? state : opening;

  if (state.index !== index) {
    setState(opening);
  }

  return {
    drill,
    first,
    reveal: () => setState({ ...current, stage: "open" }),
    stage: current.stage,
    start: () => setState({ ...current, stage: isReadFirst(drill) ? "reading" : "open" }),
    timeUp: () => setState({ ...current, timedOut: true }),
    timedOut: current.timedOut,
  };
}

type BlockDrill = ReturnType<typeof useBlockDrill>;

/**
 * A gap's idea had its own screen; other drills say how they work above their first question, and
 * a misread above each one, since each waits behind "Show the answers".
 */
function showsDrillIntro({ drill, first }: Pick<BlockDrill, "drill" | "first">): boolean {
  return drill !== null && !isIdeaFirst(drill) && (first || isReadFirst(drill));
}

/** The drill's notes under the grade: time running out, an honest "not sure", the trap. */
export function BlockDrillNotes({
  blockDrill,
  feedback,
  phase,
}: {
  blockDrill: BlockDrill;
  feedback: StudyAnswerFeedback;
  phase: QuestionBlockPhase;
}) {
  const answer = phase.kind === "feedback" ? phase.answer : null;

  return (
    <DrillAnswerNotes
      drill={blockDrill.drill}
      notSure={answer !== null && "dontKnow" in answer}
      timedOut={blockDrill.timedOut}
      trap={feedback.trap}
    />
  );
}

/** Whether the question before this one in the block was on the same text, case or recording. */
function isSetContinued({ detail, index }: { detail: StudyBlockDetail; index: number }): boolean {
  const set = detail.questions[index]?.set;
  return Boolean(set) && detail.questions[index - 1]?.set?.id === set?.id;
}

/**
 * The questions of the current one's recording in the block, in order, for the learner to read
 * before it plays.
 */
function getRecordingQuestions({
  detail,
  question,
}: {
  detail: StudyBlockDetail;
  question: StudyQuestion;
}): ListeningQuestions {
  const onRecording = detail.questions.filter((other) => other.set?.id === question.set?.id);

  return {
    current: onRecording.findIndex((other) => other.itemId === question.itemId),
    prompts: onRecording.map((other) => other.question),
  };
}

/**
 * A recording above its set's questions. Keyed by its set, it stays mounted from the set's first
 * question to its last, so it keeps playing while the learner answers along and reads each
 * answer's feedback, as in the exam. Its plays count in this block, as practice: one cut off by a
 * reload comes back once.
 */
function BlockRecording({
  detail,
  phase,
  question,
}: {
  detail: StudyBlockDetail;
  phase: QuestionBlockPhase;
  question: StudyQuestion;
}) {
  if (!question.set?.listening) {
    return null;
  }

  return (
    <ItemSetStimulus
      askedIn={detail.block.id}
      key={question.set.id}
      practice
      questions={getRecordingQuestions({ detail, question })}
      set={question.set}
      transcript={phase.kind === "feedback" ? phase.feedback.transcript : null}
    />
  );
}

/** A text, case or chart above each of its questions; a recording plays above them all. */
function hasTextStimulus(question: StudyQuestion): boolean {
  return Boolean(question.set) && !question.set?.listening;
}

function QuestionText({ continued, question }: { continued: boolean; question: StudyQuestion }) {
  return (
    <>
      <PlacementNote question={question} />
      <QuotedSource question={question} />
      {question.set && hasTextStimulus(question) && (
        <ItemSetStimulus continued={continued} key={question.itemId} set={question.set} />
      )}
      <ItemSupport
        className="text-muted-foreground text-sm leading-relaxed"
        context={question.context}
        image={question.image}
        visual={question.visual}
      />
      {question.format !== "trueFalse" && (
        <h2 className="text-xl leading-snug font-semibold">
          <ItemLine text={question.question} />
        </h2>
      )}
    </>
  );
}

/**
 * The current question, played the way its mistake's drill calls for: the idea first for
 * a content gap, the question before its answers for a misread, a clock for a timed drill and "I'm
 * not sure" where guessing is the habit. Other questions play as they are.
 */
export function BlockQuestion({
  blockDrill,
  detail,
  lessonHref,
  question,
  run,
}: {
  blockDrill: BlockDrill;
  detail: StudyBlockDetail;
  lessonHref: LessonHref | null;
  question: StudyQuestion;
  run: Run;
}) {
  const t = useExtracted();
  const { phase } = run.state;
  const { drill, stage } = blockDrill;
  const answering = phase.kind === "answering" || phase.kind === "answerFailed";

  if (drill && stage === "idea") {
    return <DrillIntro drill={drill} lessonHref={lessonHref} onStart={blockDrill.start} />;
  }

  function timeUp() {
    blockDrill.timeUp();
    void run.submit(NOT_SURE, { minDurationMs: (drill?.timeLimitSeconds ?? 0) * MS_PER_SECOND });
  }

  return (
    <>
      {showsDrillIntro(blockDrill) && drill && <DrillIntro drill={drill} lessonHref={lessonHref} />}

      {drill?.timeLimitSeconds && phase.kind === "answering" && (
        <DrillCountdown
          key={`clock-${question.itemId}`}
          onTimeUp={timeUp}
          seconds={drill.timeLimitSeconds}
        />
      )}

      <BlockRecording detail={detail} phase={phase} question={question} />

      <section
        aria-label={question.question}
        className="flex flex-col gap-4 rounded-3xl"
        key={question.itemId}
      >
        {stage === "reading" ? (
          <>
            <QuotedSource question={question} />
            {question.set && hasTextStimulus(question) && (
              <ItemSetStimulus
                continued={isSetContinued({ detail, index: run.state.index })}
                key={question.itemId}
                set={question.set}
              />
            )}
            <ItemSupport
              className="text-muted-foreground text-sm leading-relaxed"
              context={question.context}
              image={question.image}
              visual={question.visual}
            />
            <h2 className="text-xl leading-snug font-semibold">
              <ItemLine text={question.question} />
            </h2>
          </>
        ) : (
          <>
            <QuestionText
              continued={isSetContinued({ detail, index: run.state.index })}
              question={question}
            />
            <QuestionView
              detail={detail}
              onAnswer={(answer) => void run.submit(answer)}
              phase={phase}
              question={question}
            />
          </>
        )}
      </section>

      {stage === "reading" && <ShowAnswersButton onReveal={blockDrill.reveal} />}

      {drill?.kind === "noGuessing" && stage === "open" && answering && (
        <NotSureButton disabled={false} onClick={() => void run.submit(NOT_SURE)} />
      )}

      {question.placement && !drill && answering && (
        <NotSureButton
          disabled={false}
          label={t("I don't know yet")}
          onClick={() => void run.submit(NOT_SURE)}
        />
      )}
    </>
  );
}
