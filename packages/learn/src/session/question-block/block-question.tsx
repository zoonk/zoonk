"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { TaskAsideContent } from "../../_components/task-layout";
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
import { ItemSupport } from "../../questions/item-text";
import {
  type StudyAnswerFeedback,
  type StudyBlockDetail,
  type StudyQuestion,
  type StudyQuestionAnswer,
} from "../session-types";
import { PlacementNote } from "./placement-note";
import { CheckButton } from "./question-actions";
import { type QuestionBlockPhase } from "./question-block-state";
import { QuestionTitle } from "./question-title";
import { QuestionView } from "./question-view";
import { QuotedSource } from "./quoted-source";
import { type useQuestionBlock } from "./use-question-block";

const MS_PER_SECOND = 1000;
const NOT_SURE = { dontKnow: true } as const;

type Run = ReturnType<typeof useQuestionBlock>;

type DrillStage = "idea" | "open" | "reading";

function getOpeningStage({ drill, first }: { drill: Drill | null; first: boolean }): DrillStage {
  if (first && isIdeaFirst(drill)) {
    return "idea";
  }

  return isReadFirst(drill) ? "reading" : "open";
}

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

function showsDrillIntro({ drill, first }: Pick<BlockDrill, "drill" | "first">): boolean {
  return drill !== null && !isIdeaFirst(drill) && (first || isReadFirst(drill));
}

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

function isSetContinued({ detail, index }: { detail: StudyBlockDetail; index: number }): boolean {
  const set = detail.questions[index]?.set;
  return Boolean(set) && detail.questions[index - 1]?.set?.id === set?.id;
}

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

/** Keyed by its set, so it keeps playing while the learner answers along, as in the exam. */
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
    <TaskAsideContent key={question.set.id}>
      <ItemSetStimulus
        askedIn={detail.block.id}
        practice
        questions={getRecordingQuestions({ detail, question })}
        set={question.set}
        transcript={phase.kind === "feedback" ? phase.feedback.transcript : null}
      />
    </TaskAsideContent>
  );
}

function hasTextStimulus(question: StudyQuestion): boolean {
  return Boolean(question.set) && !question.set?.listening;
}

function QuestionMaterial({
  continued,
  question,
}: {
  continued: boolean;
  question: StudyQuestion;
}) {
  return (
    <>
      {question.set && hasTextStimulus(question) && (
        <TaskAsideContent className="flex flex-col gap-4" key={question.itemId}>
          <ItemSetStimulus continued={continued} set={question.set} />
        </TaskAsideContent>
      )}

      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
    </>
  );
}

function QuestionText({
  continued,
  graded,
  question,
}: {
  continued: boolean;
  graded: boolean;
  question: StudyQuestion;
}) {
  return (
    <>
      <PlacementNote question={question} />
      <QuotedSource question={question} />
      <QuestionMaterial continued={continued} question={question} />
      {question.format !== "trueFalse" && <QuestionTitle muted={graded} text={question.question} />}
    </>
  );
}

export function useDraftAnswer(index: number) {
  const [draft, setDraft] = useState<{ answer: StudyQuestionAnswer | null; index: number }>({
    answer: null,
    index,
  });

  return {
    answer: draft.index === index ? draft.answer : null,
    set: (answer: StudyQuestionAnswer | null) => setDraft({ answer, index }),
  };
}

type DraftAnswer = ReturnType<typeof useDraftAnswer>;

export function BlockQuestion({
  blockDrill,
  detail,
  draft,
  lessonHref,
  question,
  run,
}: {
  blockDrill: BlockDrill;
  detail: StudyBlockDetail;
  draft: DraftAnswer;
  lessonHref: LessonHref | null;
  question: StudyQuestion;
  run: Run;
}) {
  const { phase } = run.state;
  const { drill, stage } = blockDrill;

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

      <section aria-label={question.question} className="flex flex-col gap-4" key={question.itemId}>
        {stage === "reading" ? (
          <>
            <QuotedSource question={question} />
            <QuestionMaterial
              continued={isSetContinued({ detail, index: run.state.index })}
              question={question}
            />
            <QuestionTitle text={question.question} />
          </>
        ) : (
          <>
            <QuestionText
              continued={isSetContinued({ detail, index: run.state.index })}
              graded={phase.kind === "feedback"}
              question={question}
            />
            <QuestionView
              detail={detail}
              onChange={draft.set}
              onSubmit={(answer) => void run.submit(answer)}
              phase={phase}
              question={question}
            />
          </>
        )}
      </section>
    </>
  );
}

export function BlockQuestionActions({
  blockDrill,
  draft,
  question,
  run,
}: {
  blockDrill: BlockDrill;
  draft: DraftAnswer;
  question: StudyQuestion;
  run: Run;
}) {
  const t = useExtracted();
  const { phase } = run.state;
  const { drill, stage } = blockDrill;
  const answering = phase.kind === "answering" || phase.kind === "answerFailed";
  const notSure = () => void run.submit(NOT_SURE);

  if (stage === "reading") {
    return <ShowAnswersButton onReveal={blockDrill.reveal} />;
  }

  return (
    <>
      {drill?.kind === "noGuessing" && answering && (
        <NotSureButton disabled={false} onClick={notSure} />
      )}

      {(question.placement || question.format === "typed") &&
        drill?.kind !== "noGuessing" &&
        answering && (
          <NotSureButton disabled={false} label={t("I don't know yet")} onClick={notSure} />
        )}

      <CheckButton
        busy={phase.kind === "checking"}
        disabled={!answering || draft.answer === null}
        onCheck={() => (draft.answer ? void run.submit(draft.answer) : undefined)}
      />
    </>
  );
}
