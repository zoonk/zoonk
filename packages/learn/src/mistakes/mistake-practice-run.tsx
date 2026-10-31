"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../_components/save-error";
import { TASK_HEADER_ICON_CLASS } from "../_components/task-header";
import {
  TaskActionBar,
  TaskAside,
  TaskBody,
  getTaskAsideRootProps,
} from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { LearnLink } from "../learn-link";
import { type QuestionTutor } from "../questions/question-tutor";
import { usePreloadMath } from "../rich-text/use-preload-math";
import { type MomentCeremony } from "../session/moment-ceremony";
import { QuestionActionsRow } from "../session/question-block/question-actions";
import { QuestionBlockHeader } from "../session/question-block/question-block-header";
import { type LessonHref } from "./drill/drill-types";
import { type PracticeEntry, getPracticeSegments } from "./mistake-practice-state";
import { NothingToPractice, PracticeDone, PracticeSaving } from "./practice-done";
import { PracticeStepActions, PracticeStepView } from "./practice-step";
import { getPracticeTutorItem } from "./practice-tutor-item";
import { type MistakePracticeActions, useMistakePractice } from "./use-mistake-practice";

export type { MistakePracticeFeedback, MistakePracticeSummary } from "./mistake-practice-state";

type Run = ReturnType<typeof useMistakePractice>;

const CLOSE_CLASS = cn(
  buttonVariants({ size: "icon", variant: "ghost" }),
  TASK_HEADER_ICON_CLASS.start,
);

function EndButton({ backHref, run }: { backHref: string; run: Run }) {
  const t = useExtracted();
  const linkRef = useEscapeClick<HTMLAnchorElement>();
  const buttonRef = useEscapeClick<HTMLButtonElement>();
  const { phase } = run.state;

  if (run.state.answerIds.length === 0 || phase.kind === "ending" || phase.kind === "ended") {
    return (
      <LearnLink
        aria-keyshortcuts="Escape"
        aria-label={t("Back to the notebook")}
        className={CLOSE_CLASS}
        href={backHref}
        ref={linkRef}
      >
        <XIcon aria-hidden="true" />
      </LearnLink>
    );
  }

  return (
    <Button
      aria-keyshortcuts="Escape"
      aria-label={t("End practice. What you answered counts.")}
      className={TASK_HEADER_ICON_CLASS.start}
      disabled={phase.kind === "checking"}
      onClick={run.end}
      ref={buttonRef}
      size="icon"
      variant="ghost"
    >
      <XIcon aria-hidden="true" />
    </Button>
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
    phase.kind === "ending" ||
    phase.kind === "ended" ||
    (timed && phase.kind !== "feedback")
  ) {
    return null;
  }

  return (
    <ContentFeedbackMenu
      label={t("Question options")}
      screen="mistake-practice"
      size="task"
      target={{ contentId: run.step.question.itemId, contentKind: "item" }}
    />
  );
}

function PracticeBody({
  askButton,
  backHref,
  buddy,
  lessonHref,
  renderCeremony,
  run,
  trueFalseLabels,
}: {
  askButton: React.ReactNode;
  backHref: string;
  buddy?: LearnBuddy | null;
  lessonHref: LessonHref | null;
  renderCeremony?: MomentCeremony;
  run: Run;
  trueFalseLabels: TrueFalseLabels;
}) {
  const { phase } = run.state;

  if (run.steps.length === 0) {
    return <NothingToPractice backHref={backHref} />;
  }

  if (phase.kind === "ending") {
    return <PracticeSaving />;
  }

  if (phase.kind === "ended" || !run.step) {
    return (
      <PracticeDone
        backHref={backHref}
        buddy={buddy}
        fixed={run.state.fixedIds.length}
        reached={run.state.reached}
        renderCeremony={renderCeremony}
        summary={phase.kind === "ended" ? phase.summary : null}
      />
    );
  }

  return (
    <>
      <TaskBody>
        <PracticeStepView
          lessonHref={lessonHref}
          run={run}
          step={run.step}
          trueFalseLabels={trueFalseLabels}
        />
      </TaskBody>

      {phase.kind !== "idea" && (
        <TaskActionBar>
          {phase.kind === "answerFailed" && (
            <AnswersSaveError onRetry={() => run.check(phase.answer)} />
          )}
          <QuestionActionsRow ask={askButton}>
            <PracticeStepActions run={run} step={run.step} />
          </QuestionActionsRow>
        </TaskActionBar>
      )}
    </>
  );
}

export function MistakePracticeRun({
  actions,
  backHref,
  buddy,
  lessonHref,
  practice,
  renderCeremony,
  trueFalseLabels,
  tutor = null,
}: {
  actions: MistakePracticeActions;
  backHref: string;
  buddy?: LearnBuddy | null;
  lessonHref: LessonHref | null;
  practice: PracticeEntry[];
  renderCeremony?: MomentCeremony;
  trueFalseLabels: TrueFalseLabels;
  tutor?: QuestionTutor | null;
}) {
  const t = useExtracted();
  const run = useMistakePractice({ actions, practice });
  const { phase } = run.state;
  usePreloadMath(practice);

  const asideRoot = tutor ? getTaskAsideRootProps() : null;
  const asking = phase.kind !== "ending" && phase.kind !== "ended" && run.step !== null;

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
        total={phase.kind === "ending" || phase.kind === "ended" ? 0 : run.steps.length}
      />

      <PracticeBody
        askButton={tutor?.button}
        backHref={backHref}
        buddy={buddy}
        lessonHref={lessonHref}
        renderCeremony={renderCeremony}
        run={run}
        trueFalseLabels={trueFalseLabels}
      />

      {tutor && (
        <TaskAside
          label={t("Help with this question")}
          meta={asking ? tutor.asideMeta(null) : undefined}
        >
          {asking && tutor.aside}
        </TaskAside>
      )}
    </div>
  );

  return tutor ? tutor.wrap(getPracticeTutorItem(run), content) : content;
}
