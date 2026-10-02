"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
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
import { ItemLine, ItemText } from "../../questions/item-text";
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

function QuestionText({ question }: { question: StudyQuestion }) {
  return (
    <>
      <PlacementNote question={question} />
      <QuotedSource question={question} />
      {question.context && (
        <ItemText
          className="text-muted-foreground text-sm leading-relaxed"
          text={question.context}
        />
      )}
      {question.format !== "trueFalse" && (
        <h2 className="text-xl leading-snug font-semibold">
          <ItemLine text={question.question} />
        </h2>
      )}
    </>
  );
}

/**
 * The current question on paper, played the way its mistake's drill calls for: the idea first for
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
      {/* A gap's idea had its own screen; other drills say how they work above the question. */}
      {drill && blockDrill.first && !isIdeaFirst(drill) && (
        <DrillIntro drill={drill} lessonHref={lessonHref} />
      )}

      {drill?.timeLimitSeconds && phase.kind === "answering" && (
        <DrillCountdown
          key={`clock-${question.itemId}`}
          onTimeUp={timeUp}
          seconds={drill.timeLimitSeconds}
        />
      )}

      <section
        aria-label={question.question}
        className="in-data-[mode=fun]:fun-paper flex flex-col gap-4 rounded-3xl in-data-[mode=fun]:p-5"
        key={question.itemId}
      >
        {stage === "reading" ? (
          <>
            <QuotedSource question={question} />
            {question.context && (
              <ItemText
                className="text-muted-foreground text-sm leading-relaxed"
                text={question.context}
              />
            )}
            <h2 className="text-xl leading-snug font-semibold">
              <ItemLine text={question.question} />
            </h2>
          </>
        ) : (
          <>
            <QuestionText question={question} />
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
