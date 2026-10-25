"use client";

import { useExtracted } from "next-intl";
import { type TaskSegment } from "../../_components/task-header";
import { TaskActionBar, TaskBody } from "../../_components/task-layout";
import { ContentVoteMenu } from "../../feedback/content-vote-menu";
import { type LessonHref } from "../../mistakes/drill/drill-types";
import { type QuestionTutor } from "../../questions/question-tutor";
import { usePreloadMath } from "../../rich-text/use-preload-math";
import { OpenNextStep } from "../open-next-step";
import { SessionFrame } from "../session-frame";
import { SessionHeader } from "../session-header";
import { type StudyBlockDetail, type StudySession } from "../session-types";
import { StudyMoment } from "../study-moment";
import { useBlockTitle } from "../use-block-copy";
import { useMomentEvents } from "../use-moment-events";
import { useBlockAside } from "./block-aside";
import { FinishReadyActions, FinishReadyBody } from "./block-finish-ready";
import {
  BlockDrillNotes,
  BlockQuestion,
  BlockQuestionActions,
  useBlockDrill,
  useDraftAnswer,
} from "./block-question";
import { getBlockTutorItem, withTutorAside } from "./block-tutor-item";
import { PauseSuggestion } from "./pause-suggestion";
import { ContinueButton, QuestionActionsRow } from "./question-actions";
import { QuestionBlockClose, QuestionBlockHeader } from "./question-block-header";
import { type QuestionBlockPhase, type QuestionBlockState } from "./question-block-state";
import { QuestionBlockStatus } from "./question-block-status";
import { QuestionFeedback } from "./question-feedback";
import { isNetScoredQuestion } from "./question-view";
import { SwipeScore } from "./swipe-score";
import { TimeMachine, TimeMachineNote } from "./time-machine";
import { useCapsuleEvents } from "./use-capsule-events";
import { type QuestionBlockActions, useQuestionBlock } from "./use-question-block";

/**
 * Each question's segment in the header: green or red once answered (this sitting's answer, or the
 * one saved before it), read for a placement question or a statement left blank, which aren't
 * graded as right or wrong, the one in view, and the rest ahead.
 */
function getQuestionSegments({
  detail,
  state,
}: {
  detail: StudyBlockDetail;
  state: QuestionBlockState;
}): TaskSegment[] {
  return detail.questions.map((question, index) => {
    const answer = state.answers[question.itemId] ?? question.answered;

    if (!answer) {
      return index === state.index ? "current" : "ahead";
    }

    if (question.placement || answer.blank) {
      return "read";
    }

    return answer.isCorrect ? "right" : "wrong";
  });
}

type SessionContext = Pick<StudySession, "blocks" | "examTomorrow" | "id" | "missions">;

type SessionActions = QuestionBlockActions & {
  continueSession: () => Promise<boolean>;
  stop: () => Promise<boolean>;
};

function FinishedBlock({
  actions,
  detail,
  exitHref,
  moment,
  session,
}: {
  actions: SessionActions;
  detail: StudyBlockDetail;
  exitHref: string;
  moment: Extract<QuestionBlockPhase, { kind: "finished" }>["moment"];
  session: SessionContext;
}) {
  const t = useExtracted();
  useMomentEvents({ missionsBefore: session.missions, moment });

  // The session's last block ends on the summary itself: a moment that only says "See what
  // changed" would be one more tap.
  if (moment.sessionCompleted) {
    return (
      <OpenNextStep
        exitHref={exitHref}
        header={<SessionHeader exitHref={exitHref} sessionBar={moment.sessionBar} />}
        readNext={actions.refresh}
        status={t("Saving your answers…")}
      />
    );
  }

  return (
    <StudyMoment
      blocks={session.blocks}
      missionsBefore={session.missions}
      exitHref={exitHref}
      kind={detail.block.kind}
      moment={moment}
      next={session.blocks.find((block) => block.id === moment.nextBlockId) ?? null}
      onContinue={actions.continueSession}
      onStop={actions.stop}
    />
  );
}

function showsQuestionActions({
  phase,
  stage,
}: {
  phase: QuestionBlockPhase;
  stage: string;
}): boolean {
  return stage !== "idea" || phase.kind === "finishReady";
}

/** Before the grade: answering, checking, or answering again after a failed save. */
function isAnswerPhase(phase: QuestionBlockPhase): boolean {
  return phase.kind === "answering" || phase.kind === "checking" || phase.kind === "answerFailed";
}

/** How the current question's answer went, or null before it's graded. */
function getAnswerResult(phase: QuestionBlockPhase): "correct" | "wrong" | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  return phase.feedback.isCorrect ? "correct" : "wrong";
}

/**
 * The question the header's menu reports. A timed drill's clock never waits on a menu, so its
 * question is reported once answered.
 */
function getVoteTarget({
  phase,
  question,
}: {
  phase: QuestionBlockPhase;
  question: ReturnType<typeof useQuestionBlock>["question"];
}) {
  if (!question || (question.drill?.timeLimitSeconds && phase.kind !== "feedback")) {
    return null;
  }

  return { contentId: question.itemId, contentKind: "item" as const };
}

