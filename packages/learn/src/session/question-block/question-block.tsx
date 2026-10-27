"use client";

import { useExtracted } from "next-intl";
import { type TaskSegment } from "../../_components/task-header";
import { TaskActionBar } from "../../_components/task-layout";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { ContentFeedbackMenu } from "../../feedback/content-feedback-menu";
import { type LessonHref } from "../../mistakes/drill/drill-types";
import { type QuestionTutor } from "../../questions/question-tutor";
import { usePreloadMath } from "../../rich-text/use-preload-math";
import { type MomentCeremony } from "../moment-ceremony";
import { SessionFrame } from "../session-frame";
import { type StudyBlockDetail, type StudySession } from "../session-types";
import { StudyMoment } from "../study-moment";
import { useBlockTitle } from "../use-block-copy";
import { useMomentEvents } from "../use-moment-events";
import { useBlockAside } from "./block-aside";
import { BlockBody, showsQuestionActions } from "./block-body";
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
 * Each question's segment in the header: blue or red once answered (this sitting's answer, or the
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

type SessionContext = Pick<StudySession, "blocks" | "examTomorrow" | "id">;

type SessionActions = QuestionBlockActions & {
  continueSession: () => Promise<boolean>;
  stop: () => Promise<boolean>;
};

function FinishedBlock({
  actions,
  buddy,
  detail,
  exitHref,
  moment,
  renderCeremony,
  session,
}: {
  actions: SessionActions;
  buddy?: LearnBuddy | null;
  detail: StudyBlockDetail;
  exitHref: string;
  moment: Extract<QuestionBlockPhase, { kind: "finished" }>["moment"];
  renderCeremony?: MomentCeremony;
  session: SessionContext;
}) {
  useMomentEvents({ moment });

  // The session's last block has its moment too (its missions, the day's bonus, a level), with
  // "See today's summary" to go on.
  return (
    <StudyMoment
      blocks={session.blocks}
      buddy={buddy}
      renderCeremony={renderCeremony}
      exitHref={exitHref}
      kind={detail.block.kind}
      moment={moment}
      next={session.blocks.find((block) => block.id === moment.nextBlockId) ?? null}
      onContinue={actions.continueSession}
      onStop={actions.stop}
    />
  );
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
    <ContentFeedbackMenu
      label={t("Question options")}
      screen="question-block"
      size="task"
      target={target}
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
  buddy,
  detail,
  exitHref,
  lessonHref = null,
  renderCeremony,
  session,
  tutor,
}: {
  actions: SessionActions;
  /** The learner's buddy, who cheers when the block completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  detail: StudyBlockDetail;
  exitHref: string;
  /** Where a content gap's lesson opens; without it the drill shows only the lesson's summary. */
  lessonHref?: LessonHref | null;
  /** The full-screen moment for a milestone the block earned (a new belt, new glasses). */
  renderCeremony?: MomentCeremony;
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
        buddy={buddy}
        renderCeremony={renderCeremony}
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

      <BlockBody kind={detail.block.kind} phase={phase}>
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
      </BlockBody>

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
