"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCheckNote } from "../_components/check-note";
import { MainActionSlotProvider, usePlacedMainActionNote } from "../_components/main-action-slot";
import { QuestionActions } from "../_components/question-actions";
import { AnswersSaveError } from "../_components/save-error";
import { TaskClose } from "../_components/task-close";
import {
  TaskActionBar,
  TaskAside,
  TaskBody,
  getTaskAsideRootProps,
} from "../_components/task-layout";
import { useScreenAtTop } from "../_utils/use-screen-at-top";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { type QuestionTutor } from "../questions/question-tutor";
import { usePreloadMath } from "../rich-text/use-preload-math";
import { FailedMoment } from "../session/failed-moment";
import { type MomentCeremony } from "../session/moment-ceremony";
import { QuestionBlockHeader } from "../session/question-block/question-block-header";
import { type LessonHref } from "./drill/drill-types";
import {
  type PracticeEntry,
  canPracticeAgain,
  getPracticeScore,
  getPracticeSegments,
} from "./mistake-practice-state";
import { NothingToPractice, PracticeDone, PracticeSaving } from "./practice-done";
import {
  type LessonPracticeRenderer,
  PracticeStepActions,
  PracticeStepView,
} from "./practice-step";
import { getPracticeTutorItem } from "./practice-tutor-item";
import { type MistakePracticeActions, useMistakePractice } from "./use-mistake-practice";

export type { LessonPracticeRenderer } from "./practice-step";
export type {
  MistakePracticeFeedback,
  MistakePracticeSummary,
  PracticeEntry,
} from "./mistake-practice-state";

type Run = ReturnType<typeof useMistakePractice>;

/** The run asks nothing more: its finish is out, failed or done. */
function isOver(kind: Run["state"]["phase"]["kind"]): boolean {
  return kind === "ending" || kind === "finishFailed" || kind === "ended";
}

function EndButton({ backHref, run }: { backHref: string; run: Run }) {
  const t = useExtracted();
  const { phase } = run.state;

  if (run.state.answerIds.length === 0 || isOver(phase.kind)) {
    return <TaskClose href={backHref} />;
  }

  return (
    <TaskClose
      disabled={phase.kind === "checking"}
      label={t("Leave. What you answered counts.")}
      onPress={run.end}
    />
  );
}

/** A timed drill's clock never waits on a menu, so there it shows once the question is answered. */
function QuestionMenu({ run }: { run: Run }) {
  const t = useExtracted();
  const { phase } = run.state;
  const timed = run.step?.entry.drill.timeLimitSeconds !== null;

  if (
    !run.step ||
    phase.kind === "idea" ||
    isOver(phase.kind) ||
    (timed && phase.kind !== "feedback")
  ) {
    return null;
  }

  return (
    <ContentFeedbackMenu
      label={t("Question options")}
      screen="mistake-practice"
      target={
        run.step.lesson
          ? { contentId: run.step.lesson.step.id, contentKind: "step" }
          : { contentId: run.step.question?.itemId ?? "", contentKind: "item" }
      }
    />
  );
}

/** A failed save says so on the bar itself, with its Try again, so the note over the bar stays quiet. */
function PracticeBar({
  askButton,
  run,
  step,
}: {
  askButton: React.ReactNode;
  run: Run;
  step: NonNullable<Run["step"]>;
}) {
  const { phase } = run.state;
  const checkNote = useCheckNote({ checking: phase.kind === "checking" });
  const placedNote = usePlacedMainActionNote();

  return (
    <TaskActionBar note={phase.kind === "answerFailed" ? null : (checkNote ?? placedNote)}>
      {phase.kind === "answerFailed" && (
        <AnswersSaveError failures={run.state.failures} onRetry={run.retry} />
      )}
      <QuestionActions>
        <PracticeStepActions ask={askButton} run={run} step={step} />
      </QuestionActions>
    </TaskActionBar>
  );
}

/** A question's own phases (answering, checking, feedback) are one screen. */
function getScreen(kind: Run["state"]["phase"]["kind"]) {
  return kind === "idea" || isOver(kind) ? kind : "question";
}

