"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";
import { type LessonHref } from "../../mistakes/drill/drill-types";
import { type StudyBlockDetail, type StudySession } from "../session-types";
import { StudyMoment } from "../study-moment";
import { useBlockTitle } from "../use-block-copy";
import { useMomentEvents } from "../use-moment-events";
import { BlockDrillNotes, BlockQuestion, useBlockDrill } from "./block-question";
import { PauseSuggestion } from "./pause-suggestion";
import { QuestionBlockHeader } from "./question-block-header";
import { type QuestionBlockPhase } from "./question-block-state";
import { QuestionFeedback } from "./question-feedback";
import { isNetScoredQuestion } from "./question-view";
import { SwipeScore } from "./swipe-score";
import { TimeMachine } from "./time-machine";
import { useCapsuleEvents } from "./use-capsule-events";
import { type QuestionBlockActions, useQuestionBlock } from "./use-question-block";

type SessionContext = {
  id: string;
  missions: StudySession["missions"];
  sessionBar: { completed: number; total: number };
};

type SessionActions = QuestionBlockActions & {
  continueSession: () => Promise<boolean>;
  stop: () => Promise<boolean>;
};

function PhaseMessage({ onRetry, phase }: { onRetry: () => void; phase: QuestionBlockPhase }) {
  const t = useExtracted();

  if (phase.kind === "answerFailed") {
    return (
      <p className="text-destructive text-sm" role="alert">
        {phase.retryAfterSeconds === null
          ? t("We couldn't save that answer. Pick it again.")
          : t("Take a short break: you can keep reviewing in {seconds} seconds.", {
              seconds: String(phase.retryAfterSeconds),
            })}
      </p>
    );
  }

  if (phase.kind === "finishFailed") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive text-sm">{t("We couldn't save this block yet.")}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (phase.kind === "finishing") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner />
        {t("Saving your answers…")}
      </p>
    );
  }

  return null;
}

function NextButton({ onNext }: { onNext: () => void }) {
  const t = useExtracted();

  useEnterKey(onNext);

  return <EnterButton onClick={onNext}>{t("Continue")}</EnterButton>;
}

function FinishedBlock({
  actions,
  detail,
  moment,
  session,
}: {
  actions: SessionActions;
  detail: StudyBlockDetail;
  moment: Extract<QuestionBlockPhase, { kind: "finished" }>["moment"];
  session: SessionContext;
}) {
  useMomentEvents({ missionsBefore: session.missions, moment });

  return (
    <StudyMoment
      kind={detail.block.kind}
      moment={moment}
      onContinue={actions.continueSession}
      onStop={actions.stop}
    />
  );
}

/**
 * Votes on the question from the header's menu. A timed drill's clock never waits on a menu, so
 * its question is voted on once answered.
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

/**
 * One question block of today's session (capsules, practice or a mistake drill), played one
 * question at a time and ending with its completion moment. A saved mistake's drill
 * plays the way its cause calls for. Both modes share it; Fun puts questions on paper and shows
 * Hyperdrive live.
 */
export function QuestionBlock({
  actions,
  detail,
  exitHref,
  lessonHref = null,
  session,
}: {
  actions: SessionActions;
  detail: StudyBlockDetail;
  exitHref: string;
  /** Where a content gap's lesson opens; without it the drill shows only the lesson's summary. */
  lessonHref?: LessonHref | null;
  session: SessionContext;
}) {
  const blockTitle = useBlockTitle();
  const run = useQuestionBlock({ actions, detail });
  const { phase } = run.state;
  const { question } = run;
  const blockDrill = useBlockDrill({ detail, index: run.state.index });

  useCapsuleEvents({ detail, finished: phase.kind === "finished" });

  if (phase.kind === "finished") {
    return (
      <FinishedBlock actions={actions} detail={detail} moment={phase.moment} session={session} />
    );
  }

  const capsule = detail.block.capsules.find((candidate) => candidate.key === question?.capsuleKey);

  return (
    <div className="flex flex-1 flex-col gap-5" data-slot="question-block">
      <QuestionBlockHeader
        exitHref={exitHref}
        hyperdrive={run.state.hyperdrive}
        index={run.state.index}
        sessionBar={session.sessionBar}
        title={capsule?.title ?? blockTitle(detail.block)}
        total={run.total}
        voteTarget={blockDrill.stage === "idea" ? null : getVoteTarget({ phase, question })}
      />

      {isNetScoredQuestion({ detail, question }) && (
        <SwipeScore detail={detail} answers={run.state.answers} />
      )}
      {question?.timeMachine && (
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
          lessonHref={lessonHref}
          question={question}
          run={run}
        />
      )}

      {phase.kind === "feedback" && question && (
        <>
          <QuestionFeedback
            feedback={phase.feedback}
            question={question}
            trueFalseLabels={detail.trueFalseLabels}
          >
            <BlockDrillNotes blockDrill={blockDrill} feedback={phase.feedback} phase={phase} />
          </QuestionFeedback>
          {phase.feedback.pauseSuggested && <PauseSuggestion onStop={actions.stop} />}
        </>
      )}

      <PhaseMessage onRetry={run.retryFinish} phase={phase} />

      <div className="mt-auto">{phase.kind === "feedback" && <NextButton onNext={run.next} />}</div>
    </div>
  );
}
