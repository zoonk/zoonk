"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { LearnLink } from "../learn-link";
import { type LessonHref } from "./drill/drill-types";
import { type PracticeEntry } from "./mistake-practice-state";
import { NothingToPractice, PracticeDone, PracticeSaving } from "./practice-done";
import { PracticeStepView } from "./practice-step";
import { type MistakePracticeActions, useMistakePractice } from "./use-mistake-practice";

export type { MistakePracticeFeedback, MistakePracticeSummary } from "./mistake-practice-state";

const PERCENT = 100;

type Run = ReturnType<typeof useMistakePractice>;

const CLOSE_CLASS = cn(buttonVariants({ size: "icon-lg", variant: "ghost" }), "rounded-full");

/**
 * Ends the run early: what was answered counts, like a partial day. Before any answer there's
 * nothing to count, so it just goes back.
 */
function EndButton({ backHref, run }: { backHref: string; run: Run }) {
  const t = useExtracted();

  if (run.state.answerIds.length === 0) {
    return (
      <LearnLink aria-label={t("Back to the notebook")} className={CLOSE_CLASS} href={backHref}>
        <XIcon aria-hidden="true" />
      </LearnLink>
    );
  }

  return (
    <Button
      aria-label={t("End practice. What you answered counts.")}
      className="rounded-full"
      disabled={run.state.phase.kind === "checking"}
      onClick={run.end}
      size="icon-lg"
      variant="ghost"
    >
      <XIcon aria-hidden="true" />
    </Button>
  );
}

/**
 * The question's "…" menu to vote on it. A timed drill's clock never waits on a menu, so there it
 * shows once the question is answered.
 */
function QuestionMenu({ run }: { run: Run }) {
  const t = useExtracted();
  const { phase } = run.state;
  const timed = run.step?.entry.drill.timeLimitSeconds !== null;

  if (!run.step || phase.kind === "idea" || (timed && phase.kind !== "feedback")) {
    return null;
  }

  return (
    <ContentVoteMenu
      label={t("Question options")}
      screen="mistake-practice"
      target={{ contentId: run.step.question.itemId, contentKind: "item" }}
    />
  );
}

function PracticeHeader({ backHref, run }: { backHref: string; run: Run }) {
  const t = useExtracted();
  const locale = useLocale();
  const total = run.steps.length;

  return (
    <header className="flex items-center gap-2">
      <EndButton backHref={backHref} run={run} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="text-muted-foreground text-sm">{t("Practice mistakes")}</h1>
        <Progress
          locale={locale}
          aria-label={t("Question {current, number} of {total, number}", {
            current: Math.min(run.state.index + 1, total),
            total,
          })}
          className="**:data-[slot=progress-track]:h-1.5"
          value={(run.state.index / total) * PERCENT}
        />
      </div>

      <QuestionMenu run={run} />
    </header>
  );
}

/**
 * "Practice mistakes": a short run over a few open mistakes, each drilled the way its cause calls
 * for, with the answer and why after every question. A mistake answered right on a later day is
 * fixed, and the run counts toward today like any practice, stopped early included.
 */
export function MistakePracticeRun({
  actions,
  backHref,
  lessonHref,
  practice,
  trueFalseLabels,
}: {
  actions: MistakePracticeActions;
  backHref: string;
  /** Where a content gap's lesson opens; without it the drill shows only the lesson's summary. */
  lessonHref: LessonHref | null;
  practice: PracticeEntry[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
}) {
  const run = useMistakePractice({ actions, practice });
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
    <div className="flex flex-col gap-6">
      <PracticeHeader backHref={backHref} run={run} />
      <PracticeStepView
        lessonHref={lessonHref}
        run={run}
        step={run.step}
        trueFalseLabels={trueFalseLabels}
      />
    </div>
  );
}