function PracticeBody({
  askButton,
  doneHref,
  buddy,
  dayBlock,
  lessonHref,
  renderCeremony,
  renderLesson,
  run,
  trueFalseLabels,
}: {
  askButton: React.ReactNode;
  doneHref: string;
  buddy?: LearnBuddy | null;
  dayBlock: boolean;
  lessonHref: LessonHref | null;
  renderCeremony?: MomentCeremony;
  renderLesson: LessonPracticeRenderer;
  run: Run;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const { phase } = run.state;
  useScreenAtTop(`${run.state.index}:${getScreen(phase.kind)}`);

  // An emptied block has no answers to keep: only marking it done didn't go through.
  if (phase.kind === "finishFailed") {
    const answered = run.state.answerIds.length > 0;

    return (
      <FailedMoment
        failures={run.state.failures}
        message={answered ? undefined : t("We couldn't mark it done. Check your connection.")}
        onRetry={run.end}
        title={answered ? t("Your practice isn't saved yet") : t("Already fixed")}
      />
    );
  }

  if (phase.kind === "ending") {
    return <PracticeSaving />;
  }

  if (run.steps.length === 0) {
    return <NothingToPractice dayBlock={dayBlock} doneHref={doneHref} />;
  }

  if (phase.kind === "ended" || !run.step) {
    return (
      <PracticeDone
        again={!dayBlock && canPracticeAgain(run.state) ? run.again : null}
        buddy={buddy}
        dayBlock={dayBlock}
        doneHref={doneHref}
        fixed={run.state.fixedIds.length}
        reached={run.state.reached}
        renderCeremony={renderCeremony}
        score={getPracticeScore(run.state)}
        summary={phase.kind === "ended" ? phase.summary : null}
      />
    );
  }

  return (
    <MainActionSlotProvider>
      {/* A lesson's step keeps the lesson's room above the actions, so its word bank sits where it does there. */}
      <TaskBody className={cn(run.step.lesson && "pb-6")}>
        <PracticeStepView
          lessonHref={lessonHref}
          renderLesson={renderLesson}
          run={run}
          step={run.step}
          trueFalseLabels={trueFalseLabels}
        />
      </TaskBody>

      {phase.kind !== "idea" && <PracticeBar askButton={askButton} run={run} step={run.step} />}
    </MainActionSlotProvider>
  );
}

/**
 * A day's block run (`dayBlock`) waits for its completion before it's over and offers no Practice
 * again: it goes on to the day's next stop.
 */
export function MistakePracticeRun({
  actions,
  backHref,
  buddy,
  dayBlock = false,
  doneHref,
  lessonHref,
  practice,
  renderCeremony,
  renderLesson,
  trueFalseLabels,
  tutor = null,
}: {
  actions: MistakePracticeActions;
  backHref: string;
  buddy?: LearnBuddy | null;
  dayBlock?: boolean;
  /** Where the done screen's main action goes; a day's block goes on to the day's next stop. */
  doneHref?: string;
  lessonHref: LessonHref | null;
  practice: PracticeEntry[];
  renderCeremony?: MomentCeremony;
  renderLesson: LessonPracticeRenderer;
  trueFalseLabels: TrueFalseLabels;
  tutor?: QuestionTutor | null;
}) {
  const t = useExtracted();
  const run = useMistakePractice({ actions, dayBlock, practice });
  const { phase } = run.state;
  usePreloadMath(run.state.steps);

  const asking = !isOver(phase.kind) && run.step !== null;
  const asideRoot = tutor && asking ? getTaskAsideRootProps() : null;

  const content = (
    <div
      className={cn("flex flex-1 flex-col", asideRoot?.className)}
      data-aside={asideRoot?.["data-aside"]}
    >
      <QuestionBlockHeader
        close={<EndButton backHref={backHref} run={run} />}
        index={run.state.index}
        menu={<QuestionMenu run={run} />}
        segments={getPracticeSegments(run.state)}
        title={t("Practice mistakes")}
        total={isOver(phase.kind) ? 0 : run.steps.length}
      />

      <PracticeBody
        askButton={tutor?.button}
        doneHref={doneHref ?? backHref}
        buddy={buddy}
        dayBlock={dayBlock}
        lessonHref={lessonHref}
        renderCeremony={renderCeremony}
        renderLesson={renderLesson}
        run={run}
        trueFalseLabels={trueFalseLabels}
      />

      {tutor && asking && (
        <TaskAside label={t("Help with this question")} meta={tutor.asideMeta(null)}>
          {tutor.aside}
        </TaskAside>
      )}
    </div>
  );

  return tutor ? tutor.wrap(getPracticeTutorItem(run), content) : content;
}
