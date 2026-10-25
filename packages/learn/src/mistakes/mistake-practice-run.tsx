"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { TASK_HEADER_ICON_CLASS } from "../_components/task-header";
import {
  TaskActionBar,
  TaskAside,
  TaskBody,
  getTaskAsideRootProps,
} from "../_components/task-layout";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { LearnLink } from "../learn-link";
import { type QuestionTutor } from "../questions/question-tutor";
import { usePreloadMath } from "../rich-text/use-preload-math";
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

/** The close's glyph sits on the column's edge, as in every task's header. */
const CLOSE_CLASS = cn(
  buttonVariants({ size: "icon", variant: "ghost" }),
  TASK_HEADER_ICON_CLASS.start,
);

/**
 * Ends the run early: what was answered counts, like a partial day. Before any answer, and once
 * the run is over, there's nothing to count, so it just goes back. Leaving loses nothing, so
 * Escape presses it, as it closes a session's block and the lesson player.
 */
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

/**
 * The question's "…" menu to report a problem. A timed drill's clock never waits on a menu, so
 * there it shows once the question is answered.
 */
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
    <ContentVoteMenu
      label={t("Question options")}
      screen="mistake-practice"
      size="task"
      target={{ contentId: run.step.question.itemId, contentKind: "item" }}
      votes={false}
    />
  );
}

/** What the bar says above its actions when an answer couldn't be saved. */
function AnswerFailed() {
  const t = useExtracted();

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("We couldn't save that answer. Check it again.")}
    </p>
  );
}

/** The run's body for where it is: a question with its pinned actions, saving, or done. */
function PracticeBody({
  askButton,
  backHref,
  lessonHref,
  run,
  trueFalseLabels,
}: {
  /** "Ask {buddy}" beside the main action, when the host has a tutor. */
  askButton: React.ReactNode;
  backHref: string;
  lessonHref: LessonHref | null;
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
        fixed={run.state.fixedIds.length}
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

      {/* A gap's idea screen has its own Start. */}
      {phase.kind !== "idea" && (
        <TaskActionBar>
          {phase.kind === "answerFailed" && <AnswerFailed />}
          <QuestionActionsRow ask={askButton}>
            <PracticeStepActions run={run} step={run.step} />
          </QuestionActionsRow>
        </TaskActionBar>
      )}
    </>
  );
}

/**
 * "Practice mistakes": a short run over a few open mistakes, each drilled the way its cause calls
 * for, with the answer and why after every question. It plays like a session block: the same
 * header with one segment per question, the same options and feedback, and Check then Continue
 * pinned at the bottom. A mistake answered right on a later day is fixed, and the run counts
 * toward today like any practice, stopped early included. How the drill goes sits above its
 * question at every size; from `lg` the learner's buddy (`tutor`) sits beside the question, at
 * the foot of the aside, to ask about the question in view.
 */
export function MistakePracticeRun({
  actions,
  backHref,
  lessonHref,
  practice,
  trueFalseLabels,
  tutor = null,
}: {
  actions: MistakePracticeActions;
  backHref: string;
  /** Where a content gap's lesson opens; without it the drill shows only the lesson's summary. */
  lessonHref: LessonHref | null;
  practice: PracticeEntry[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
  /** The learner's buddy for the question in view, from the host; none plays without it. */
  tutor?: QuestionTutor | null;
}) {
  const t = useExtracted();
  const run = useMistakePractice({ actions, practice });
  const { phase } = run.state;
  usePreloadMath(practice);

  // The buddy is beside a question, never beside the run's end; the column keeps its place there.
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
        lessonHref={lessonHref}
        run={run}
        trueFalseLabels={trueFalseLabels}
      />

      {tutor && asking && <TaskAside label={t("Help with this question")}>{tutor.aside}</TaskAside>}
    </div>
  );

  return tutor ? tutor.wrap(getPracticeTutorItem(run), content) : content;
}