/** The "…" menu to report the question in view, when it can be reported now. */
function BlockMenu({ target }: { target: ReturnType<typeof getVoteTarget> }) {
  const t = useExtracted();

  if (!target) {
    return null;
  }

  return (
    <ContentVoteMenu
      label={t("Question options")}
      screen="question-block"
      size="task"
      target={target}
      votes={false}
    />
  );
}

/**
 * One question block of today's session (capsules, practice or a mistake drill), played one
 * question at a time and ending with its completion moment. A saved mistake's drill plays the way
 * its cause calls for. Like the lesson, a tap picks and Check sends; the actions stay pinned to the
 * bottom of the screen, Check before the grade and Continue after it, and the learner's buddy can
 * be asked about the question in view (`tutor`).
 */
export function QuestionBlock({
  actions,
  detail,
  exitHref,
  lessonHref = null,
  session,
  tutor,
}: {
  actions: SessionActions;
  detail: StudyBlockDetail;
  exitHref: string;
  /** Where a content gap's lesson opens; without it the drill shows only the lesson's summary. */
  lessonHref?: LessonHref | null;
  session: SessionContext;
  /** The learner's buddy for the question in view, from the host; none plays without it. */
  tutor?: QuestionTutor | null;
}) {
  const blockTitle = useBlockTitle();
  const run = useQuestionBlock({ actions, detail });
  usePreloadMath(detail);
  const { phase } = run.state;
  const { question } = run;
  const blockDrill = useBlockDrill({ detail, index: run.state.index });
  const draft = useDraftAnswer(run.state.index);
  const aside = useBlockAside({ detail, question, session });

  useCapsuleEvents({ detail, finished: phase.kind === "finished" });

  if (phase.kind === "finished") {
    return (
      <FinishedBlock
        actions={actions}
        detail={detail}
        exitHref={exitHref}
        moment={phase.moment}
        session={session}
      />
    );
  }

  const answerResult = getAnswerResult(phase);
  const askButton = tutor?.button;

  const block = (
    <SessionFrame aside={withTutorAside({ aside, tutor })}>
      <QuestionBlockHeader
        close={<QuestionBlockClose href={exitHref} />}
        index={run.state.index}
        menu={
          <BlockMenu
            target={blockDrill.stage === "idea" ? null : getVoteTarget({ phase, question })}
          />
        }
        segments={getQuestionSegments({ detail, state: run.state })}
        title={blockTitle(detail.block)}
        total={run.total}
      />

      <TaskBody data-slot="question-block">
        <FinishReadyBody phase={phase} />
        {isNetScoredQuestion({ detail, question }) && (
          <SwipeScore detail={detail} answers={run.state.answers} />
        )}

        {question?.timeMachine && !answerResult && (
          <TimeMachine
            format={question.format}
            machine={question.timeMachine}
            trueFalseLabels={detail.trueFalseLabels}
          />
        )}

        {question && (
          <BlockQuestion
            blockDrill={blockDrill}
            detail={detail}
            draft={draft}
            lessonHref={lessonHref}
            question={question}
            run={run}
          />
        )}

        {phase.kind === "feedback" && question && (
          <>
            <QuestionFeedback
              answer={phase.answer}
              examTomorrow={session.examTomorrow}
              feedback={phase.feedback}
              question={question}
              timedOut={blockDrill.timedOut}
              trueFalseLabels={detail.trueFalseLabels}
            >
              <BlockDrillNotes blockDrill={blockDrill} feedback={phase.feedback} phase={phase} />
              {question.timeMachine && answerResult && (
                <TimeMachineNote
                  format={question.format}
                  machine={question.timeMachine}
                  result={answerResult}
                  trueFalseLabels={detail.trueFalseLabels}
                />
              )}
            </QuestionFeedback>
            {phase.feedback.pauseSuggested && <PauseSuggestion onStop={actions.stop} />}
          </>
        )}
      </TaskBody>

      {/* A gap's idea screen has its own Start. */}
      {showsQuestionActions({ phase, stage: blockDrill.stage }) && (
        <TaskActionBar>
          <QuestionBlockStatus
            onContinue={actions.refresh}
            onRetry={run.retryFinish}
            phase={phase}
          />

          <FinishReadyActions onFinish={run.retryFinish} phase={phase} />

          {phase.kind === "feedback" && (
            <QuestionActionsRow ask={askButton}>
              <ContinueButton onContinue={run.next} />
            </QuestionActionsRow>
          )}

          {question && isAnswerPhase(phase) && (
            <QuestionActionsRow ask={askButton}>
              <BlockQuestionActions
                blockDrill={blockDrill}
                draft={draft}
                question={question}
                run={run}
              />
            </QuestionActionsRow>
          )}
        </TaskActionBar>
      )}
    </SessionFrame>
  );

  if (!tutor) {
    return block;
  }

  return tutor.wrap(
    getBlockTutorItem({ blockDrill, detail, index: run.state.index, phase, question }),
    block,
  );
}
